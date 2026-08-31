import {
  applyProgressAction as applyDomainProgressAction,
  brandIdentifier,
  createPlan,
  readOwnedAcceptedSnapshot,
  replacePlan,
  type DomainFailure,
  type IdentityAllocator,
} from '@openlearn/domain';
import type {
  ActivePlanAggregate,
  AcceptedPlanSnapshot,
  CanonicalPlanContent,
  IdentityAllocator as DomainIdentityAllocator,
  InternalOwnerId,
  PlanId,
  PlanItemId,
  RevisionId,
  Timestamp,
} from '@openlearn/domain';
import {
  applicationFailure,
  applicationSuccess,
} from './errors.js';
import { hasCapability, missingCapability } from './authorize.js';
import {
  executeMutation,
  type LifecycleDependencies,
  type MutationExecution,
} from './lifecycle.js';
import { requestFingerprint } from './fingerprint.js';
import type {
  ActorContext,
  ApplicationResult,
  ApplyProgressActionInput,
  CapabilityScope,
  CreatePlanViewInput,
  GetPlanViewInput,
  PlanHandoff,
  ProgressAction,
  SafeApplicationError,
  StoredOperationOutcome,
} from './contracts.js';
import type {
  ApplicationDependencies,
} from './ports.js';

export interface OpenLearnApplication {
  createPlanView(
    actor: ActorContext,
    input: CreatePlanViewInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>>;
  getPlanView(
    actor: ActorContext,
    input: GetPlanViewInput,
  ): Promise<ApplicationResult<AcceptedPlanSnapshot>>;
  applyProgressAction(
    actor: ActorContext,
    input: ApplyProgressActionInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>>;
}

const allowedProgressActions: readonly ProgressAction[] = [
  'start_item',
  'complete_item',
  'undo_completion',
];

const dashboardOrigin = (value: string): string => {
  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    (parsed.protocol !== 'https:' && !localHttp) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== '/' ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error('dashboardOrigin must be a controlled HTTPS or local origin');
  }
  return parsed.origin;
};

const invalidInput = <T>(operationId: string, message: string): ApplicationResult<T> =>
  applicationFailure(
    { operationId, state: 'rejected' },
    { code: 'invalid_input', message, retryable: false },
  );

const invalidReference = <T>(operationId: string): ApplicationResult<T> =>
  applicationFailure(
    { operationId, state: 'rejected' },
    {
      code: 'invalid_reference',
      message: 'The supplied plan reference is not valid.',
      retryable: false,
    },
  );

const unavailable = <T>(operationId: string): ApplicationResult<T> =>
  applicationFailure(
    { operationId, state: 'rejected' },
    {
      code: 'unavailable',
      message: 'The requested plan is not available.',
      retryable: false,
    },
  );

const operationFailure = <T>(
  operationId: string,
  state: 'rejected' | 'conflict',
  error: SafeApplicationError,
): ApplicationResult<T> => applicationFailure({ operationId, state }, error);

const domainError = (failure: DomainFailure): {
  readonly state: 'rejected' | 'conflict';
  readonly error: SafeApplicationError;
} => {
  switch (failure.category) {
    case 'owner_unavailable':
    case 'plan_deleted':
      return {
        state: 'rejected',
        error: {
          code: 'unavailable',
          message: 'The requested plan is not available.',
          retryable: false,
        },
      };
    case 'stale_revision':
      return {
        state: 'conflict',
        error: {
          code: 'stale_revision',
          message: 'The plan changed. Read the current plan before retrying.',
          retryable: true,
        },
      };
    case 'stale_progress':
      return {
        state: 'conflict',
        error: {
          code: 'stale_progress',
          message: 'Progress changed. Read the current item before retrying.',
          retryable: true,
        },
      };
    case 'mutation_replay_conflict':
      return {
        state: 'conflict',
        error: {
          code: 'mutation_replay_conflict',
          message: 'The request conflicts with an existing operation.',
          retryable: false,
        },
      };
    default:
      return {
        state: 'rejected',
        error: {
          code: 'domain_rejected',
          message: 'The supplied content or command did not pass validation.',
          retryable: false,
        },
      };
  }
};

const domainExecution = <T>(failure: DomainFailure): MutationExecution<T> => {
  const mapped = domainError(failure);
  return { outcome: { state: mapped.state, error: mapped.error } };
};

const handoffFor = (plan: ActivePlanAggregate, origin: string): PlanHandoff => ({
  planId: plan.planId,
  revisionId: plan.currentRevision.revisionId,
  revisionNumber: plan.currentRevision.revisionNumber,
  dashboardUrl: new URL(
    `/plans/${encodeURIComponent(plan.planId)}`,
    origin,
  ).toString(),
});

const handoffFromOutcome = (
  outcome: StoredOperationOutcome,
): PlanHandoff | undefined => {
  if (
    outcome.planId === undefined ||
    outcome.revisionId === undefined ||
    outcome.revisionNumber === undefined ||
    outcome.dashboardUrl === undefined
  ) {
    return undefined;
  }
  return {
    planId: outcome.planId,
    revisionId: outcome.revisionId,
    revisionNumber: outcome.revisionNumber,
    dashboardUrl: outcome.dashboardUrl,
  };
};

const safeFingerprint = (
  value: unknown,
): string | undefined => {
  try {
    return requestFingerprint(value);
  } catch {
    return undefined;
  }
};

const idFailure = <T>(
  operationId: string,
  value: string,
  kind: 'plan' | 'revision' | 'plan_item',
): ApplicationResult<T> => {
  const parsed = brandIdentifier(kind, value);
  return parsed.ok ? invalidReference(operationId) : invalidReference(operationId);
};

const parsePlanId = (
  operationId: string,
  value: string,
): PlanId | ApplicationResult<never> => {
  const result = brandIdentifier('plan', value);
  return result.ok ? result.value : invalidReference(operationId);
};

const parseRevisionId = (
  operationId: string,
  value: string,
): RevisionId | ApplicationResult<never> => {
  const result = brandIdentifier('revision', value);
  return result.ok ? result.value : invalidReference(operationId);
};

const parsePlanItemId = (
  operationId: string,
  value: string,
): PlanItemId | ApplicationResult<never> => {
  const result = brandIdentifier('plan_item', value);
  return result.ok ? result.value : invalidReference(operationId);
};

const isFailureResult = <T>(
  value: T | ApplicationResult<never>,
): value is ApplicationResult<never> =>
  typeof value === 'object' && value !== null && 'outcome' in value;

const mutationDependencies = (
  dependencies: ApplicationDependencies,
): LifecycleDependencies => {
  const base = {
    state: dependencies.state,
    clock: dependencies.clock,
    operationIds: dependencies.operationIds,
  };
  return dependencies.telemetry === undefined
    ? base
    : { ...base, telemetry: dependencies.telemetry };
};

export const createApplication = (
  dependencies: ApplicationDependencies,
): OpenLearnApplication => {
  const origin = dashboardOrigin(dependencies.dashboardOrigin);

  const readPlan = async (
    actor: ActorContext,
    input: GetPlanViewInput,
  ): Promise<ApplicationResult<AcceptedPlanSnapshot>> => {
    const operationId = dependencies.operationIds.next();
    if (!hasCapability(actor, 'plan:read')) {
      return missingCapability(operationId, 'plan:read');
    }

    const planId = parsePlanId(operationId, input.planId);
    if (isFailureResult(planId)) {
      return planId;
    }

    let plan;
    try {
      plan = await dependencies.state.readPlan(planId);
    } catch {
      return applicationFailure(
        { operationId, state: 'failed_retryable' },
        {
          code: 'internal_failure',
          message: 'The plan could not be read. Try again later.',
          retryable: true,
        },
      );
    }
    if (plan === undefined) {
      return unavailable(operationId);
    }

    const snapshot = readOwnedAcceptedSnapshot(plan, actor.ownerId);
    if (!snapshot.ok) {
      const mapped = domainError(snapshot);
      return operationFailure(operationId, mapped.state, mapped.error);
    }
    return applicationSuccess(
      { operationId, state: 'succeeded' },
      snapshot.value,
    );
  };

  const createOrReplacePlan = async (
    actor: ActorContext,
    input: CreatePlanViewInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>> => {
    const operationId = dependencies.operationIds.next();
    if (!hasCapability(actor, 'plan:write')) {
      return missingCapability(operationId, 'plan:write');
    }

    const hasPlanId = input.planId !== undefined;
    const hasExpectedRevision = input.expectedRevisionId !== undefined;
    if (hasPlanId !== hasExpectedRevision) {
      return invalidInput(
        operationId,
        'A replacement requires both planId and expectedRevisionId.',
      );
    }

    const planId = hasPlanId
      ? parsePlanId(operationId, input.planId as string)
      : undefined;
    if (isFailureResult(planId)) {
      return planId;
    }
    const expectedRevisionId = hasExpectedRevision
      ? parseRevisionId(operationId, input.expectedRevisionId as string)
      : undefined;
    if (isFailureResult(expectedRevisionId)) {
      return expectedRevisionId;
    }

    const fingerprint = safeFingerprint({
      kind: hasPlanId ? 'replace_plan_view' : 'create_plan_view',
      planId: input.planId,
      expectedRevisionId: input.expectedRevisionId,
      acceptedAt: input.acceptedAt,
      candidate: input.candidate,
    });
    if (fingerprint === undefined) {
      return invalidInput(operationId, 'The candidate could not be represented safely.');
    }

    const kind = hasPlanId ? 'replace_plan_view' : 'create_plan_view';
    return executeMutation(
      mutationDependencies(dependencies),
      {
        actor,
        kind,
        capability: 'plan:write',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        ...(signal === undefined ? {} : { signal }),
        replay: handoffFromOutcome,
        execute: async (transaction): Promise<MutationExecution<PlanHandoff>> => {
          if (planId === undefined) {
            const created = createPlan({
              ownerId: actor.ownerId,
              candidate: input.candidate,
              allocator: dependencies.allocator,
              acceptedAt: input.acceptedAt as Timestamp,
            });
            if (!created.ok) {
              return domainExecution(created);
            }
            const handoff = handoffFor(created.value, origin);
            await transaction.writePlan(created.value);
            return {
              value: handoff,
              outcome: {
                state: 'succeeded',
                planId: handoff.planId,
                revisionId: handoff.revisionId,
                revisionNumber: handoff.revisionNumber,
                dashboardUrl: handoff.dashboardUrl,
              },
            };
          }

          const current = await transaction.readPlan(planId);
          if (current === undefined) {
            return { outcome: { state: 'rejected', error: {
              code: 'unavailable',
              message: 'The requested plan is not available.',
              retryable: false,
            } } };
          }
          const replaced = replacePlan({
            plan: current,
            ownerId: actor.ownerId,
            expectedRevisionId: expectedRevisionId as RevisionId,
            candidate: input.candidate,
            allocator: dependencies.allocator,
            acceptedAt: input.acceptedAt as Timestamp,
          });
          if (!replaced.ok) {
            return domainExecution(replaced);
          }
          const handoff = handoffFor(replaced.value, origin);
          await transaction.writePlan(replaced.value);
          return {
            value: handoff,
            outcome: {
              state: 'succeeded',
              planId: handoff.planId,
              revisionId: handoff.revisionId,
              revisionNumber: handoff.revisionNumber,
              dashboardUrl: handoff.dashboardUrl,
            },
          };
        },
      },
    );
  };

  const applyProgress = async (
    actor: ActorContext,
    input: ApplyProgressActionInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>> => {
    const operationId = dependencies.operationIds.next();
    if (!hasCapability(actor, 'progress:write')) {
      return missingCapability(operationId, 'progress:write');
    }
    if (!allowedProgressActions.includes(input.action)) {
      return invalidInput(operationId, 'The progress action is not supported.');
    }

    const planId = parsePlanId(operationId, input.planId);
    if (isFailureResult(planId)) return planId;
    const itemId = parsePlanItemId(operationId, input.itemId);
    if (isFailureResult(itemId)) return itemId;
    const revisionId = parseRevisionId(operationId, input.expectedRevisionId);
    if (isFailureResult(revisionId)) return revisionId;

    const fingerprint = safeFingerprint({
      kind: 'apply_progress_action',
      planId: input.planId,
      itemId: input.itemId,
      action: input.action,
      expectedRevisionId: input.expectedRevisionId,
      expectedProgressVersion: input.expectedProgressVersion,
      confirmedAt: input.confirmedAt,
    });
    if (fingerprint === undefined) {
      return invalidInput(operationId, 'The progress request could not be represented safely.');
    }

    return executeMutation(
      mutationDependencies(dependencies),
      {
        actor,
        kind: 'apply_progress_action',
        capability: 'progress:write',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        ...(signal === undefined ? {} : { signal }),
        replay: handoffFromOutcome,
        execute: async (transaction): Promise<MutationExecution<PlanHandoff>> => {
          const current = await transaction.readPlan(planId);
          if (current === undefined) {
            return { outcome: { state: 'rejected', error: {
              code: 'unavailable',
              message: 'The requested plan is not available.',
              retryable: false,
            } } };
          }
          const progressed = applyDomainProgressAction({
            plan: current,
            ownerId: actor.ownerId,
            expectedRevisionId: revisionId as RevisionId,
            itemId: itemId as PlanItemId,
            expectedProgressVersion: input.expectedProgressVersion,
            action: input.action,
            confirmedAt: input.confirmedAt as Timestamp,
          });
          if (!progressed.ok) {
            return domainExecution(progressed);
          }
          const handoff = handoffFor(progressed.value, origin);
          await transaction.writePlan(progressed.value);
          return {
            value: handoff,
            outcome: {
              state: 'succeeded',
              planId: handoff.planId,
              revisionId: handoff.revisionId,
              revisionNumber: handoff.revisionNumber,
              dashboardUrl: handoff.dashboardUrl,
            },
          };
        },
      },
    );
  };

  return {
    createPlanView: createOrReplacePlan,
    getPlanView: readPlan,
    applyProgressAction: applyProgress,
  };
};
