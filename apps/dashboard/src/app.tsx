import { useEffect, useMemo, useState } from 'react';
import {
  changePersonalizationConsent,
  correctLearnerFeedback,
  decidePersonalizationProposal,
  deleteLearnerFeedback,
  evaluatePersonalization,
  recordLearnerFeedback,
  type ActivePlanAggregate,
  type PersonalizationFeedbackArea,
  type IdentityAllocator,
  type PersonalizationState,
} from '@openlearn/domain';
import {
  AppShell,
  DashboardDetail,
  EmptyState,
  LoadingState,
  PageHeader,
  PlanCollection,
  RecoveryPanel,
  type ContentState,
  type DeletionState,
  type LearnerActionKind,
  type LearnerActionState,
  type PlanDataControlsViewModel,
} from '@openlearn/ui';
import {
  STATIC_PLANS,
  STATIC_PREVIEW_OPTIONS,
  STATIC_OWNER,
  snapshotOfPlan,
  type StaticPreviewState,
} from './seed-data.js';
import { applyDashboardProgressAction } from './progress-actions.js';
import { createProgressStore, type DashboardStorage } from './progress-store.js';
import { createPersonalizationStore } from './personalization-store.js';
import {
  actionStatesForPlan,
  setActionState,
  type ActionStatesByPlan,
} from './action-state.js';
import {
  type AcceptedPlanSnapshotInput,
  safePlanHref,
  toPlanDetailViewModel,
  toPlanListViewModel,
} from './view-model.js';
import { routeForPath } from './router.js';

export { routeForPath } from './router.js';

const contentStateFor = (preview: StaticPreviewState): ContentState => {
  switch (preview) {
    case 'partial':
      return 'partial';
    case 'invalid':
      return 'invalid';
    case 'pending':
      return 'pending';
    case 'recovering':
      return 'recovering';
    default:
      return 'accepted';
  }
};

const detailSourcePlanIdFor = (
  planId: string,
  preview: StaticPreviewState,
): string =>
  preview === 'partial'
    ? 'static-plan-partial'
    : preview === 'completed' || preview === 'conflict'
      ? 'static-plan-progress'
      : planId;

const dataControlsFor = (state: DeletionState): PlanDataControlsViewModel => ({
  deletion: {
    state,
    label: 'Delete plan',
    consequence:
      'This is irreversible. Primary content, revisions, and progress are purged within 24 hours.',
    enabled: state === 'available',
    ...(state === 'submitting'
      ? { disabledReason: 'Deletion is being processed.' }
      : state === 'recovering'
        ? { disabledReason: 'Deletion is being reconciled.' }
        : state === 'conflict'
          ? { disabledReason: 'Refresh before making a new deletion decision.' }
          : {}),
  },
});

const previewLabel = (value: StaticPreviewState): string =>
  STATIC_PREVIEW_OPTIONS.find((option) => option.value === value)?.label ?? 'Accepted plan';

const browserStorage = (): DashboardStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

class DashboardPersonalizationAllocator implements IdentityAllocator {
  private readonly counters = new Map<string, number>();

  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    const next = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, next);
    const randomId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${next.toString(36)}`;
    return `dashboard-${kind}-${randomId}`;
  }
}

const planMap = (
  store: ReturnType<typeof createProgressStore>,
): Map<string, ActivePlanAggregate> =>
  new Map(
    STATIC_PLANS.map((plan) => [plan.planId, store.hydrate(plan)]),
  );

const PreviewControl = ({
  value,
  onChange,
}: {
  readonly value: StaticPreviewState;
  readonly onChange: (value: StaticPreviewState) => void;
}) => (
  <label className="preview-control">
    <span>Static preview</span>
    <select
      aria-label="Static preview state"
      value={value}
      onChange={(event) => onChange(event.target.value as StaticPreviewState)}
    >
      {STATIC_PREVIEW_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const StaticNotice = ({ state }: { readonly state: StaticPreviewState }) => (
  <p className="static-notice" role="note">
    Static fixture preview · {previewLabel(state)} · no live service is connected.
  </p>
);

const PlansPage = ({
  preview,
  snapshots,
  onNavigate,
}: {
  readonly preview: StaticPreviewState;
  readonly snapshots: readonly AcceptedPlanSnapshotInput[];
  readonly onNavigate: (href: string) => void;
}) => {
  const entries = useMemo(
    () =>
      snapshots.map((snapshot, index) => ({
        snapshot,
        href: safePlanHref(snapshot.planId),
        ...(index === 0 && ['partial', 'invalid', 'pending', 'recovering'].includes(preview)
          ? { contentState: contentStateFor(preview) }
          : {}),
      })),
    [preview, snapshots],
  );
  const model =
    preview === 'empty'
      ? toPlanListViewModel([])
      : preview === 'loading'
        ? { pageState: 'loading' as const, plans: [] }
        : preview === 'retryable'
          ? {
              pageState: 'error' as const,
              pageMessage: 'Try again or refresh when you are ready.',
              plans: [],
            }
          : toPlanListViewModel(entries);

  return (
    <>
      <PageHeader
        eyebrow="Your workspace"
        title="Learning plans"
        description="A clear place to return to the learning paths you have accepted."
      />
      <StaticNotice state={preview} />
      <PlanCollection model={model} onNavigate={onNavigate} />
    </>
  );
};

const UnavailablePage = ({ onNavigate }: { readonly onNavigate: (href: string) => void }) => (
  <>
    <PageHeader
      title="Plan unavailable"
      description="This plan cannot be displayed for the current workspace."
      backHref="/plans"
      onNavigate={onNavigate}
    />
    <RecoveryPanel
      title="We can’t show that plan"
      message="Return to your plans to choose an available learning path."
      actionLabel="Back to plans"
      onAction={() => onNavigate('/plans')}
    />
  </>
);

const DetailPage = ({
  planId,
  preview,
  snapshotsById,
  focusedItemId,
  actionStates,
  deletionState,
  progressMessage,
  personalization,
  personalizationMessage,
  onNavigate,
  onSelectItem,
  onProgressAction,
  onConfirmDelete,
  onRetryDelete,
  onRefresh,
  onEnablePersonalization,
  onPausePersonalization,
  onResumePersonalization,
  onDisablePersonalization,
  onRecordFeedback,
  onCorrectFeedback,
  onDeleteFeedback,
  onAcceptProposal,
  onRejectProposal,
}: {
  readonly planId: string;
  readonly preview: StaticPreviewState;
  readonly snapshotsById: ReadonlyMap<string, AcceptedPlanSnapshotInput>;
  readonly focusedItemId?: string;
  readonly actionStates: Readonly<Record<string, LearnerActionState>>;
  readonly deletionState: DeletionState;
  readonly progressMessage?: string;
  readonly personalization?: PersonalizationState;
  readonly personalizationMessage?: string;
  readonly onNavigate: (href: string) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onProgressAction: (itemId: string, action: LearnerActionKind) => void;
  readonly onConfirmDelete: () => void;
  readonly onRetryDelete: () => void;
  readonly onRefresh: () => void;
  readonly onEnablePersonalization: () => void;
  readonly onPausePersonalization: () => void;
  readonly onResumePersonalization: () => void;
  readonly onDisablePersonalization: () => void;
  readonly onRecordFeedback: (area: PersonalizationFeedbackArea, value: string) => void;
  readonly onCorrectFeedback: (
    feedbackId: string,
    area: PersonalizationFeedbackArea,
    value: string,
  ) => void;
  readonly onDeleteFeedback: (feedbackId: string) => void;
  readonly onAcceptProposal: (proposalId: string, proposalVersion: number) => void;
  readonly onRejectProposal: (proposalId: string, proposalVersion: number) => void;
}) => {
  if (preview === 'loading') {
    return (
      <>
        <PageHeader title="Loading plan" backHref="/plans" onNavigate={onNavigate} />
        <LoadingState label="Loading the accepted plan…" />
      </>
    );
  }
  if (preview === 'empty') {
    return (
      <>
        <PageHeader title="No accepted plan" backHref="/plans" onNavigate={onNavigate} />
        <EmptyState
          title="There is no plan to display"
          message="A connected AI client can supply a plan before it appears here."
        />
      </>
    );
  }
  if (preview === 'retryable') {
    return (
      <>
        <PageHeader title="Plan update unavailable" backHref="/plans" onNavigate={onNavigate} />
        <RecoveryPanel
          title="The accepted plan is not available in this preview"
          message="No replacement was committed. Return to plans and try a fresh read."
          actionLabel="Return to plans"
          onAction={() => onNavigate('/plans')}
        />
      </>
    );
  }

  const sourcePlanId = detailSourcePlanIdFor(planId, preview);
  const snapshot = snapshotsById.get(sourcePlanId);
  if (snapshot === undefined) {
    return <UnavailablePage onNavigate={onNavigate} />;
  }

  const operation =
    preview === 'pending'
      ? { state: 'pending' as const, label: 'A plan update is being prepared.' }
      : preview === 'recovering'
        ? { state: 'recovering' as const, label: 'We’re checking whether the update completed.' }
        : undefined;
  const detail = toPlanDetailViewModel(snapshot, {
    href: safePlanHref(snapshot.planId),
    ...(focusedItemId === undefined ? {} : { focusedItemId }),
    ...(preview === 'partial' || preview === 'invalid' || preview === 'pending' || preview === 'recovering'
      ? { contentState: contentStateFor(preview) }
      : {}),
    ...(Object.keys(actionStates).length === 0 ? {} : { actionStates }),
    ...(progressMessage === undefined ? {} : { progressMessage }),
    ...(personalization === undefined ? {} : { personalization }),
    ...(personalizationMessage === undefined
      ? {}
      : { personalizationStatusMessage: personalizationMessage }),
    ...(operation === undefined ? {} : { operation }),
    dataControls: dataControlsFor(deletionState),
  });

  return (
    <>
      <PageHeader
        eyebrow={`Revision ${snapshot.revisionNumber}`}
        title={detail.title}
        description="Explore the accepted path, choose an item, and keep confirmed progress visible."
        backHref="/plans"
        onNavigate={onNavigate}
      />
      <StaticNotice state={preview} />
      <DashboardDetail
        model={detail}
        onSelectItem={onSelectItem}
        onProgressAction={onProgressAction}
        onConfirmDelete={onConfirmDelete}
        onRetryDelete={onRetryDelete}
        onRefresh={onRefresh}
        onEnablePersonalization={onEnablePersonalization}
        onPausePersonalization={onPausePersonalization}
        onResumePersonalization={onResumePersonalization}
        onDisablePersonalization={onDisablePersonalization}
        onRecordFeedback={onRecordFeedback}
        onCorrectFeedback={onCorrectFeedback}
        onDeleteFeedback={onDeleteFeedback}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
      />
    </>
  );
};

export const App = () => {
  const progressStore = useMemo(
    () => createProgressStore(browserStorage()),
    [],
  );
  const personalizationStore = useMemo(
    () => createPersonalizationStore(browserStorage()),
    [],
  );
  const personalizationAllocator = useMemo(
    () => new DashboardPersonalizationAllocator(),
    [],
  );
  const hydratePlans = () => planMap(progressStore);
  const [plans, setPlans] = useState<Map<string, ActivePlanAggregate>>(() => hydratePlans());
  const hydratePersonalization = (sourcePlans: ReadonlyMap<string, ActivePlanAggregate>) =>
    new Map(
      [...sourcePlans.values()].map((plan) => [
        plan.planId,
        personalizationStore.hydrate(plan, new Date().toISOString()),
      ] as const),
    );
  const [personalizationByPlan, setPersonalizationByPlan] = useState<
    Map<string, PersonalizationState>
  >(() => hydratePersonalization(new Map(STATIC_PLANS.map((plan) => [plan.planId, plan]))));
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [preview, setPreview] = useState<StaticPreviewState>('accepted');
  const [focusedItemId, setFocusedItemId] = useState<string | undefined>();
  const [actionStatesByPlan, setActionStatesByPlan] = useState<ActionStatesByPlan>({});
  const [deletionState, setDeletionState] = useState<DeletionState>('available');
  const [progressMessages, setProgressMessages] = useState<Readonly<Record<string, string>>>({});
  const [personalizationMessages, setPersonalizationMessages] = useState<
    Readonly<Record<string, string>>
  >({});

  const snapshots = useMemo(
    () => [...plans.values()].map((plan) => snapshotOfPlan(plan, STATIC_OWNER)),
    [plans],
  );
  const snapshotsById = useMemo(
    () => new Map(snapshots.map((snapshot) => [snapshot.planId, snapshot])),
    [snapshots],
  );

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setFocusedItemId(undefined);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (href: string) => {
    window.history.pushState({}, '', href);
    setPathname(window.location.pathname);
    setFocusedItemId(undefined);
  };
  const route = routeForPath(pathname);
  const selectedPlanId = route.kind === 'plan' ? route.planId : undefined;
  const selectedPlan = selectedPlanId === undefined ? undefined : plans.get(selectedPlanId);
  const displayedPlanId =
    selectedPlanId === undefined
      ? undefined
      : detailSourcePlanIdFor(selectedPlanId, preview);
  const selectedPersonalization =
    displayedPlanId === undefined ? undefined : personalizationByPlan.get(displayedPlanId);

  const selectItem = (itemId: string) => {
    setFocusedItemId(itemId);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('focused-item-heading')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };
  const progressAction = (itemId: string, action: LearnerActionKind) => {
    if (selectedPlanId === undefined) {
      return;
    }
    const plan = plans.get(selectedPlanId);
    if (plan === undefined) {
      return;
    }
    setActionStatesByPlan((states) =>
      setActionState(states, selectedPlanId, itemId, 'submitting'),
    );
    const result = applyDashboardProgressAction({
      plan,
      itemId,
      action,
      confirmedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setActionStatesByPlan((states) =>
        setActionState(
          states,
          selectedPlanId,
          itemId,
          result.kind === 'conflict' ? 'conflict' : 'unavailable',
        ),
      );
      setProgressMessages((messages) => ({
        ...messages,
        [selectedPlanId]: result.message,
      }));
      return;
    }
    const saveResult = progressStore.save(result.plan, plan);
    if (!saveResult.ok) {
      setActionStatesByPlan((states) =>
        setActionState(
          states,
          selectedPlanId,
          itemId,
          saveResult.kind === 'conflict' ? 'conflict' : 'failed_retryable',
        ),
      );
      setProgressMessages((messages) => ({
        ...messages,
        [selectedPlanId]:
          saveResult.kind === 'conflict'
            ? 'Progress changed in another session. Refresh before trying again.'
            : 'Your confirmed progress is unchanged. Try again when ready.',
      }));
      return;
    }
    setPlans((currentPlans) =>
      new Map(currentPlans).set(result.plan.planId, result.plan),
    );
    setActionStatesByPlan((states) =>
      setActionState(states, selectedPlanId, itemId, 'available'),
    );
    setProgressMessages((messages) => ({
      ...messages,
      [selectedPlanId]: result.message,
    }));
    const currentPersonalization =
      selectedPlanId === displayedPlanId && selectedPlanId !== undefined
        ? personalizationByPlan.get(selectedPlanId)
        : undefined;
    if (currentPersonalization?.consent.state === 'enabled') {
      const evaluated = evaluateFor(result.plan, currentPersonalization);
      if (!evaluated.ok) {
        setPersonalizationMessages((messages) => ({
          ...messages,
          [selectedPlanId]:
            'Confirmed progress was saved, but suggestions could not be refreshed.',
        }));
      } else if (evaluated.value.state.stateVersion !== currentPersonalization.stateVersion) {
        persistPersonalization(
          selectedPlanId,
          evaluated.value.state,
          currentPersonalization.stateVersion,
          'Confirmed progress updated. Suggestions were refreshed.',
        );
      } else {
        setPersonalizationMessages((messages) => ({
          ...messages,
          [selectedPlanId]: 'Confirmed progress updated. Suggestions were checked.',
        }));
      }
    }
  };

  const personalizationForSelectedPlan = (): {
    readonly plan: ActivePlanAggregate;
    readonly state: PersonalizationState;
  } | undefined => {
    if (displayedPlanId === undefined) {
      return undefined;
    }
    const plan = plans.get(displayedPlanId);
    const state = personalizationByPlan.get(displayedPlanId);
    return plan === undefined || state === undefined ? undefined : { plan, state };
  };

  const persistPersonalization = (
    planId: string,
    nextState: PersonalizationState,
    expectedStateVersion: number,
    successMessage: string,
  ): boolean => {
    const result = personalizationStore.save(nextState, expectedStateVersion);
    if (!result.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [planId]:
          result.kind === 'conflict'
            ? 'Personalization changed in another session. Refresh before trying again.'
            : 'Personalization is unavailable. Your accepted plan is unchanged.',
      }));
      return false;
    }
    setPersonalizationByPlan((states) =>
      new Map(states).set(planId, nextState),
    );
    setPersonalizationMessages((messages) => ({
      ...messages,
      [planId]: successMessage,
    }));
    return true;
  };

  const evaluateFor = (
    plan: ActivePlanAggregate,
    state: PersonalizationState,
  ) =>
    evaluatePersonalization({
      plan,
      state,
      ownerId: plan.ownerId,
      now: new Date().toISOString(),
      allocator: personalizationAllocator,
    });

  const enablePersonalization = () => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const changed = changePersonalizationConsent({
      state: selected.state,
      action: 'enable',
      now: new Date().toISOString(),
    });
    if (!changed.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]: 'Suggestions could not be enabled. Try again.',
      }));
      return;
    }
    const evaluated = evaluateFor(selected.plan, changed.value);
    const nextState = evaluated.ok ? evaluated.value.state : changed.value;
    const message =
      evaluated.ok && evaluated.value.createdProposal !== undefined
        ? 'Suggestions enabled. A new suggestion is ready to review.'
        : 'Suggestions enabled for this plan.';
    persistPersonalization(
      selected.plan.planId,
      nextState,
      selected.state.stateVersion,
      message,
    );
  };

  const changeConsent = (action: 'pause' | 'resume' | 'revoke') => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const changed = changePersonalizationConsent({
      state: selected.state,
      action,
      now: new Date().toISOString(),
    });
    if (!changed.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]: 'That personalization action is not available right now.',
      }));
      return;
    }
    const message =
      action === 'pause'
        ? 'Suggestions paused. Confirmed progress is unchanged.'
        : action === 'resume'
          ? 'Suggestions resumed.'
          : 'Personalization disabled. Feedback is no longer used for suggestions.';
    persistPersonalization(
      selected.plan.planId,
      changed.value,
      selected.state.stateVersion,
      message,
    );
  };

  const recordPersonalizationFeedback = (
    area: PersonalizationFeedbackArea,
    value: string,
  ) => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const recorded = recordLearnerFeedback({
      plan: selected.plan,
      state: selected.state,
      ownerId: selected.plan.ownerId,
      ...(focusedItemId === undefined ? {} : { itemId: focusedItemId }),
      area,
      value,
      recordedAt: new Date().toISOString(),
      allocator: personalizationAllocator,
    });
    if (!recorded.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]: 'Feedback was not saved. Suggestions remain unchanged.',
      }));
      return;
    }
    const evaluated = evaluateFor(selected.plan, recorded.value.state);
    const nextState = evaluated.ok ? evaluated.value.state : recorded.value.state;
    const message =
      evaluated.ok && evaluated.value.createdProposal !== undefined
        ? 'Feedback saved. A suggestion is ready to review.'
        : 'Feedback saved for this plan.';
    persistPersonalization(
      selected.plan.planId,
      nextState,
      selected.state.stateVersion,
      message,
    );
  };

  const correctPersonalizationFeedback = (
    feedbackId: string,
    area: PersonalizationFeedbackArea,
    value: string,
  ) => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const corrected = correctLearnerFeedback({
      plan: selected.plan,
      state: selected.state,
      ownerId: selected.plan.ownerId,
      feedbackId,
      area,
      value,
      recordedAt: new Date().toISOString(),
      allocator: personalizationAllocator,
    });
    if (!corrected.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]: 'That feedback could not be corrected. Refresh and try again.',
      }));
      return;
    }
    const evaluated = evaluateFor(selected.plan, corrected.value.state);
    const nextState = evaluated.ok ? evaluated.value.state : corrected.value.state;
    persistPersonalization(
      selected.plan.planId,
      nextState,
      selected.state.stateVersion,
      'Feedback corrected. Suggestions use the new bounded value.',
    );
  };

  const deletePersonalizationFeedback = (feedbackId: string) => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const deleted = deleteLearnerFeedback({
      plan: selected.plan,
      state: selected.state,
      ownerId: selected.plan.ownerId,
      feedbackId,
      now: new Date().toISOString(),
    });
    if (!deleted.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]: 'That feedback could not be deleted. Refresh and try again.',
      }));
      return;
    }
    const evaluated = evaluateFor(selected.plan, deleted.value);
    const nextState = evaluated.ok ? evaluated.value.state : deleted.value;
    persistPersonalization(
      selected.plan.planId,
      nextState,
      selected.state.stateVersion,
      'Feedback deleted and removed from future suggestions.',
    );
  };

  const decidePersonalization = (
    proposalId: string,
    proposalVersion: number,
    decision: 'accept' | 'reject',
  ) => {
    const selected = personalizationForSelectedPlan();
    if (selected === undefined) return;
    const decided = decidePersonalizationProposal({
      plan: selected.plan,
      state: selected.state,
      ownerId: selected.plan.ownerId,
      proposalId,
      decision,
      expectedProposalVersion: proposalVersion,
      now: new Date().toISOString(),
    });
    if (!decided.ok) {
      setPersonalizationMessages((messages) => ({
        ...messages,
        [selected.plan.planId]:
          decided.category === 'stale_personalization' || decided.category === 'stale_revision'
            ? 'That suggestion is out of date. Refresh before deciding.'
            : 'That suggestion is no longer available.',
      }));
      return;
    }
    const message =
      decision === 'reject'
        ? 'Suggestion marked not useful. Your accepted plan is unchanged.'
        : decided.value.handoff === undefined
          ? 'Suggestion accepted. Your accepted plan is unchanged.'
          : 'Request accepted for the connected AI client. Your accepted plan is unchanged.';
    persistPersonalization(
      selected.plan.planId,
      decided.value.state,
      selected.state.stateVersion,
      message,
    );
  };
  const confirmDelete = () => {
    setDeletionState('submitting');
  };
  const retryDelete = () => {
    setDeletionState('available');
  };
  const refresh = () => {
    const nextPlans = hydratePlans();
    setPlans(nextPlans);
    setPersonalizationByPlan(hydratePersonalization(nextPlans));
    setActionStatesByPlan({});
    setProgressMessages({});
    setPersonalizationMessages({});
    setDeletionState('available');
  };

  return (
    <AppShell
      currentPath={route.kind === 'plans' ? '/plans' : ''}
      onNavigate={navigate}
      preview={
        <PreviewControl
          value={preview}
          onChange={(value) => {
            setPreview(value);
            setFocusedItemId(undefined);
            refresh();
          }}
        />
      }
    >
      <main id="main-content" className="page-main">
        {route.kind === 'unknown' ? (
          <UnavailablePage onNavigate={navigate} />
        ) : route.kind === 'plans' ? (
          <PlansPage preview={preview} snapshots={snapshots} onNavigate={navigate} />
        ) : selectedPlan === undefined ? (
          <UnavailablePage onNavigate={navigate} />
        ) : (
          <DetailPage
            planId={selectedPlan.planId}
            preview={preview}
            snapshotsById={snapshotsById}
            {...(focusedItemId === undefined ? {} : { focusedItemId })}
            actionStates={actionStatesForPlan(actionStatesByPlan, selectedPlan.planId)}
            deletionState={deletionState}
            {...(progressMessages[selectedPlan.planId] === undefined
              ? {}
              : { progressMessage: progressMessages[selectedPlan.planId] })}
            {...(selectedPersonalization === undefined
              ? {}
              : { personalization: selectedPersonalization })}
            {...(displayedPlanId === undefined || personalizationMessages[displayedPlanId] === undefined
              ? {}
              : { personalizationMessage: personalizationMessages[displayedPlanId] })}
            onNavigate={navigate}
            onSelectItem={selectItem}
            onProgressAction={progressAction}
            onConfirmDelete={confirmDelete}
            onRetryDelete={retryDelete}
            onRefresh={refresh}
            onEnablePersonalization={enablePersonalization}
            onPausePersonalization={() => changeConsent('pause')}
            onResumePersonalization={() => changeConsent('resume')}
            onDisablePersonalization={() => changeConsent('revoke')}
            onRecordFeedback={recordPersonalizationFeedback}
            onCorrectFeedback={correctPersonalizationFeedback}
            onDeleteFeedback={deletePersonalizationFeedback}
            onAcceptProposal={(proposalId, proposalVersion) =>
              decidePersonalization(proposalId, proposalVersion, 'accept')}
            onRejectProposal={(proposalId, proposalVersion) =>
              decidePersonalization(proposalId, proposalVersion, 'reject')}
          />
        )}
        <footer className="page-footer">
          <span>OpenLearn static dashboard preview</span>
          <span>Browser-local progress · no live service connected</span>
        </footer>
      </main>
    </AppShell>
  );
};
