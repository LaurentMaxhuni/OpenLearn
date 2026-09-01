import {
  applyProgressAction,
  brandIdentifier,
  effectiveProgress,
  type ActivePlanAggregate,
  type LearnerAction,
  type Timestamp,
} from '@openlearn/domain';

export type DashboardProgressAction = 'start' | 'complete' | 'undo_completion';

export interface ApplyDashboardProgressActionInput {
  readonly plan: ActivePlanAggregate;
  readonly itemId: string;
  readonly action: DashboardProgressAction;
  readonly confirmedAt: string;
  readonly expectedRevisionId?: string;
  readonly expectedProgressVersion?: number;
}

export type DashboardProgressActionResult =
  | {
      readonly ok: true;
      readonly plan: ActivePlanAggregate;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly kind: 'conflict' | 'unavailable';
      readonly message: string;
    };

const actionFor = (action: DashboardProgressAction): LearnerAction => {
  switch (action) {
    case 'start':
      return 'start_item';
    case 'complete':
      return 'complete_item';
    case 'undo_completion':
      return 'undo_completion';
  }
};

const itemTitleFor = (plan: ActivePlanAggregate, itemId: string): string => {
  for (const milestone of plan.content.milestones) {
    for (const topic of milestone.topics) {
      const item = topic.items.find((candidate) => candidate.itemId === itemId);
      if (item !== undefined) {
        return item.title;
      }
    }
  }
  return 'this learning item';
};

const successMessage = (
  action: DashboardProgressAction,
  title: string,
): string => {
  switch (action) {
    case 'start':
      return `Started “${title}”.`;
    case 'complete':
      return `Marked “${title}” complete.`;
    case 'undo_completion':
      return `Undid completion for “${title}”.`;
  }
};

const failureFor = (
  category: string,
): Extract<DashboardProgressActionResult, { readonly ok: false }> => {
  if (category === 'stale_revision') {
    return {
      ok: false,
      kind: 'conflict',
      message: 'The plan changed. Read the current plan before retrying.',
    };
  }
  if (category === 'stale_progress') {
    return {
      ok: false,
      kind: 'conflict',
      message: 'Progress changed. Read the current item before retrying.',
    };
  }
  return {
    ok: false,
    kind: 'unavailable',
    message: 'This learning item is not available in the current plan.',
  };
};

export const applyDashboardProgressAction = (
  input: ApplyDashboardProgressActionInput,
): DashboardProgressActionResult => {
  const itemId = brandIdentifier('plan_item', input.itemId);
  if (!itemId.ok) {
    return failureFor('invalid_identifier');
  }

  const expectedRevisionId =
    input.expectedRevisionId === undefined
      ? { ok: true as const, value: input.plan.currentRevision.revisionId }
      : brandIdentifier('revision', input.expectedRevisionId);
  if (!expectedRevisionId.ok) {
    return failureFor('invalid_identifier');
  }

  const expectedProgressVersion =
    input.expectedProgressVersion ??
    effectiveProgress(input.plan, itemId.value).progressVersion;
  const result = applyProgressAction({
    plan: input.plan,
    ownerId: input.plan.ownerId,
    expectedRevisionId: expectedRevisionId.value,
    itemId: itemId.value,
    expectedProgressVersion,
    action: actionFor(input.action),
    confirmedAt: input.confirmedAt as Timestamp,
  });

  if (!result.ok) {
    return failureFor(result.category);
  }

  return {
    ok: true,
    plan: result.value,
    message: successMessage(input.action, itemTitleFor(input.plan, itemId.value)),
  };
};
