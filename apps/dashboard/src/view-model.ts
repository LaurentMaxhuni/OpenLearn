import type {
  PersonalizationFeedbackArea,
  PersonalizationFeedbackValue,
  PersonalizationProposal,
  PersonalizationState,
} from '@openlearn/domain';
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
  PersonalizationFeedbackAreaView,
  PersonalizationFeedbackOptionViewModel,
  PersonalizationFeedbackViewModel,
  PersonalizationProposalViewModel,
  PersonalizationViewModel,
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
  readonly personalization?: PersonalizationState;
  readonly personalizationStatusMessage?: string;
  readonly personalizationTargetLabel?: string;
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

const feedbackAreaLabels: Readonly<Record<PersonalizationFeedbackArea, string>> = {
  difficulty: 'Difficulty',
  pace: 'Pace',
  relevance: 'Relevance',
};

const feedbackValueLabels: Readonly<Record<string, string>> = {
  too_easy: 'Too easy',
  about_right: 'About right',
  too_hard: 'Too hard',
  too_slow: 'Too slow',
  too_fast: 'Too fast',
  relevant: 'Relevant',
  not_relevant: 'Not relevant',
};

const feedbackOptionsFor = (
  area: PersonalizationFeedbackArea,
): readonly PersonalizationFeedbackOptionViewModel[] =>
  (area === 'difficulty'
    ? ['too_easy', 'about_right', 'too_hard']
    : area === 'pace'
      ? ['too_slow', 'about_right', 'too_fast']
      : ['relevant', 'not_relevant']
  ).map((value) => ({
    value,
    label: feedbackValueLabels[value] ?? value,
  }));

const feedbackValueIsValid = (
  area: PersonalizationFeedbackArea,
  value: PersonalizationFeedbackValue,
): boolean => feedbackOptionsFor(area).some((option) => option.value === value);

const proposalTitle = (proposal: PersonalizationProposal): string => {
  switch (proposal.parameters.kind) {
    case 'recommend_existing_next_step':
      return 'Continue with an existing next step';
    case 'suggest_pacing_preference':
      return `Consider a ${proposal.parameters.preference} pace`;
    case 'request_plan_revision':
      return 'Ask for a revised plan';
  }
};

const proposalStatusLabel = (proposal: PersonalizationProposal): string => {
  switch (proposal.status) {
    case 'proposed':
      return 'Needs your review';
    case 'accepted':
      return 'Accepted by you';
    case 'rejected':
      return 'Marked not useful';
    case 'withdrawn':
      return 'Withdrawn';
    case 'expired':
      return 'Expired';
  }
};

const basisLabels: Readonly<Record<string, string>> = {
  confirmed_progress: 'confirmed progress',
  difficulty_feedback: 'difficulty feedback',
  pace_feedback: 'pace feedback',
  relevance_feedback: 'relevance feedback',
};

const itemLabelById = (
  snapshot: AcceptedPlanSnapshotInput,
): ReadonlyMap<string, string> =>
  new Map(
    snapshot.content.milestones.flatMap((milestone) =>
      milestone.topics.flatMap((topic) =>
        topic.items.map((item) => [item.itemId, item.title] as const),
      ),
    ),
  );

export const toPersonalizationViewModel = (
  state: PersonalizationState,
  options: {
    readonly itemLabels?: ReadonlyMap<string, string>;
    readonly targetLabel?: string;
    readonly statusMessage?: string;
  } = {},
): PersonalizationViewModel => {
  const itemLabels = options.itemLabels ?? new Map<string, string>();
  const feedback = state.feedback
    .filter((entry) => entry.status !== 'deleted')
    .map<PersonalizationFeedbackViewModel>((entry) => {
      const itemLabel = entry.itemId === undefined ? undefined : itemLabels.get(entry.itemId);
      return {
        feedbackId: entry.feedbackId,
        area: entry.area,
        areaLabel: feedbackAreaLabels[entry.area],
        value: entry.value,
        valueLabel: feedbackValueLabels[entry.value] ?? entry.value,
        status: entry.status === 'corrected' ? 'corrected' : 'active',
        ...(itemLabel === undefined ? {} : { itemLabel }),
        correctionOptions: feedbackOptionsFor(entry.area).filter(
          (option) => option.value !== entry.value && feedbackValueIsValid(entry.area, entry.value),
        ),
      };
    });
  const proposals = state.proposals.map<PersonalizationProposalViewModel>((proposal) => ({
    proposalId: proposal.proposalId,
    kind: proposal.parameters.kind,
    title: proposalTitle(proposal),
    explanation: proposal.explanation,
    basis: proposal.basis.map((basis) => basisLabels[basis] ?? basis),
    status: proposal.status,
    statusLabel: proposalStatusLabel(proposal),
    proposalVersion: proposal.proposalVersion,
    canDecide:
      proposal.status === 'proposed' &&
      (state.consent.state === 'enabled' || state.consent.state === 'paused'),
    ...(proposal.status === 'accepted' && proposal.parameters.kind !== 'recommend_existing_next_step'
      ? { handoffLabel: 'Your request is ready for the connected AI client. The accepted plan is unchanged.' }
      : proposal.status === 'accepted'
        ? { handoffLabel: 'This existing next step was accepted. The plan and progress are unchanged.' }
        : {}),
  }));
  const feedbackAreas: readonly {
    readonly area: PersonalizationFeedbackAreaView;
    readonly label: string;
    readonly options: readonly PersonalizationFeedbackOptionViewModel[];
  }[] = (['difficulty', 'pace', 'relevance'] as const).map((area) => ({
    area,
    label: feedbackAreaLabels[area],
    options: feedbackOptionsFor(area),
  }));
  return {
    state: state.consent.state,
    consentVersion: state.consent.consentVersion,
    scopeLabel: 'This plan only',
    explanation:
      'Suggestions use only confirmed progress and this plan’s bounded feedback. They can point to existing items or prepare a request for the connected AI client; your accepted plan never changes automatically.',
    ...(options.targetLabel === undefined ? {} : { feedbackTargetLabel: options.targetLabel }),
    feedbackAreas,
    feedback,
    proposals,
    ...(options.statusMessage === undefined ? {} : { statusMessage: options.statusMessage }),
  };
};

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
  const personalization =
    options.personalization === undefined
      ? undefined
      : toPersonalizationViewModel(options.personalization, {
          itemLabels: itemLabelById(snapshot),
          ...(focusedItem === undefined ? {} : { targetLabel: focusedItem.title }),
          ...(options.personalizationStatusMessage === undefined
            ? {}
            : { statusMessage: options.personalizationStatusMessage }),
        });

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
    ...(personalization === undefined ? {} : { personalization }),
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
