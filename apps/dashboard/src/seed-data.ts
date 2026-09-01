import {
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
  acceptedPartialFixture,
  brandIdentifier,
  readOwnedAcceptedSnapshot,
  type ActivePlanAggregate,
  type InternalOwnerId,
  type PlanId,
} from '@openlearn/domain';
import type { AcceptedPlanSnapshotInput } from './view-model.js';

export type StaticPreviewState =
  | 'accepted'
  | 'partial'
  | 'completed'
  | 'empty'
  | 'loading'
  | 'invalid'
  | 'retryable'
  | 'pending'
  | 'recovering'
  | 'conflict';

export const STATIC_PREVIEW_OPTIONS: readonly {
  readonly value: StaticPreviewState;
  readonly label: string;
}[] = [
  { value: 'accepted', label: 'Accepted plan' },
  { value: 'partial', label: 'Partial plan' },
  { value: 'completed', label: 'Progress in motion' },
  { value: 'empty', label: 'Empty workspace' },
  { value: 'loading', label: 'Loading state' },
  { value: 'invalid', label: 'Invalid update' },
  { value: 'retryable', label: 'Retryable error' },
  { value: 'pending', label: 'Pending update' },
  { value: 'recovering', label: 'Recovering update' },
  { value: 'conflict', label: 'Progress conflict' },
];

const expectIdentifier = (value: string): PlanId => {
  const result = brandIdentifier('plan', value);
  if (!result.ok) {
    throw new Error(`invalid static plan id: ${result.category}`);
  }
  return result.value;
};

const rekeyPlan = (plan: ActivePlanAggregate, planIdValue: string): ActivePlanAggregate => {
  const planId = expectIdentifier(planIdValue);
  return {
    ...plan,
    planId,
    progress: plan.progress.map((record) => ({ ...record, planId })),
  };
};

export const snapshotOfPlan = (
  plan: ActivePlanAggregate,
  ownerId: InternalOwnerId = plan.ownerId,
): AcceptedPlanSnapshotInput => {
  const result = readOwnedAcceptedSnapshot(plan, ownerId);
  if (!result.ok) {
    throw new Error(`invalid static snapshot: ${result.category}`);
  }
  return result.value as AcceptedPlanSnapshotInput;
};

const snapshotOf = (
  plan: ActivePlanAggregate,
  ownerId: InternalOwnerId = plan.ownerId,
): AcceptedPlanSnapshotInput => {
  return snapshotOfPlan(plan, ownerId);
};

const noProgressPlan = rekeyPlan(
  acceptedNoProgressFixture(),
  'static-plan-foundations',
);
const partialPlan = rekeyPlan(
  acceptedPartialFixture(),
  'static-plan-partial',
);
const progressPlan = rekeyPlan(
  acceptedCompleteFixture(),
  'static-plan-progress',
);

export const STATIC_OWNER = noProgressPlan.ownerId;

export const STATIC_PLANS: readonly ActivePlanAggregate[] = [
  noProgressPlan,
  partialPlan,
  progressPlan,
];

export const STATIC_SNAPSHOTS: readonly AcceptedPlanSnapshotInput[] = STATIC_PLANS.map((plan) =>
  snapshotOf(plan, STATIC_OWNER),
);

export const STATIC_SNAPSHOT_BY_ID = new Map(
  STATIC_SNAPSHOTS.map((snapshot) => [snapshot.planId, snapshot]),
);

export const STATIC_PLAN_BY_ID = new Map(
  STATIC_PLANS.map((plan) => [plan.planId, plan]),
);

export const firstStaticPlan = (): AcceptedPlanSnapshotInput => {
  const first = STATIC_SNAPSHOTS[0];
  if (first === undefined) {
    throw new Error('expected static plan fixture');
  }
  return first;
};
