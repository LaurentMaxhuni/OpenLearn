import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApplyProgressActionInput, DeletePlanInput, PlanSummary, PlanView } from '@openlearn/application';
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
  toPlanListViewModelFromSummaries,
  toPlanListViewModel,
} from './view-model.js';
import { routeForPath } from './router.js';
import {
  createDashboardApiClient,
  DashboardApiError,
  type DashboardApiClient,
} from './remote-api.js';

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
    <span>Preview state</span>
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
  <p className="surface-note" role="note">
    <span className="surface-note-label">Preview mode</span>
    <span>{previewLabel(state)}. This workspace uses local fixture data.</span>
  </p>
);

const PlansPage = ({
  preview,
  snapshots,
  summaries,
  onNavigate,
  onRefresh,
  connected = false,
  pageState,
  pageMessage,
}: {
  readonly preview: StaticPreviewState;
  readonly snapshots: readonly AcceptedPlanSnapshotInput[];
  readonly summaries?: readonly PlanSummary[];
  readonly onNavigate: (href: string) => void;
  readonly onRefresh?: () => void;
  readonly connected?: boolean;
  readonly pageState?: 'loading' | 'ready' | 'error';
  readonly pageMessage?: string;
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
    pageState === 'loading'
          ? { pageState: 'loading' as const, plans: [] }
          : pageState === 'error'
        ? {
            pageState: 'error' as const,
            pageMessage: pageMessage ?? 'Try again or refresh when you are ready.',
            plans: [],
          }
        : summaries !== undefined
          ? toPlanListViewModelFromSummaries(summaries)
          : preview === 'empty'
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
      {connected ? (
        <p className="surface-note" role="note">
          <span className="surface-note-label">Live service</span>
          <span>Account data is shown for this workspace.</span>
        </p>
      ) : (
        <StaticNotice state={preview} />
      )}
      <PlanCollection
        model={model}
        onNavigate={onNavigate}
        {...(onRefresh === undefined ? {} : { onRetry: onRefresh })}
      />
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
  connected = false,
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
  readonly connected?: boolean;
}) => {
  if (preview === 'loading') {
    return (
      <>
        <PageHeader title="Loading plan" backHref="/plans" onNavigate={onNavigate} />
        <LoadingState label="Loading the accepted plan..." />
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
      {connected ? (
        <p className="surface-note" role="note">
          <span className="surface-note-label">Live service</span>
          <span>Progress is saved for this account.</span>
        </p>
      ) : (
        <StaticNotice state={preview} />
      )}
      {connected && personalization === undefined && personalizationMessage !== undefined ? (
        <p className="surface-note" role="status">{personalizationMessage}</p>
      ) : null}
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

const StaticDashboard = () => {
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
  const hasNavigatedRef = useRef(false);
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
      hasNavigatedRef.current = true;
      setPathname(window.location.pathname);
      setFocusedItemId(undefined);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!hasNavigatedRef.current) {
      return;
    }
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: true });
  }, [pathname]);

  const navigate = (href: string) => {
    hasNavigatedRef.current = true;
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
  };

  useEffect(() => {
    if (focusedItemId === undefined) {
      return;
    }
    const target = document.querySelector<HTMLElement>(
      '[data-focus-target="focused-item"]',
    );
    if (target === null) {
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [focusedItemId]);
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
      <main id="main-content" className="page-main" tabIndex={-1}>
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
          <span>OpenLearn local workspace</span>
          <span>Progress stays in this browser</span>
        </footer>
      </main>
    </AppShell>
  );
};

const snapshotFromView = (view: PlanView): AcceptedPlanSnapshotInput => ({
  planId: view.planId,
  revisionId: view.revisionId,
  revisionNumber: view.revisionNumber,
  acceptedAt: view.acceptedAt,
  content: view.content,
  missingOptionalPaths: view.missingOptionalPaths,
  currentProgress: view.currentProgress,
  progressSummary: view.progressSummary,
  ...(view.nextItemId === undefined ? {} : { nextItemId: view.nextItemId }),
});

const connectedOperationKey = (kind: string): string => {
  const randomId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `dashboard-${kind}-${randomId}`.slice(0, 128);
};

const ConnectedDashboard = () => {
  const client = useMemo<DashboardApiClient>(
      () =>
        createDashboardApiClient({
        ...(import.meta.env.VITE_OPENLEARN_SERVICE_ORIGIN === undefined
          ? {}
          : { origin: import.meta.env.VITE_OPENLEARN_SERVICE_ORIGIN }),
      }),
    [],
  );
  const [summaries, setSummaries] = useState<readonly PlanSummary[]>([]);
  const [snapshots, setSnapshots] = useState<readonly AcceptedPlanSnapshotInput[]>([]);
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageMessage, setPageMessage] = useState<string | undefined>();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [detailLoading, setDetailLoading] = useState(
    () => routeForPath(window.location.pathname).kind === 'plan',
  );
  const [detailMessages, setDetailMessages] = useState<Readonly<Record<string, string>>>({});
  const [focusedItemId, setFocusedItemId] = useState<string | undefined>();
  const [actionStatesByPlan, setActionStatesByPlan] = useState<ActionStatesByPlan>({});
  const [deletionState, setDeletionState] = useState<DeletionState>('available');
  const [progressMessages, setProgressMessages] = useState<Readonly<Record<string, string>>>({});
  const [personalizationByPlan, setPersonalizationByPlan] = useState<
    Readonly<Record<string, PersonalizationState>>
  >({});
  const [personalizationMessages, setPersonalizationMessages] = useState<
    Readonly<Record<string, string>>
  >({});
  const hasNavigatedRef = useRef(false);
  const loadControllerRef = useRef<AbortController | undefined>(undefined);
  const progressInputsRef = useRef(new Map<string, ApplyProgressActionInput>());
  const deleteInputsRef = useRef(new Map<string, DeletePlanInput>());
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);

  const snapshotsById = useMemo(
    () => new Map(snapshots.map((snapshot) => [snapshot.planId, snapshot])),
    [snapshots],
  );

  const load = async (): Promise<void> => {
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setPageState('loading');
    try {
      const nextSummaries = await client.listPlanSummaries(controller.signal);
      if (controller.signal.aborted) return;
      setSummaries(nextSummaries);
      setPageState('ready');
      setPageMessage(undefined);
      setActionStatesByPlan({});
      setProgressMessages({});
      setDeletionState('available');
    } catch (error) {
      if (controller.signal.aborted) return;
      setPageState('error');
      setPageMessage(
        error instanceof DashboardApiError
          ? error.message
          : 'The live workspace is unavailable. Try again when ready.',
      );
    }
  };

  useEffect(() => {
    void load();
    return () => loadControllerRef.current?.abort();
  }, [client]);

  useEffect(() => {
    const onPopState = () => {
      hasNavigatedRef.current = true;
      setPathname(window.location.pathname);
      setFocusedItemId(undefined);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!hasNavigatedRef.current) return;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);

  const navigate = (href: string) => {
    hasNavigatedRef.current = true;
    window.history.pushState({}, '', href);
    setPathname(window.location.pathname);
    setFocusedItemId(undefined);
  };
  const route = routeForPath(pathname);
  const selectedPlanId = route.kind === 'plan' ? route.planId : undefined;
  const selectedSnapshot =
    selectedPlanId === undefined ? undefined : snapshotsById.get(selectedPlanId);
  const selectedPersonalization =
    selectedPlanId === undefined ? undefined : personalizationByPlan[selectedPlanId];

  useEffect(() => {
    if (selectedPlanId === undefined) {
      setDetailLoading(false);
      return;
    }
    if (selectedSnapshot !== undefined && detailRefreshVersion === 0) {
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setDetailLoading(true);
    setDetailMessages((messages) => ({ ...messages, [selectedPlanId]: '' }));
    void client.getPlanView(selectedPlanId, controller.signal).then((view) => {
      if (!active) return;
      const snapshot = snapshotFromView(view);
      setSnapshots((current) => [
        ...current.filter((entry) => entry.planId !== snapshot.planId),
        snapshot,
      ]);
      setDetailMessages((messages) => ({ ...messages, [selectedPlanId]: '' }));
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      setDetailMessages((messages) => ({
        ...messages,
        [selectedPlanId]: error instanceof DashboardApiError
          ? error.message
          : 'The plan could not be loaded. Try again when ready.',
      }));
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, selectedPlanId, detailRefreshVersion]);

  useEffect(() => {
    if (selectedPlanId === undefined || selectedSnapshot === undefined) return;
    const controller = new AbortController();
    let active = true;
    void client.getPersonalization(selectedPlanId, controller.signal).then((state) => {
      if (!active) return;
      setPersonalizationByPlan((current) => ({ ...current, [selectedPlanId]: state }));
      setPersonalizationMessages((current) => ({ ...current, [selectedPlanId]: '' }));
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      setPersonalizationMessages((current) => ({
        ...current,
        [selectedPlanId]: error instanceof DashboardApiError
          ? error.message
          : 'Personalization settings could not be loaded.',
      }));
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, selectedPlanId, selectedSnapshot?.revisionId]);

  const selectItem = (itemId: string) => setFocusedItemId(itemId);

  const submitPersonalization = async (
    planId: string,
    mutate: () => Promise<unknown>,
    successMessage: string,
    refreshSuggestions = false,
  ): Promise<void> => {
    let committed = false;
    try {
      await mutate();
      committed = true;
      let state = await client.getPersonalization(planId);
      if (refreshSuggestions && state.consent.state === 'enabled') {
        try {
          state = (await client.evaluatePersonalization({
            planId,
            expectedStateVersion: state.stateVersion,
          })).state;
        } catch {
          setPersonalizationByPlan((current) => ({ ...current, [planId]: state }));
          setPersonalizationMessages((current) => ({
            ...current,
            [planId]: `${successMessage} Suggestions could not be refreshed.`,
          }));
          return;
        }
      }
      setPersonalizationByPlan((current) => ({ ...current, [planId]: state }));
      setPersonalizationMessages((current) => ({ ...current, [planId]: successMessage }));
    } catch (error) {
      const conflict = error instanceof DashboardApiError && error.status === 409;
      setPersonalizationMessages((current) => ({
        ...current,
        [planId]: committed
          ? `${successMessage} The latest settings could not be refreshed. Refresh before making another change.`
          : error instanceof DashboardApiError
            ? error.message
            : 'Personalization could not be saved. Try again when ready.',
      }));
      if (committed || conflict) {
        try {
          const latest = await client.getPersonalization(planId);
          setPersonalizationByPlan((current) => ({ ...current, [planId]: latest }));
        } catch {
          // Keep the current view and let the learner refresh after the service recovers.
        }
      }
    }
  };

  const changeConnectedConsent = async (
    action: 'enable' | 'pause' | 'resume' | 'revoke',
  ): Promise<void> => {
    if (selectedPlanId === undefined || selectedPersonalization === undefined) return;
    const message = action === 'enable'
      ? 'Suggestions enabled for this plan.'
      : action === 'pause'
        ? 'Suggestions paused. Confirmed progress is unchanged.'
        : action === 'resume'
          ? 'Suggestions resumed.'
          : 'Personalization disabled. Feedback is no longer used for suggestions.';
    await submitPersonalization(
      selectedPlanId,
      () => client.changePersonalizationConsent({
        planId: selectedPlanId,
        action,
        expectedStateVersion: selectedPersonalization.stateVersion,
      }),
      message,
      action === 'enable' || action === 'resume',
    );
  };

  const recordConnectedFeedback = async (
    area: PersonalizationFeedbackArea,
    value: string,
  ): Promise<void> => {
    if (selectedPlanId === undefined || selectedPersonalization === undefined) return;
    await submitPersonalization(
      selectedPlanId,
      () => client.recordLearnerFeedback({
        planId: selectedPlanId,
        ...(focusedItemId === undefined ? {} : { itemId: focusedItemId }),
        area,
        value,
        expectedStateVersion: selectedPersonalization.stateVersion,
      }),
      'Feedback saved for this plan.',
      true,
    );
  };

  const correctConnectedFeedback = async (
    feedbackId: string,
    area: PersonalizationFeedbackArea,
    value: string,
  ): Promise<void> => {
    if (selectedPlanId === undefined || selectedPersonalization === undefined) return;
    await submitPersonalization(
      selectedPlanId,
      () => client.correctLearnerFeedback({
        planId: selectedPlanId,
        feedbackId,
        area,
        value,
        expectedStateVersion: selectedPersonalization.stateVersion,
      }),
      'Feedback corrected. Suggestions use the updated value.',
      true,
    );
  };

  const deleteConnectedFeedback = async (feedbackId: string): Promise<void> => {
    if (selectedPlanId === undefined || selectedPersonalization === undefined) return;
    await submitPersonalization(
      selectedPlanId,
      () => client.deleteLearnerFeedback({
        planId: selectedPlanId,
        feedbackId,
        expectedStateVersion: selectedPersonalization.stateVersion,
      }),
      'Feedback deleted and removed from future suggestions.',
      true,
    );
  };

  const decideConnectedProposal = async (
    proposalId: string,
    proposalVersion: number,
    decision: 'accept' | 'reject',
  ): Promise<void> => {
    if (selectedPlanId === undefined || selectedPersonalization === undefined) return;
    const message = decision === 'reject'
      ? 'Suggestion marked not useful. Your accepted plan is unchanged.'
      : 'Suggestion accepted for the connected AI client. Your accepted plan is unchanged.';
    await submitPersonalization(
      selectedPlanId,
      () => client.decidePersonalizationProposal({
        planId: selectedPlanId,
        proposalId,
        decision,
        expectedStateVersion: selectedPersonalization.stateVersion,
        expectedProposalVersion: proposalVersion,
      }),
      message,
    );
  };

  useEffect(() => {
    if (focusedItemId === undefined) return;
    const target = document.querySelector<HTMLElement>(
      '[data-focus-target="focused-item"]',
    );
    if (target === null) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }, [focusedItemId]);

  const progressAction = async (
    itemId: string,
    action: LearnerActionKind,
  ): Promise<void> => {
    if (selectedPlanId === undefined) return;
    const snapshot = snapshotsById.get(selectedPlanId);
    if (snapshot === undefined) return;
    const currentProgress = snapshot.currentProgress.find(
      (record) => record.itemId === itemId,
    );
    const apiAction =
      action === 'start'
        ? 'start_item'
        : action === 'complete'
          ? 'complete_item'
          : 'undo_completion';
    const operationKey = [
      snapshot.planId,
      itemId,
      apiAction,
      snapshot.revisionId,
      currentProgress?.progressVersion ?? 0,
    ].join(':');
    let input = progressInputsRef.current.get(operationKey);
    if (input === undefined) {
      input = {
        planId: snapshot.planId,
        itemId,
        action: apiAction,
        expectedRevisionId: snapshot.revisionId,
        expectedProgressVersion: currentProgress?.progressVersion ?? 0,
        idempotencyKey: connectedOperationKey('progress'),
        confirmedAt: new Date().toISOString(),
      };
      progressInputsRef.current.set(operationKey, input);
    }
    setActionStatesByPlan((states) =>
      setActionState(states, selectedPlanId, itemId, 'submitting'),
    );
    let mutationConfirmed = false;
    try {
      await client.applyProgressAction(input);
      mutationConfirmed = true;
      const updated = snapshotFromView(await client.getPlanView(snapshot.planId));
      setSnapshots((current) =>
        current.map((entry) => (entry.planId === updated.planId ? updated : entry)),
      );
      progressInputsRef.current.delete(operationKey);
      setActionStatesByPlan((states) =>
        setActionState(states, selectedPlanId, itemId, 'available'),
      );
      setProgressMessages((messages) => ({
        ...messages,
        [selectedPlanId]: 'Confirmed progress was saved by the service.',
      }));
      void client.listPlanSummaries().then(setSummaries).catch(() => {
        setProgressMessages((messages) => ({
          ...messages,
          [selectedPlanId]: 'Progress was saved. The plan list could not be refreshed.',
        }));
      });
    } catch (error) {
      const conflict = error instanceof DashboardApiError && error.status === 409;
      if (conflict) progressInputsRef.current.delete(operationKey);
      setActionStatesByPlan((states) =>
        setActionState(
          states,
          selectedPlanId,
          itemId,
          conflict || mutationConfirmed ? 'conflict' : 'failed_retryable',
        ),
      );
      setProgressMessages((messages) => ({
        ...messages,
        [selectedPlanId]:
          mutationConfirmed
            ? 'Progress was saved. Refresh to load its latest state before continuing.'
            : error instanceof DashboardApiError
            ? error.message
            : 'Progress could not be saved. Try again when ready.',
      }));
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (selectedPlanId === undefined) return;
    const snapshot = snapshotsById.get(selectedPlanId);
    if (snapshot === undefined) return;
    const operationKey = `${snapshot.planId}:${snapshot.revisionId}`;
    let input = deleteInputsRef.current.get(operationKey);
    if (input === undefined) {
      input = {
        planId: snapshot.planId,
        expectedRevisionId: snapshot.revisionId,
        idempotencyKey: connectedOperationKey('delete'),
        deletedAt: new Date().toISOString(),
      };
      deleteInputsRef.current.set(operationKey, input);
    }
    setDeletionState('submitting');
    try {
      await client.deletePlan(input);
      deleteInputsRef.current.delete(operationKey);
      setDeletionState('deleted');
      setSnapshots((current) => current.filter((entry) => entry.planId !== snapshot.planId));
      setSummaries((current) => current.filter((entry) => entry.planId !== snapshot.planId));
      navigate('/plans');
    } catch (error) {
      const conflict = error instanceof DashboardApiError && error.status === 409;
      if (conflict) deleteInputsRef.current.delete(operationKey);
      setDeletionState(conflict ? 'conflict' : 'failed_retryable');
    }
  };

  const refresh = () => {
    void load();
    setDetailRefreshVersion((version) => version + 1);
  };

  return (
    <AppShell currentPath={route.kind === 'plans' ? '/plans' : ''} onNavigate={navigate}>
      <main id="main-content" className="page-main" tabIndex={-1}>
        {route.kind === 'unknown' ? (
          <UnavailablePage onNavigate={navigate} />
        ) : route.kind === 'plans' ? (
          <PlansPage
            preview="accepted"
            snapshots={snapshots}
            summaries={summaries}
            onNavigate={navigate}
            onRefresh={refresh}
            connected
            pageState={pageState}
            {...(pageMessage === undefined ? {} : { pageMessage })}
          />
        ) : (pageState === 'loading' || detailLoading) && selectedSnapshot === undefined ? (
          <>
            <PageHeader title="Loading plan" backHref="/plans" onNavigate={navigate} />
            <LoadingState label="Loading your accepted plan..." />
          </>
        ) : selectedSnapshot === undefined ? (
          <>
            <UnavailablePage onNavigate={navigate} />
            {selectedPlanId !== undefined && detailMessages[selectedPlanId] !== undefined ? (
              <p className="surface-note" role="status">{detailMessages[selectedPlanId]}</p>
            ) : null}
          </>
        ) : (
          <DetailPage
            planId={selectedSnapshot.planId}
            preview="accepted"
            snapshotsById={snapshotsById}
            {...(focusedItemId === undefined ? {} : { focusedItemId })}
            actionStates={actionStatesForPlan(actionStatesByPlan, selectedSnapshot.planId)}
            deletionState={deletionState}
            {...(progressMessages[selectedSnapshot.planId] === undefined
              ? {}
              : { progressMessage: progressMessages[selectedSnapshot.planId] })}
            {...(selectedPersonalization === undefined
              ? {}
              : { personalization: selectedPersonalization })}
            {...(personalizationMessages[selectedSnapshot.planId] === undefined
              ? {}
              : { personalizationMessage: personalizationMessages[selectedSnapshot.planId] })}
            connected
            onNavigate={navigate}
            onSelectItem={selectItem}
            onProgressAction={(itemId, action) => void progressAction(itemId, action)}
            onConfirmDelete={() => void confirmDelete()}
            onRetryDelete={() => setDeletionState('available')}
            onRefresh={refresh}
            onEnablePersonalization={() => void changeConnectedConsent('enable')}
            onPausePersonalization={() => void changeConnectedConsent('pause')}
            onResumePersonalization={() => void changeConnectedConsent('resume')}
            onDisablePersonalization={() => void changeConnectedConsent('revoke')}
            onRecordFeedback={(area, value) => void recordConnectedFeedback(area, value)}
            onCorrectFeedback={(feedbackId, area, value) =>
              void correctConnectedFeedback(feedbackId, area, value)}
            onDeleteFeedback={(feedbackId) => void deleteConnectedFeedback(feedbackId)}
            onAcceptProposal={(proposalId, proposalVersion) =>
              void decideConnectedProposal(proposalId, proposalVersion, 'accept')}
            onRejectProposal={(proposalId, proposalVersion) =>
              void decideConnectedProposal(proposalId, proposalVersion, 'reject')}
          />
        )}
        <footer className="page-footer">
          <span>OpenLearn live workspace</span>
          <span>Progress and deletion are saved by the service</span>
        </footer>
      </main>
    </AppShell>
  );
};

export const App = () =>
  import.meta.env.VITE_OPENLEARN_MODE === 'connected' ? (
    <ConnectedDashboard />
  ) : (
    <StaticDashboard />
  );
