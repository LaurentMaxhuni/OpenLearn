import { fail, succeed, type DomainResult } from './errors.js';
import { progressRecordsBelongToPlan } from './progress.js';
import { validateTimestamp, validateOwnerId } from './revisions.js';
import type {
  ActivePlanAggregate,
  PlanAggregate,
  PlanDeletionTombstone,
  RevisionId,
  Timestamp,
} from './types.js';

export interface DeletePlanCommand {
  readonly plan: PlanAggregate;
  readonly ownerId: import('./types.js').InternalOwnerId;
  readonly expectedRevisionId: RevisionId;
  readonly deletedAt: Timestamp;
  readonly deletionOperationId?: string;
}

const malformedPlan = () =>
  fail('malformed_input', [{ path: 'plan', code: 'invalid_shape' }]);

const deletionConflict = () =>
  fail('deletion_conflict', [
    { path: 'expectedRevisionId', code: 'deletion_conflict' },
  ]);

const planDeleted = () => fail('plan_deleted', [{ code: 'plan_deleted' }]);

const isActivePlan = (
  plan: PlanAggregate,
): plan is ActivePlanAggregate =>
  plan !== null &&
  typeof plan === 'object' &&
  plan.lifecycle === 'active' &&
  plan.currentRevision !== undefined &&
  plan.content !== undefined;

export const deletePlan = (
  command: DeletePlanCommand,
): DomainResult<PlanAggregate> => {
  const ownerResult = validateOwnerId(command.ownerId);
  if (!ownerResult.ok) {
    return ownerResult;
  }

  const plan = command.plan;
  if (plan === null || typeof plan !== 'object') {
    return malformedPlan();
  }
  if (plan.ownerId !== ownerResult.value) {
    return fail('owner_unavailable', [{ code: 'owner_unavailable' }]);
  }
  if (plan.lifecycle === 'deleted') {
    return planDeleted();
  }
  if (!isActivePlan(plan)) {
    return malformedPlan();
  }
  if (!progressRecordsBelongToPlan(plan)) {
    return malformedPlan();
  }

  if (
    typeof command.expectedRevisionId !== 'string' ||
    command.expectedRevisionId !== plan.currentRevision.revisionId
  ) {
    return deletionConflict();
  }

  const deletedAtResult = validateTimestamp(command.deletedAt, 'deletedAt');
  if (!deletedAtResult.ok) {
    return deletedAtResult;
  }

  const tombstone: PlanDeletionTombstone = {
    planId: plan.planId,
    ownerId: plan.ownerId,
    deletedAt: deletedAtResult.value,
    terminalRevision: plan.currentRevision,
  };

  return succeed({
    ownerId: plan.ownerId,
    planId: plan.planId,
    lifecycle: 'deleted',
    progress: [],
    tombstone,
  });
};
