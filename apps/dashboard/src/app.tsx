import { useEffect, useMemo, useState } from 'react';
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
  type PlanDataControlsViewModel,
} from '@openlearn/ui';
import {
  STATIC_PLANS,
  STATIC_PREVIEW_OPTIONS,
  STATIC_SNAPSHOTS,
  STATIC_SNAPSHOT_BY_ID,
  type StaticPreviewState,
} from './seed-data.js';
import {
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
  onNavigate,
}: {
  readonly preview: StaticPreviewState;
  readonly onNavigate: (href: string) => void;
}) => {
  const entries = useMemo(
    () =>
      STATIC_SNAPSHOTS.map((snapshot, index) => ({
        snapshot,
        href: safePlanHref(snapshot.planId),
        ...(index === 0 && ['partial', 'invalid', 'pending', 'recovering'].includes(preview)
          ? { contentState: contentStateFor(preview) }
          : {}),
      })),
    [preview],
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
  focusedItemId,
  actionStates,
  deletionState,
  onNavigate,
  onSelectItem,
  onProgressAction,
  onConfirmDelete,
  onRetryDelete,
  onRefresh,
}: {
  readonly planId: string;
  readonly preview: StaticPreviewState;
  readonly focusedItemId?: string;
  readonly actionStates: Readonly<Record<string, 'available' | 'submitting' | 'confirmed' | 'conflict' | 'failed_retryable' | 'unavailable'>>;
  readonly deletionState: DeletionState;
  readonly onNavigate: (href: string) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onProgressAction: (itemId: string) => void;
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
  const snapshot = STATIC_SNAPSHOT_BY_ID.get(sourcePlanId);
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
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [preview, setPreview] = useState<StaticPreviewState>('accepted');
  const [focusedItemId, setFocusedItemId] = useState<string | undefined>();
  const [actionStates, setActionStates] = useState<Readonly<Record<string, 'available' | 'submitting' | 'confirmed' | 'conflict' | 'failed_retryable' | 'unavailable'>>>({});
  const [deletionState, setDeletionState] = useState<DeletionState>('available');

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
  const selectedPlan =
    selectedPlanId === undefined
      ? undefined
      : STATIC_PLANS.find((plan) => plan.planId === selectedPlanId);

  const selectItem = (itemId: string) => {
    setFocusedItemId(itemId);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('focused-item-heading')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };
  const progressAction = (itemId: string) => {
    setActionStates((states) => ({ ...states, [itemId]: 'submitting' }));
  };
  const confirmDelete = () => {
    setDeletionState('submitting');
  };
  const retryDelete = () => {
    setDeletionState('available');
  };
  const refresh = () => {
    setActionStates({});
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
          <PlansPage preview={preview} onNavigate={navigate} />
        ) : selectedPlan === undefined ? (
          <UnavailablePage onNavigate={navigate} />
        ) : (
          <DetailPage
            planId={selectedPlan.planId}
            preview={preview}
            {...(focusedItemId === undefined ? {} : { focusedItemId })}
            actionStates={actionStates}
            deletionState={deletionState}
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
          <span>Deterministic fixture · no live integrations</span>
        </footer>
      </main>
    </AppShell>
  );
};
