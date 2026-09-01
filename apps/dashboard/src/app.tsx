import { useEffect, useMemo, useState } from 'react';
import type { ActivePlanAggregate } from '@openlearn/domain';
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
  onNavigate,
  onSelectItem,
  onProgressAction,
  onConfirmDelete,
  onRetryDelete,
  onRefresh,
}: {
  readonly planId: string;
  readonly preview: StaticPreviewState;
  readonly snapshotsById: ReadonlyMap<string, AcceptedPlanSnapshotInput>;
  readonly focusedItemId?: string;
  readonly actionStates: Readonly<Record<string, LearnerActionState>>;
  readonly deletionState: DeletionState;
  readonly progressMessage?: string;
  readonly onNavigate: (href: string) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onProgressAction: (itemId: string, action: LearnerActionKind) => void;
  readonly onConfirmDelete: () => void;
  readonly onRetryDelete: () => void;
  readonly onRefresh: () => void;
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

  const sourcePlanId = preview === 'partial' ? 'static-plan-partial' : preview === 'completed' || preview === 'conflict' ? 'static-plan-progress' : planId;
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
      />
    </>
  );
};

export const App = () => {
  const progressStore = useMemo(
    () => createProgressStore(browserStorage()),
    [],
  );
  const hydratePlans = () => planMap(progressStore);
  const [plans, setPlans] = useState<Map<string, ActivePlanAggregate>>(() => hydratePlans());
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [preview, setPreview] = useState<StaticPreviewState>('accepted');
  const [focusedItemId, setFocusedItemId] = useState<string | undefined>();
  const [actionStatesByPlan, setActionStatesByPlan] = useState<ActionStatesByPlan>({});
  const [deletionState, setDeletionState] = useState<DeletionState>('available');
  const [progressMessages, setProgressMessages] = useState<Readonly<Record<string, string>>>({});

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
  };
  const confirmDelete = () => {
    setDeletionState('submitting');
  };
  const retryDelete = () => {
    setDeletionState('available');
  };
  const refresh = () => {
    setPlans(hydratePlans());
    setActionStatesByPlan({});
    setProgressMessages({});
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
            onNavigate={navigate}
            onSelectItem={selectItem}
            onProgressAction={progressAction}
            onConfirmDelete={confirmDelete}
            onRetryDelete={retryDelete}
            onRefresh={refresh}
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
