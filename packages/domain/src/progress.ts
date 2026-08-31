import { fail, succeed, type DomainResult } from './errors.js';
import { brandIdentifier } from './identity.js';
import { validateTimestamp, validateOwnerId } from './revisions.js';
import type {
  ActivePlanAggregate,
  LearnerProgressRecord,
  NonCompleteProgressState,
  PlanAggregate,
  PlanItemId,
  ProgressState,
} from './types.js';

export type LearnerAction =
  | 'start_item'
  | 'complete_item'
  | 'undo_completion';

export interface ProgressCommand {
  readonly plan: PlanAggregate;
  readonly ownerId: import('./types.js').InternalOwnerId;
  readonly expectedRevisionId: import('./types.js').RevisionId;
  readonly itemId: PlanItemId;
  readonly expectedProgressVersion: number;
  readonly action: LearnerAction;
  readonly confirmedAt: import('./types.js').Timestamp;
}

const malformed = (path: string) =>
  fail('malformed_input', [{ path, code: 'invalid_shape' }]);

const staleRevision = () =>
  fail('stale_revision', [{ code: 'stale_revision' }]);

const invalidTransition = () =>
  fail('invalid_transition', [{ code: 'transition_not_allowed' }]);

const invalidRelationship = () =>
  fail('invalid_relationship', [
    { path: 'itemId', code: 'relationship_mismatch' },
  ]);

const deletedPlan = () => fail('plan_deleted', [{ code: 'plan_deleted' }]);

const isActivePlan = (
  plan: PlanAggregate,
): plan is ActivePlanAggregate =>
  plan !== null &&
  typeof plan === 'object' &&
  plan.lifecycle === 'active' &&
  plan.currentRevision !== undefined &&
  plan.content !== undefined;

const currentItemIds = (plan: ActivePlanAggregate): ReadonlySet<PlanItemId> => {
  const ids = new Set<PlanItemId>();
  for (const milestone of plan.content.milestones) {
    for (const topic of milestone.topics) {
      for (const item of topic.items) {
        ids.add(item.itemId);
      }
    }
  }
  return ids;
};

export const progressRecordsBelongToPlan = (
  plan: ActivePlanAggregate,
): boolean =>
  plan.progress.every(
    (record) =>
      record.ownerId === plan.ownerId && record.planId === plan.planId,
  );

const defaultProgress = (
  plan: ActivePlanAggregate,
  itemId: PlanItemId,
): LearnerProgressRecord => ({
  ownerId: plan.ownerId,
  planId: plan.planId,
  itemId,
  state: 'not_started',
  progressVersion: 0,
  lastConfirmedAt: plan.currentRevision.acceptedAt,
});

export const effectiveProgress = (
  plan: ActivePlanAggregate,
  itemId: PlanItemId,
): LearnerProgressRecord => {
  if (!currentItemIds(plan).has(itemId)) {
    return defaultProgress(plan, itemId);
  }

  return (
    plan.progress.find(
      (record) =>
        record.ownerId === plan.ownerId &&
        record.planId === plan.planId &&
        record.itemId === itemId,
    ) ??
    defaultProgress(plan, itemId)
  );
};

const validateItemId = (value: unknown): DomainResult<PlanItemId> => {
  if (typeof value !== 'string') {
    return fail('malformed_input', [{ path: 'itemId', code: 'wrong_type' }]);
  }

  const result = brandIdentifier('plan_item', value);
  if (!result.ok) {
    const firstDetail = result.details[0];
    return fail('invalid_identifier', [
      {
        path: 'itemId',
        code: firstDetail?.code ?? 'invalid_syntax',
        identifierKind: 'plan_item',
        ...(firstDetail?.limit === undefined ? {} : { limit: firstDetail.limit }),
      },
    ]);
  }

  return result;
};

const validateExpectedVersion = (
  value: unknown,
): DomainResult<number> => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return fail('malformed_input', [
      { path: 'expectedProgressVersion', code: 'invalid_shape' },
    ]);
  }

  return succeed(value);
};

const isLearnerAction = (value: unknown): value is LearnerAction =>
  value === 'start_item' ||
  value === 'complete_item' ||
  value === 'undo_completion';

const makeNextRecord = (
  current: LearnerProgressRecord,
  state: ProgressState,
  confirmedAt: import('./types.js').Timestamp,
): LearnerProgressRecord => {
  const base = {
    ownerId: current.ownerId,
    planId: current.planId,
    itemId: current.itemId,
    progressVersion: current.progressVersion + 1,
    lastConfirmedAt: confirmedAt,
  };

  if (state === 'completed_by_learner') {
    const lastNonCompleteState: NonCompleteProgressState =
      current.state === 'completed_by_learner'
        ? current.lastNonCompleteState ?? 'not_started'
        : current.state;
    return {
      ...base,
      state,
      lastNonCompleteState,
    };
  }

  return { ...base, state };
};

export const applyProgressAction = (
  command: ProgressCommand,
): DomainResult<ActivePlanAggregate> => {
  const ownerResult = validateOwnerId(command.ownerId);
  if (!ownerResult.ok) {
    return ownerResult;
  }

  const plan = command.plan;
  if (plan === null || typeof plan !== 'object') {
    return malformed('plan');
  }
  if (plan.ownerId !== ownerResult.value) {
    return fail('owner_unavailable', [{ code: 'owner_unavailable' }]);
  }
  if (plan.lifecycle === 'deleted') {
    return deletedPlan();
  }
  if (!isActivePlan(plan)) {
    return malformed('plan');
  }
  if (!progressRecordsBelongToPlan(plan)) {
    return malformed('plan');
  }

  if (command.expectedRevisionId !== plan.currentRevision.revisionId) {
    return staleRevision();
  }

  const itemIdResult = validateItemId(command.itemId);
  if (!itemIdResult.ok) {
    return itemIdResult;
  }
  const itemId = itemIdResult.value;
  if (!currentItemIds(plan).has(itemId)) {
    return invalidRelationship();
  }

  const expectedVersionResult = validateExpectedVersion(
    command.expectedProgressVersion,
  );
  if (!expectedVersionResult.ok) {
    return expectedVersionResult;
  }

  if (!isLearnerAction(command.action)) {
    return malformed('action');
  }

  const confirmedAtResult = validateTimestamp(
    command.confirmedAt,
    'confirmedAt',
  );
  if (!confirmedAtResult.ok) {
    return confirmedAtResult;
  }

  const current = effectiveProgress(plan, itemId);
  if (expectedVersionResult.value !== current.progressVersion) {
    return fail('stale_progress', [
      {
        path: 'expectedProgressVersion',
        code: 'stale_progress',
        expectedVersion: expectedVersionResult.value,
        actualVersion: current.progressVersion,
      },
    ]);
  }

  let nextState: ProgressState;
  switch (command.action) {
    case 'start_item':
      if (current.state !== 'not_started') {
        return invalidTransition();
      }
      nextState = 'in_progress';
      break;
    case 'complete_item':
      if (current.state === 'completed_by_learner') {
        return invalidTransition();
      }
      nextState = 'completed_by_learner';
      break;
    case 'undo_completion':
      if (current.state !== 'completed_by_learner') {
        return invalidTransition();
      }
      nextState = current.lastNonCompleteState ?? 'not_started';
      break;
  }

  const nextRecord = makeNextRecord(
    current,
    nextState,
    confirmedAtResult.value,
  );
  const existingIndex = plan.progress.findIndex(
    (record) => record.itemId === itemId,
  );
  const nextProgress =
    existingIndex === -1
      ? [...plan.progress, nextRecord]
      : plan.progress.map((record, index) =>
          index === existingIndex ? nextRecord : record,
        );

  return succeed({ ...plan, progress: nextProgress });
};
