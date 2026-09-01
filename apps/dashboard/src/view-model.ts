import type {
  ContentState,
  ContextViewModel,
  GoalViewModel,
  LearnerActionState,
  LearnerActionViewModel,
  LearnerProgressState,
  NextActionViewModel,
  OutlineNodeViewModel,
  PlanDataControlsViewModel,
  PlanDetailViewModel,
  PlanItemViewModel,
  PlanListViewModel,
  PlanSummaryViewModel,
  ProgressSummaryViewModel,
  ResourceViewModel,
  TrustViewModel,
} from '@openlearn/ui';

export interface AcceptedPlanSnapshotInput {
  readonly planId: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly acceptedAt: string;
  readonly content: {
    readonly title?: string;
    readonly goal: {
      readonly goalId: string;
      readonly title: string;
      readonly description?: string;
    };
    readonly context?: {
      readonly summary?: string;
      readonly entries?: readonly {
        readonly entryId: string;
        readonly label: string;
        readonly value: string;
      }[];
    };
    readonly milestones: readonly {
      readonly milestoneId: string;
      readonly title: string;
      readonly description?: string;
      readonly topics: readonly {
        readonly topicId: string;
        readonly title: string;
        readonly description?: string;
        readonly items: readonly {
          readonly itemId: string;
          readonly title: string;
          readonly description?: string;
          readonly resources?: readonly {
            readonly resourceId: string;
            readonly label: string;
            readonly href?: string;
            readonly opaqueReference?: string;
          }[];
        }[];
      }[];
    }[];
  };
  readonly missingOptionalPaths: readonly string[];
  readonly currentProgress: readonly {
    readonly itemId: string;
    readonly state: LearnerProgressState;
  }[];
  readonly progressSummary: {
    readonly totalCount: number;
    readonly completedCount: number;
    readonly inProgressCount: number;
    readonly notStartedCount: number;
    readonly remainingCount: number;
  };
  readonly nextItemId?: string;
}

export interface ViewModelOptions {
  readonly href: string;
  readonly focusedItemId?: string;
  readonly contentState?: ContentState;
  readonly actionStates?: Readonly<Record<string, LearnerActionState>>;
  readonly progressMessage?: string;
  readonly operation?: PlanDetailViewModel['operation'];
  readonly recovery?: PlanDetailViewModel['recovery'];
  readonly dataControls?: PlanDataControlsViewModel;
}

export interface ListSnapshotEntry {
  readonly snapshot: AcceptedPlanSnapshotInput;
  readonly href: string;
  readonly contentState?: ContentState;
}

const trustFor = (state: ContentState): TrustViewModel => {
  switch (state) {
    case 'accepted':
      return {
        label: 'Plan accepted',
        detail: 'Validated learning content is ready to explore.',
        tone: 'success',
      };
    case 'partial':
      return {
        label: 'Plan accepted with some details missing',
        detail: 'The available structure is ready to use; missing optional details are not being invented.',
        tone: 'warning',
      };
    case 'pending':
      return {
        label: 'A plan update is being prepared',
        detail: 'Your current plan remains available while the update is unresolved.',
        tone: 'warning',
      };
    case 'recovering':
      return {
        label: 'We’re checking whether the update completed',
        detail: 'Your current plan remains available while recovery finishes.',
        tone: 'info',
      };
    case 'invalid':
      return {
        label: 'This plan update needs attention',
        detail: 'The submitted update was not accepted. The last accepted plan remains available.',
        tone: 'danger',
      };
    case 'retryable':
      return {
        label: 'This plan update can be retried',
        detail: 'No replacement was committed, so the last accepted plan remains available.',
        tone: 'warning',
      };
    case 'cancelled':
      return {
        label: 'The plan update was cancelled',
        detail: 'The last accepted plan remains available.',
        tone: 'info',
      };
    case 'expired':
      return {
        label: 'The plan update expired',
        detail: 'The last accepted plan remains available for you to continue.',
        tone: 'info',
      };
    case 'conflict':
      return {
        label: 'This plan changed',
        detail: 'Refresh before trying another update. The current accepted plan remains available.',
        tone: 'warning',
      };
    case 'interrupted':
      return {
        label: 'The plan update was interrupted',
        detail: 'The last accepted plan remains available while the outcome is checked.',
        tone: 'info',
      };
  }
};

const progressLabel = (completedCount: number, totalCount: number): string =>
  completedCount === 0
    ? 'No learner-confirmed items yet'
    : `${completedCount} of ${totalCount} items completed by you`;

const toProgress = (
  snapshot: AcceptedPlanSnapshotInput,
): ProgressSummaryViewModel => ({
  completedCount: snapshot.progressSummary.completedCount,
  totalCount: snapshot.progressSummary.totalCount,
  inProgressCount: snapshot.progressSummary.inProgressCount,
  notStartedCount: snapshot.progressSummary.notStartedCount,
  label: progressLabel(
    snapshot.progressSummary.completedCount,
    snapshot.progressSummary.totalCount,
  ),
  learnerConfirmed:
    snapshot.progressSummary.completedCount > 0 ||
    snapshot.progressSummary.inProgressCount > 0,
});

const toResource = (resource: {
  readonly resourceId: string;
  readonly label: string;
  readonly href?: string;
  readonly opaqueReference?: string;
}): ResourceViewModel => ({
  resourceId: resource.resourceId,
  label: resource.label,
  ...(resource.href === undefined ? {} : { href: resource.href }),
  ...(resource.opaqueReference === undefined
    ? {}
    : { opaqueReference: resource.opaqueReference }),
});

const toAction = (
  state: LearnerProgressState,
  actionState: LearnerActionState,
): LearnerActionViewModel => {
  const action =
    state === 'not_started'
      ? { kind: 'start' as const, label: 'Start item' }
      : state === 'in_progress'
        ? { kind: 'complete' as const, label: 'Mark complete' }
        : { kind: 'undo_completion' as const, label: 'Undo completion' };
  const enabled = actionState === 'available' || actionState === 'failed_retryable';
  const disabledReason = enabled
    ? undefined
    : actionState === 'submitting'
      ? 'This action is being submitted.'
      : actionState === 'conflict'
        ? 'Refresh this plan before trying again.'
        : 'This action is not available right now.';

  return {
    kind: action.kind,
    label: action.label,
    state: actionState,
    enabled,
    ...(disabledReason === undefined ? {} : { disabledReason }),
  };
};

const toItem = (
  item: AcceptedPlanSnapshotInput['content']['milestones'][number]['topics'][number]['items'][number],
  position: number,
  progressByItem: ReadonlyMap<string, LearnerProgressState>,
  actionStates: Readonly<Record<string, LearnerActionState>>,
): PlanItemViewModel => {
  const progressState = progressByItem.get(item.itemId) ?? 'not_started';
  const actionState = actionStates[item.itemId] ?? 'available';

  return {
    itemId: item.itemId,
    title: item.title,
    ...(item.description === undefined ? {} : { description: item.description }),
    positionLabel: `Item ${position}`,
    progressState,
    action: toAction(progressState, actionState),
    resources: (item.resources ?? []).map(toResource),
  };
};

const toNextAction = (item: PlanItemViewModel | undefined): NextActionViewModel | undefined =>
  item === undefined
    ? undefined
    : {
        itemId: item.itemId,
        title: item.title,
        ...(item.description === undefined ? {} : { description: item.description }),
      };

const toContext = (
  context: AcceptedPlanSnapshotInput['content']['context'],
): ContextViewModel | undefined => {
  if (context === undefined) {
    return undefined;
  }
  return {
    ...(context.summary === undefined ? {} : { summary: context.summary }),
    entries: (context.entries ?? []).map((entry) => ({
      label: entry.label,
      value: entry.value,
    })),
  };
};

export const safePlanHref = (planId: string): string =>
  `/plans/${encodeURIComponent(planId)}`;

export const toPlanDetailViewModel = (
  snapshot: AcceptedPlanSnapshotInput,
  options: ViewModelOptions,
): PlanDetailViewModel => {
  const contentState =
    options.contentState ??
    (snapshot.missingOptionalPaths.length > 0 ? 'partial' : 'accepted');
  const progressByItem = new Map(
    snapshot.currentProgress.map((record) => [record.itemId, record.state]),
  );
  let position = 0;
  const items: PlanItemViewModel[] = [];

  const outline = snapshot.content.milestones.map<OutlineNodeViewModel>((milestone) => ({
    kind: 'milestone',
    id: milestone.milestoneId,
    title: milestone.title,
    ...(milestone.description === undefined
      ? {}
      : { description: milestone.description }),
    children: milestone.topics.map<OutlineNodeViewModel>((topic) => ({
      kind: 'topic',
      id: topic.topicId,
      title: topic.title,
      ...(topic.description === undefined ? {} : { description: topic.description }),
      children: topic.items.map<OutlineNodeViewModel>((item) => {
        position += 1;
        const itemViewModel = toItem(
          item,
          position,
          progressByItem,
          options.actionStates ?? {},
        );
        items.push(itemViewModel);
        return {
          kind: 'item',
          id: itemViewModel.itemId,
          title: itemViewModel.title,
          ...(itemViewModel.description === undefined
            ? {}
            : { description: itemViewModel.description }),
          progressState: itemViewModel.progressState,
          item: itemViewModel,
          children: [],
        };
      }),
    })),
  }));

  const nextItem =
    items.find((item) => item.itemId === snapshot.nextItemId) ??
    items.find((item) => item.progressState !== 'completed_by_learner');
  const focusedItem =
    items.find((item) => item.itemId === options.focusedItemId) ?? nextItem ?? items[0];
  const goal: GoalViewModel = {
    title: snapshot.content.goal.title,
    ...(snapshot.content.goal.description === undefined
      ? {}
      : { description: snapshot.content.goal.description }),
  };
  const context = toContext(snapshot.content.context);
  const nextActionViewModel = toNextAction(nextItem);

  return {
    surfaceState: contentState,
    reference: {
      planId: snapshot.planId,
      href: options.href,
    },
    title: snapshot.content.title ?? snapshot.content.goal.title,
    trust: trustFor(contentState),
    goal,
    ...(context === undefined ? {} : { context }),
    progress: toProgress(snapshot),
    ...(options.progressMessage === undefined
      ? {}
      : { progressMessage: options.progressMessage }),
    ...(nextActionViewModel === undefined
      ? {}
      : { nextAction: nextActionViewModel }),
    outline,
    ...(focusedItem === undefined ? {} : { focusedItem }),
    ...(options.operation === undefined ? {} : { operation: options.operation }),
    ...(options.recovery === undefined ? {} : { recovery: options.recovery }),
    ...(options.dataControls === undefined
      ? {
          dataControls: {
            deletion: {
              state: 'available',
              label: 'Delete plan',
              consequence:
                'This is irreversible. Primary content, revisions, and progress are purged within 24 hours.',
              enabled: true,
            },
          },
        }
      : { dataControls: options.dataControls }),
  };
};

export const toPlanSummaryViewModel = (
  entry: ListSnapshotEntry,
): PlanSummaryViewModel => {
  const detail = toPlanDetailViewModel(entry.snapshot, {
    href: entry.href,
    ...(entry.contentState === undefined
      ? {}
      : { contentState: entry.contentState }),
  });
  return {
    planId: entry.snapshot.planId,
    href: entry.href,
    title: detail.title,
    goalSummary: detail.goal?.description ?? detail.goal?.title ?? detail.title,
    contentState:
      detail.surfaceState === 'accepted'
        ? 'accepted'
        : (detail.surfaceState as ContentState),
    progress: detail.progress,
    ...(detail.nextAction === undefined
      ? {}
      : { nextAction: detail.nextAction }),
    updatedAt: entry.snapshot.acceptedAt,
  };
};

export const toPlanListViewModel = (
  entries: readonly ListSnapshotEntry[],
): PlanListViewModel => ({
  pageState: entries.length === 0 ? 'empty' : 'ready',
  ...(entries.length === 0
    ? { pageMessage: 'A connected AI client can supply your first learning plan.' }
    : {}),
  plans: entries.map(toPlanSummaryViewModel),
});
