import { fail, succeed, type DomainResult } from './errors.js';
import {
  effectiveProgress,
  progressRecordsBelongToPlan,
} from './progress.js';
import { validateOwnerId } from './revisions.js';
import type {
  ActivePlanAggregate,
  CanonicalPlanContent,
  LearnerProgressRecord,
  PlanAggregate,
  PlanItemId,
} from './types.js';

export interface ProgressSummary {
  readonly totalCount: number;
  readonly completedCount: number;
  readonly inProgressCount: number;
  readonly notStartedCount: number;
  readonly remainingCount: number;
}

export interface AcceptedPlanSnapshot {
  readonly planId: import('./types.js').PlanId;
  readonly revisionId: import('./types.js').RevisionId;
  readonly revisionNumber: number;
  readonly acceptedAt: import('./types.js').Timestamp;
  readonly content: CanonicalPlanContent;
  readonly missingOptionalPaths: readonly string[];
  readonly currentProgress: readonly LearnerProgressRecord[];
  readonly progressSummary: ProgressSummary;
  readonly nextItemId?: PlanItemId;
}

const unavailableOwner = () =>
  fail('owner_unavailable', [{ code: 'owner_unavailable' }]);

const deletedPlan = () => fail('plan_deleted', [{ code: 'plan_deleted' }]);

const malformedPlan = () =>
  fail('malformed_input', [{ path: 'plan', code: 'invalid_shape' }]);

const isActivePlan = (
  plan: PlanAggregate,
): plan is ActivePlanAggregate =>
  plan !== null &&
  typeof plan === 'object' &&
  plan.lifecycle === 'active' &&
  plan.currentRevision !== undefined &&
  plan.content !== undefined;

const currentItems = (plan: ActivePlanAggregate) =>
  plan.content.milestones.flatMap((milestone) =>
    milestone.topics.flatMap((topic) => topic.items),
  );

export const readOwnedAcceptedSnapshot = (
  plan: PlanAggregate,
  ownerId: import('./types.js').InternalOwnerId,
): DomainResult<AcceptedPlanSnapshot> => {
  const ownerResult = validateOwnerId(ownerId);
  if (!ownerResult.ok) {
    return unavailableOwner();
  }
  if (plan === null || typeof plan !== 'object') {
    return malformedPlan();
  }
  if (plan.ownerId !== ownerResult.value) {
    return unavailableOwner();
  }
  if (plan.lifecycle === 'deleted') {
    return deletedPlan();
  }
  if (!isActivePlan(plan)) {
    return malformedPlan();
  }
  if (!progressRecordsBelongToPlan(plan)) {
    return malformedPlan();
  }

  const items = currentItems(plan);
  const currentProgress = items.map((item) => effectiveProgress(plan, item.itemId));
  const completedCount = currentProgress.filter(
    (record) => record.state === 'completed_by_learner',
  ).length;
  const inProgressCount = currentProgress.filter(
    (record) => record.state === 'in_progress',
  ).length;
  const notStartedCount = currentProgress.filter(
    (record) => record.state === 'not_started',
  ).length;
  const nextItem = currentProgress.find(
    (record) => record.state !== 'completed_by_learner',
  );
  const { missingOptionalPaths, ...content } = plan.content;

  return succeed({
    planId: plan.planId,
    revisionId: plan.currentRevision.revisionId,
    revisionNumber: plan.currentRevision.revisionNumber,
    acceptedAt: plan.currentRevision.acceptedAt,
    content,
    missingOptionalPaths,
    currentProgress,
    progressSummary: {
      totalCount: items.length,
      completedCount,
      inProgressCount,
      notStartedCount,
      remainingCount: items.length - completedCount,
    },
    ...(nextItem === undefined ? {} : { nextItemId: nextItem.itemId }),
  });
};
