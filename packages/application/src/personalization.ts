import {
  brandIdentifier,
  changePersonalizationConsent,
  correctLearnerFeedback,
  createPersonalizationState,
  decidePersonalizationProposal,
  deleteLearnerFeedback,
  evaluatePersonalization,
  recordLearnerFeedback,
  validatePersonalizationState,
  type ActivePlanAggregate,
  type DomainFailure,
  type IdentityAllocator,
  type PersonalizationDecision,
  type PersonalizationEvaluation,
  type PersonalizationProposal,
  type PersonalizationState,
  type PlanAggregate,
  type PlanId,
} from '@openlearn/domain';
import { hasCapability, missingCapability } from './authorize.js';
import {
  applicationFailure,
  applicationSuccess,
} from './errors.js';
import type {
  ActorContext,
  ApplicationResult,
  CapabilityScope,
} from './contracts.js';
import type {
  Clock,
  OperationIdGenerator,
  PersonalizationStatePort,
} from './ports.js';

export interface PersonalizationPlanReader {
  readPlan(planId: PlanId): Promise<PlanAggregate | undefined>;
}

export interface PersonalizationApplicationDependencies {
  readonly planReader: PersonalizationPlanReader;
  readonly state: PersonalizationStatePort;
  readonly allocator: IdentityAllocator;
  readonly clock: Clock;
  readonly operationIds: OperationIdGenerator;
}

export interface GetPersonalizationInput {
  readonly planId: string;
}

export interface PersonalizationMutationInput {
  readonly planId: string;
  readonly expectedStateVersion: number;
}

export interface ChangePersonalizationConsentInput
  extends PersonalizationMutationInput {
  readonly action: 'enable' | 'pause' | 'resume' | 'revoke';
}

export interface RecordLearnerFeedbackInput
  extends PersonalizationMutationInput {
  readonly itemId?: string;
  readonly area: string;
  readonly value: string;
}

export interface CorrectLearnerFeedbackInput
  extends PersonalizationMutationInput {
  readonly feedbackId: string;
  readonly area: string;
  readonly value: string;
}

export interface DeleteLearnerFeedbackInput
  extends PersonalizationMutationInput {
  readonly feedbackId: string;
}

export interface EvaluatePersonalizationInput
  extends PersonalizationMutationInput {}

export interface ListPersonalizationProposalsInput {
  readonly planId: string;
}

export interface PurgePersonalizationInput {
  readonly planId: string;
  readonly expectedStateVersion?: number;
}

export interface DecidePersonalizationProposalInput
  extends PersonalizationMutationInput {
  readonly proposalId: string;
  readonly decision: 'accept' | 'reject';
  readonly expectedProposalVersion: number;
}

export interface PersonalizationApplication {
  getPersonalization(
    actor: ActorContext,
    input: GetPersonalizationInput,
  ): Promise<ApplicationResult<PersonalizationState>>;
  changePersonalizationConsent(
    actor: ActorContext,
    input: ChangePersonalizationConsentInput,
  ): Promise<ApplicationResult<PersonalizationState>>;
  recordLearnerFeedback(
    actor: ActorContext,
    input: RecordLearnerFeedbackInput,
  ): Promise<ApplicationResult<import('@openlearn/domain').LearnerFeedback>>;
  correctLearnerFeedback(
    actor: ActorContext,
    input: CorrectLearnerFeedbackInput,
  ): Promise<ApplicationResult<import('@openlearn/domain').LearnerFeedback>>;
  deleteLearnerFeedback(
    actor: ActorContext,
    input: DeleteLearnerFeedbackInput,
  ): Promise<ApplicationResult<PersonalizationState>>;
  evaluatePersonalization(
    actor: ActorContext,
    input: EvaluatePersonalizationInput,
  ): Promise<ApplicationResult<PersonalizationEvaluation>>;
  listPersonalizationProposals(
    actor: ActorContext,
    input: ListPersonalizationProposalsInput,
  ): Promise<ApplicationResult<readonly PersonalizationProposal[]>>;
  purgePersonalization(
    actor: ActorContext,
    input: PurgePersonalizationInput,
  ): Promise<ApplicationResult<void>>;
  decidePersonalizationProposal(
    actor: ActorContext,
    input: DecidePersonalizationProposalInput,
  ): Promise<ApplicationResult<PersonalizationDecision>>;
}

type LoadedState = {
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
};

const isApplicationResult = <T>(
  value: LoadedState | ApplicationResult<T>,
): value is ApplicationResult<T> =>
  typeof value === 'object' && value !== null && 'outcome' in value;

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

const internalFailure = <T>(operationId: string): ApplicationResult<T> =>
  applicationFailure(
    { operationId, state: 'failed_retryable' },
    {
      code: 'internal_failure',
      message: 'Personalization state could not be read or saved. Try again later.',
      retryable: true,
    },
  );

const conflict = <T>(
  operationId: string,
  code: 'stale_personalization' | 'stale_revision',
  message: string,
): ApplicationResult<T> =>
  applicationFailure(
    { operationId, state: 'conflict' },
    { code, message, retryable: true },
  );

const domainError = <T>(
  operationId: string,
  failure: DomainFailure,
): ApplicationResult<T> => {
  switch (failure.category) {
    case 'owner_unavailable':
    case 'plan_deleted':
      return unavailable(operationId);
    case 'stale_revision':
      return conflict(
        operationId,
        'stale_revision',
        'The plan changed. Refresh before using this suggestion.',
      );
    case 'stale_personalization':
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    default:
      return applicationFailure(
        { operationId, state: 'rejected' },
        {
          code: 'domain_rejected',
          message: 'The personalization request did not pass validation.',
          retryable: false,
        },
      );
  }
};

const parsePlanId = <T>(
  operationId: string,
  value: unknown,
): PlanId | ApplicationResult<T> => {
  if (typeof value !== 'string') {
    return invalidReference(operationId);
  }
  const result = brandIdentifier('plan', value);
  return result.ok ? result.value : invalidReference(operationId);
};

const nowTimestamp = (clock: Clock): string | undefined => {
  const value = clock.now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return undefined;
  }
  return value.toISOString();
};

const expectedVersion = <T>(
  operationId: string,
  value: number,
): ApplicationResult<T> | number =>
  Number.isSafeInteger(value) && value >= 0
    ? value
    : invalidInput(operationId, 'The expected personalization version is invalid.');

const readLoaded = async <T>(
  dependencies: PersonalizationApplicationDependencies,
  actor: ActorContext,
  planIdValue: string,
  operationId: string,
): Promise<LoadedState | ApplicationResult<T>> => {
  const planId = parsePlanId<T>(operationId, planIdValue);
  if (typeof planId !== 'string') {
    return planId;
  }
  let plan: PlanAggregate | undefined;
  try {
    plan = await dependencies.planReader.readPlan(planId);
  } catch {
    return internalFailure(operationId);
  }
  if (
    plan === undefined ||
    plan.lifecycle !== 'active' ||
    plan.ownerId !== actor.ownerId
  ) {
    return unavailable(operationId);
  }

  let state: PersonalizationState | undefined;
  try {
    state = await dependencies.state.readPersonalization(actor.ownerId, planId);
  } catch {
    return internalFailure(operationId);
  }
  if (state !== undefined) {
    try {
      const validated = validatePersonalizationState(state);
      if (!validated.ok) {
        return internalFailure(operationId);
      }
      if (validated.value.ownerId !== actor.ownerId || validated.value.planId !== planId) {
        return unavailable(operationId);
      }
      return { plan, state: validated.value };
    } catch {
      return internalFailure(operationId);
    }
  }
  const now = nowTimestamp(dependencies.clock);
  if (now === undefined) {
    return internalFailure(operationId);
  }
  const created = createPersonalizationState({
    ownerId: actor.ownerId,
    planId,
    now,
  });
  return created.ok
    ? { plan, state: created.value }
    : domainError(operationId, created);
};

const saveState = async <T>(
  dependencies: PersonalizationApplicationDependencies,
  loaded: LoadedState,
  nextState: PersonalizationState,
  operationId: string,
  value: T,
): Promise<ApplicationResult<T>> => {
  if (nextState.stateVersion === loaded.state.stateVersion) {
    return applicationSuccess(
      { operationId, state: 'succeeded' },
      value,
    );
  }
  let result;
  try {
    result = await dependencies.state.writePersonalization(
      nextState,
      loaded.state.stateVersion,
    );
  } catch {
    return internalFailure(operationId);
  }
  if (!result.ok) {
    return result.kind === 'conflict'
      ? conflict(
          operationId,
          'stale_personalization',
          'Personalization changed elsewhere. Refresh before trying again.',
        )
      : internalFailure(operationId);
  }
  return applicationSuccess(
    { operationId, state: 'succeeded' },
    value,
  );
};

const requireCapability = <T>(
  actor: ActorContext,
  operationId: string,
  capability: CapabilityScope,
): ApplicationResult<T> | undefined =>
  hasCapability(actor, capability)
    ? undefined
    : missingCapability(operationId, capability);

export const createPersonalizationApplication = (
  dependencies: PersonalizationApplicationDependencies,
): PersonalizationApplication => {
  const getPersonalization = async (
    actor: ActorContext,
    input: GetPersonalizationInput,
  ): Promise<ApplicationResult<PersonalizationState>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<PersonalizationState>(actor, operationId, 'personalization:read');
    if (missing !== undefined) {
      return missing;
    }
    const loaded = await readLoaded<PersonalizationState>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<PersonalizationState>(loaded)) {
      return loaded;
    }
    return applicationSuccess(
      { operationId, state: 'succeeded' },
      loaded.state,
    );
  };

  const mutateConsent = async (
    actor: ActorContext,
    input: ChangePersonalizationConsentInput,
  ): Promise<ApplicationResult<PersonalizationState>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<PersonalizationState>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expected = expectedVersion<PersonalizationState>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expected !== 'number') {
      return expected;
    }
    const loaded = await readLoaded<PersonalizationState>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<PersonalizationState>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expected) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const now = nowTimestamp(dependencies.clock);
    if (now === undefined) {
      return internalFailure(operationId);
    }
    const changed = changePersonalizationConsent({
      state: loaded.state,
      action: input.action,
      now,
    });
    if (!changed.ok) {
      return domainError(operationId, changed);
    }
    return saveState(dependencies, loaded, changed.value, operationId, changed.value);
  };

  const recordFeedback = async (
    actor: ActorContext,
    input: RecordLearnerFeedbackInput,
  ): Promise<ApplicationResult<import('@openlearn/domain').LearnerFeedback>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<import('@openlearn/domain').LearnerFeedback>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expected = expectedVersion<import('@openlearn/domain').LearnerFeedback>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expected !== 'number') {
      return expected;
    }
    const loaded = await readLoaded<import('@openlearn/domain').LearnerFeedback>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<import('@openlearn/domain').LearnerFeedback>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expected) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const recordedAt = nowTimestamp(dependencies.clock);
    if (recordedAt === undefined) {
      return internalFailure(operationId);
    }
    const recorded = recordLearnerFeedback({
      plan: loaded.plan,
      state: loaded.state,
      ownerId: actor.ownerId,
      ...(input.itemId === undefined ? {} : { itemId: input.itemId }),
      area: input.area,
      value: input.value,
      recordedAt,
      allocator: dependencies.allocator,
    });
    if (!recorded.ok) {
      return domainError(operationId, recorded);
    }
    return saveState(
      dependencies,
      loaded,
      recorded.value.state,
      operationId,
      recorded.value.feedback,
    );
  };

  const correctFeedback = async (
    actor: ActorContext,
    input: CorrectLearnerFeedbackInput,
  ): Promise<ApplicationResult<import('@openlearn/domain').LearnerFeedback>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<import('@openlearn/domain').LearnerFeedback>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expected = expectedVersion<import('@openlearn/domain').LearnerFeedback>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expected !== 'number') {
      return expected;
    }
    const loaded = await readLoaded<import('@openlearn/domain').LearnerFeedback>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<import('@openlearn/domain').LearnerFeedback>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expected) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const recordedAt = nowTimestamp(dependencies.clock);
    if (recordedAt === undefined) {
      return internalFailure(operationId);
    }
    const corrected = correctLearnerFeedback({
      plan: loaded.plan,
      state: loaded.state,
      ownerId: actor.ownerId,
      feedbackId: input.feedbackId,
      area: input.area,
      value: input.value,
      recordedAt,
      allocator: dependencies.allocator,
    });
    if (!corrected.ok) {
      return domainError(operationId, corrected);
    }
    return saveState(
      dependencies,
      loaded,
      corrected.value.state,
      operationId,
      corrected.value.feedback,
    );
  };

  const deleteFeedback = async (
    actor: ActorContext,
    input: DeleteLearnerFeedbackInput,
  ): Promise<ApplicationResult<PersonalizationState>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<PersonalizationState>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expected = expectedVersion<PersonalizationState>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expected !== 'number') {
      return expected;
    }
    const loaded = await readLoaded<PersonalizationState>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<PersonalizationState>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expected) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const deletedAt = nowTimestamp(dependencies.clock);
    if (deletedAt === undefined) {
      return internalFailure(operationId);
    }
    const deleted = deleteLearnerFeedback({
      plan: loaded.plan,
      state: loaded.state,
      ownerId: actor.ownerId,
      feedbackId: input.feedbackId,
      now: deletedAt,
    });
    if (!deleted.ok) {
      return domainError(operationId, deleted);
    }
    return saveState(dependencies, loaded, deleted.value, operationId, deleted.value);
  };

  const evaluate = async (
    actor: ActorContext,
    input: EvaluatePersonalizationInput,
  ): Promise<ApplicationResult<PersonalizationEvaluation>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<PersonalizationEvaluation>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expected = expectedVersion<PersonalizationEvaluation>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expected !== 'number') {
      return expected;
    }
    const loaded = await readLoaded<PersonalizationEvaluation>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<PersonalizationEvaluation>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expected) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const now = nowTimestamp(dependencies.clock);
    if (now === undefined) {
      return internalFailure(operationId);
    }
    const evaluated = evaluatePersonalization({
      plan: loaded.plan,
      state: loaded.state,
      ownerId: actor.ownerId,
      now,
      allocator: dependencies.allocator,
    });
    if (!evaluated.ok) {
      return domainError(operationId, evaluated);
    }
    return saveState(
      dependencies,
      loaded,
      evaluated.value.state,
      operationId,
      evaluated.value,
    );
  };

  const listProposals = async (
    actor: ActorContext,
    input: ListPersonalizationProposalsInput,
  ): Promise<ApplicationResult<readonly PersonalizationProposal[]>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<readonly PersonalizationProposal[]>(actor, operationId, 'personalization:read');
    if (missing !== undefined) {
      return missing;
    }
    const loaded = await readLoaded<readonly PersonalizationProposal[]>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<readonly PersonalizationProposal[]>(loaded)) {
      return loaded;
    }
    const proposals = loaded.state.proposals.filter(
      (proposal) =>
        proposal.ownerId === loaded.state.ownerId &&
        proposal.planId === loaded.state.planId &&
        proposal.consentVersion === loaded.state.consent.consentVersion &&
        proposal.sourceRevisionId === loaded.plan.currentRevision.revisionId,
    );
    return applicationSuccess({ operationId, state: 'succeeded' }, proposals);
  };

  const purge = async (
    actor: ActorContext,
    input: PurgePersonalizationInput,
  ): Promise<ApplicationResult<void>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<void>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const planId = parsePlanId<void>(operationId, input.planId);
    if (typeof planId !== 'string') {
      return planId;
    }
    const expected =
      input.expectedStateVersion === undefined
        ? undefined
        : expectedVersion<void>(operationId, input.expectedStateVersion);
    if (expected !== undefined && typeof expected !== 'number') {
      return expected;
    }
    let result;
    try {
      result = await dependencies.state.purgePersonalization(
        actor.ownerId,
        planId,
        expected as number | undefined,
      );
    } catch {
      return internalFailure(operationId);
    }
    if (!result.ok) {
      return result.kind === 'conflict'
        ? conflict(
            operationId,
            'stale_personalization',
            'Personalization changed elsewhere. Refresh before trying again.',
          )
        : internalFailure(operationId);
    }
    return applicationSuccess({ operationId, state: 'succeeded' }, undefined);
  };

  const decideProposal = async (
    actor: ActorContext,
    input: DecidePersonalizationProposalInput,
  ): Promise<ApplicationResult<PersonalizationDecision>> => {
    const operationId = dependencies.operationIds.next();
    const missing = requireCapability<PersonalizationDecision>(actor, operationId, 'personalization:write');
    if (missing !== undefined) {
      return missing;
    }
    const expectedState = expectedVersion<PersonalizationDecision>(
      operationId,
      input.expectedStateVersion,
    );
    if (typeof expectedState !== 'number') {
      return expectedState;
    }
    const expectedProposal = expectedVersion<PersonalizationDecision>(
      operationId,
      input.expectedProposalVersion,
    );
    if (typeof expectedProposal !== 'number' || expectedProposal === 0) {
      return typeof expectedProposal === 'number'
        ? invalidInput(operationId, 'The expected proposal version is invalid.')
        : expectedProposal;
    }
    const loaded = await readLoaded<PersonalizationDecision>(
      dependencies,
      actor,
      input.planId,
      operationId,
    );
    if (isApplicationResult<PersonalizationDecision>(loaded)) {
      return loaded;
    }
    if (loaded.state.stateVersion !== expectedState) {
      return conflict(
        operationId,
        'stale_personalization',
        'Personalization changed elsewhere. Refresh before trying again.',
      );
    }
    const now = nowTimestamp(dependencies.clock);
    if (now === undefined) {
      return internalFailure(operationId);
    }
    const decided = decidePersonalizationProposal({
      plan: loaded.plan,
      state: loaded.state,
      ownerId: actor.ownerId,
      proposalId: input.proposalId,
      decision: input.decision,
      expectedProposalVersion: expectedProposal,
      now,
    });
    if (!decided.ok) {
      return domainError(operationId, decided);
    }
    return saveState(
      dependencies,
      loaded,
      decided.value.state,
      operationId,
      decided.value,
    );
  };

  return {
    getPersonalization,
    changePersonalizationConsent: mutateConsent,
    recordLearnerFeedback: recordFeedback,
    correctLearnerFeedback: correctFeedback,
    deleteLearnerFeedback: deleteFeedback,
    evaluatePersonalization: evaluate,
    listPersonalizationProposals: listProposals,
    purgePersonalization: purge,
    decidePersonalizationProposal: decideProposal,
  };
};
