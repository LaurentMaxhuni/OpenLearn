import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type {
  ContentState,
  ContextViewModel,
  DeletionState,
  GoalViewModel,
  LearnerActionKind,
  LearnerActionViewModel,
  LearnerProgressState,
  NextActionViewModel,
  OperationStatusViewModel,
  OutlineNodeViewModel,
  PlanDataControlsViewModel,
  PlanDetailViewModel,
  PlanItemViewModel,
  PlanListViewModel,
  PlanSummaryViewModel,
  ProgressSummaryViewModel,
  RecoveryViewModel,
  ResourceViewModel,
  SurfaceState,
  TrustViewModel,
} from './models.js';

const progressLabel = (state: LearnerProgressState): string => {
  switch (state) {
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'completed_by_learner':
      return 'Completed by you';
  }
};

const stateLabel = (state: ContentState): string => {
  switch (state) {
    case 'accepted':
      return 'Accepted';
    case 'partial':
      return 'Partial';
    case 'pending':
      return 'Pending';
    case 'recovering':
      return 'Recovering';
    case 'invalid':
      return 'Needs attention';
    case 'retryable':
      return 'Retryable';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    case 'conflict':
      return 'Conflict';
    case 'interrupted':
      return 'Interrupted';
  }
};

const navigationClick = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  onNavigate?: (href: string) => void,
) => {
  if (
    onNavigate !== undefined &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    onNavigate(href);
  }
};

export interface AppShellProps {
  readonly children: ReactNode;
  readonly currentPath?: string;
  readonly preview?: ReactNode;
  readonly onNavigate?: (href: string) => void;
}

export const AppShell = ({
  children,
  currentPath,
  preview,
  onNavigate,
}: AppShellProps) => (
  <>
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
    <div className="app-frame">
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="/plans"
            onClick={(event) => navigationClick(event, '/plans', onNavigate)}
          >
            <span className="brand-mark" aria-hidden="true">
              O
            </span>
            <span>
              <strong>OpenLearn</strong>
              <small>Learning workspace</small>
            </span>
          </a>
          <nav className="primary-nav" aria-label="Primary navigation">
            <a
              className={currentPath === '/plans' ? 'nav-link active' : 'nav-link'}
              href="/plans"
              aria-current={currentPath === '/plans' ? 'page' : undefined}
              onClick={(event) => navigationClick(event, '/plans', onNavigate)}
            >
              Plans
            </a>
          </nav>
          <div className="header-actions">{preview}</div>
        </div>
      </header>
      {children}
    </div>
  </>
);

export interface PageHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly onNavigate?: (href: string) => void;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Back to plans',
  onNavigate,
}: PageHeaderProps) => (
  <header className="page-header">
    {backHref === undefined ? null : (
      <a
        className="back-link"
        href={backHref}
        onClick={(event) => navigationClick(event, backHref, onNavigate)}
      >
        <span aria-hidden="true">←</span> {backLabel}
      </a>
    )}
    {eyebrow === undefined ? null : <p className="eyebrow">{eyebrow}</p>}
    <h1>{title}</h1>
    {description === undefined ? null : <p className="page-description">{description}</p>}
  </header>
);

export interface TrustStateBannerProps {
  readonly surfaceState: SurfaceState;
  readonly trust: TrustViewModel;
  readonly operation?: OperationStatusViewModel;
  readonly recovery?: RecoveryViewModel;
}

export const TrustStateBanner = ({
  surfaceState,
  trust,
  operation,
  recovery,
}: TrustStateBannerProps) => {
  const blocking = surfaceState === 'invalid' || surfaceState === 'unavailable';
  return (
    <section
      className={`trust-banner tone-${trust.tone}`}
      aria-label="Plan status"
      role={blocking ? 'alert' : 'status'}
      aria-live={blocking ? 'assertive' : 'polite'}
    >
      <div className="trust-icon" aria-hidden="true">
        {trust.tone === 'success' ? '✓' : trust.tone === 'danger' ? '!' : 'i'}
      </div>
      <div>
        <p className="trust-label">
          <span className="state-pill">{surfaceState === 'unavailable' ? 'Unavailable' : stateLabel(surfaceState as ContentState)}</span>{' '}
          {trust.label}
        </p>
        <p>{trust.detail}</p>
        {operation === undefined ? null : (
          <p className="operation-note">{operation.label}</p>
        )}
        {recovery === undefined ? null : <p className="operation-note">{recovery.detail}</p>}
      </div>
    </section>
  );
};

export interface GoalContextProps {
  readonly goal?: GoalViewModel;
  readonly context?: ContextViewModel;
}

export const GoalContext = ({ goal, context }: GoalContextProps) => (
  <section className="panel goal-panel" aria-labelledby="goal-heading">
    <div className="section-heading">
      <p className="eyebrow">Orientation</p>
      <h2 id="goal-heading">Goal and context</h2>
    </div>
    {goal === undefined ? (
      <p className="muted">No accepted goal is available.</p>
    ) : (
      <div className="goal-content">
        <h3>{goal.title}</h3>
        {goal.description === undefined ? null : <p>{goal.description}</p>}
      </div>
    )}
    {context === undefined ? (
      <p className="context-empty">No additional context was supplied.</p>
    ) : (
      <div className="context-content">
        {context.summary === undefined ? null : <p>{context.summary}</p>}
        {context.entries.length === 0 ? null : (
          <dl className="context-list">
            {context.entries.map((entry) => (
              <div key={entry.label}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    )}
  </section>
);

export interface ProgressSummaryProps {
  readonly progress: ProgressSummaryViewModel;
  readonly actionMessage?: string;
}

export const ProgressSummary = ({ progress, actionMessage }: ProgressSummaryProps) => {
  const percentage =
    progress.totalCount === 0
      ? 0
      : Math.round((progress.completedCount / progress.totalCount) * 100);
  return (
    <section className="panel progress-panel" aria-labelledby="progress-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">Learner progress</p>
        <h2 id="progress-heading">Your progress</h2>
      </div>
      <div className="progress-row">
        <strong>{progress.label}</strong>
        <span className="progress-percent">{percentage}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Items completed by you"
        aria-valuemin={0}
        aria-valuemax={progress.totalCount}
        aria-valuenow={progress.completedCount}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p className="progress-detail">
        {progress.inProgressCount > 0
          ? `${progress.inProgressCount} item${progress.inProgressCount === 1 ? '' : 's'} in progress · ${progress.notStartedCount} not started`
          : progress.completedCount === progress.totalCount && progress.totalCount > 0
            ? 'All current items are complete.'
            : `${progress.notStartedCount} item${progress.notStartedCount === 1 ? '' : 's'} not started`}
      </p>
      {actionMessage === undefined ? null : (
        <p className="live-note" role="status">
          {actionMessage}
        </p>
      )}
    </section>
  );
};

export interface NextActionCardProps {
  readonly nextAction?: NextActionViewModel;
  readonly onSelect?: (itemId: string) => void;
  readonly disabled?: boolean;
}

export const NextActionCard = ({
  nextAction,
  onSelect,
  disabled = false,
}: NextActionCardProps) => (
  <section className="next-action-card" aria-labelledby="next-action-heading">
    <div>
      <p className="eyebrow">Suggested next step</p>
      <h2 id="next-action-heading">
        {nextAction === undefined ? 'You have reached the end of this plan' : nextAction.title}
      </h2>
      {nextAction === undefined ? (
        <p>All current items are completed by you.</p>
      ) : nextAction.description === undefined ? null : (
        <p>{nextAction.description}</p>
      )}
    </div>
    {nextAction === undefined || onSelect === undefined ? null : (
      <button
        className="button button-primary"
        type="button"
        disabled={disabled}
        onClick={() => onSelect(nextAction.itemId)}
      >
        Open next item <span aria-hidden="true">→</span>
      </button>
    )}
  </section>
);

const ProgressBadge = ({ state }: { readonly state?: LearnerProgressState }) =>
  state === undefined ? null : (
    <span className={`progress-badge progress-${state}`}>
      <span className="badge-dot" aria-hidden="true" />
      {progressLabel(state)}
    </span>
  );

export interface PlanOutlineProps {
  readonly nodes: readonly OutlineNodeViewModel[];
  readonly focusedItemId?: string;
  readonly onSelectItem?: (itemId: string) => void;
}

const safeDomId = (value: string): string =>
  value.replace(/[^a-z0-9_-]/giu, '-');

interface OutlineGroupProps {
  readonly node: OutlineNodeViewModel;
  readonly focusedItemId?: string;
  readonly onSelectItem?: (itemId: string) => void;
}

const OutlineGroup = ({
  node,
  focusedItemId,
  onSelectItem,
}: OutlineGroupProps) => {
  const [expanded, setExpanded] = useState(true);
  const contentId = `outline-${node.kind}-${safeDomId(node.id)}`;
  return (
    <li className={`outline-group outline-${node.kind}`}>
      <button
        className="outline-group-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>{node.title}</span>
        <span className="outline-count">
          {node.children.length} {node.kind === 'milestone' ? 'topic' : 'item'}
          {node.children.length === 1 ? '' : 's'}
        </span>
      </button>
      <div className="outline-group-content" id={contentId} hidden={!expanded}>
        {node.description === undefined ? null : (
          <p className="outline-description">{node.description}</p>
        )}
        <OutlineNodes
          nodes={node.children}
          {...(focusedItemId === undefined ? {} : { focusedItemId })}
          {...(onSelectItem === undefined ? {} : { onSelectItem })}
        />
      </div>
    </li>
  );
};

const OutlineNodes = ({
  nodes,
  focusedItemId,
  onSelectItem,
}: PlanOutlineProps & { readonly nodes: readonly OutlineNodeViewModel[] }) => (
  <ul className="outline-list">
    {nodes.map((node) => {
      if (node.kind === 'item') {
        const selected = node.id === focusedItemId;
        return (
          <li className={selected ? 'outline-item current' : 'outline-item'} key={node.id}>
            <button
              type="button"
              className="outline-item-button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelectItem?.(node.id)}
            >
              <span className="item-title">{node.title}</span>
              {node.progressState === undefined ? null : (
                <ProgressBadge state={node.progressState} />
              )}
            </button>
          </li>
        );
      }
      return (
        <OutlineGroup
          key={node.id}
          node={node}
          {...(focusedItemId === undefined ? {} : { focusedItemId })}
          {...(onSelectItem === undefined ? {} : { onSelectItem })}
        />
      );
    })}
  </ul>
);

export const PlanOutline = ({
  nodes,
  focusedItemId,
  onSelectItem,
}: PlanOutlineProps) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="panel outline-panel" aria-labelledby="outline-heading">
      <div className="section-heading outline-heading">
        <div>
          <p className="eyebrow">The path</p>
          <h2 id="outline-heading">Plan outline</h2>
        </div>
        <button
          className="button button-quiet"
          type="button"
          aria-expanded={expanded}
          aria-controls="plan-outline-content"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Collapse outline' : 'Expand outline'}
        </button>
      </div>
      <div id="plan-outline-content" hidden={!expanded}>
        {nodes.length === 0 ? (
          <p className="muted">No accepted outline is available.</p>
        ) : (
          <OutlineNodes
            nodes={nodes}
            {...(focusedItemId === undefined ? {} : { focusedItemId })}
            {...(onSelectItem === undefined ? {} : { onSelectItem })}
          />
        )}
      </div>
    </section>
  );
};

export interface ResourceListProps {
  readonly resources: readonly ResourceViewModel[];
}

export const ResourceList = ({ resources }: ResourceListProps) => (
  <section className="resources" aria-labelledby="resources-heading">
    <h3 id="resources-heading">Resources</h3>
    {resources.length === 0 ? (
      <p className="muted">No resources supplied.</p>
    ) : (
      <ul className="resource-list">
        {resources.map((resource) => (
          <li key={resource.resourceId}>
            {resource.href === undefined ? (
              <span className="resource-label">{resource.label}</span>
            ) : (
              <a href={resource.href} className="resource-link">
                <span>{resource.label}</span>
                <span className="resource-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            )}
            {resource.opaqueReference === undefined ? null : (
              <span className="resource-reference">Reference supplied by the connected client</span>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export interface LearnerProgressActionProps {
  readonly action: LearnerActionViewModel;
  readonly onAction?: () => void;
}

export const LearnerProgressAction = ({
  action,
  onAction,
}: LearnerProgressActionProps) => (
  <div className="learner-action">
    <button
      className={action.kind === 'undo_completion' ? 'button button-secondary' : 'button button-primary'}
      type="button"
      disabled={!action.enabled || onAction === undefined}
      aria-describedby="learner-action-status"
      onClick={() => onAction?.()}
    >
      {action.label}
    </button>
    <p id="learner-action-status" className="action-status" role="status" aria-live="polite">
      {action.state === 'submitting'
        ? 'This action is being submitted.'
        : action.state === 'confirmed'
          ? 'Your confirmed progress is up to date.'
          : action.disabledReason ?? ''}
    </p>
  </div>
);

export interface PlanItemDetailProps {
  readonly item?: PlanItemViewModel;
  readonly onProgressAction?: (itemId: string, action: LearnerActionKind) => void;
}

export const PlanItemDetail = ({ item, onProgressAction }: PlanItemDetailProps) => (
  <section className="panel focused-panel" aria-labelledby="focused-item-heading" tabIndex={-1}>
    <div className="section-heading">
      <p className="eyebrow">Focused item</p>
      <h2 id="focused-item-heading">{item === undefined ? 'No item selected' : item.title}</h2>
    </div>
    {item === undefined ? (
      <p className="muted">Select an item from the outline to inspect it here.</p>
    ) : (
      <>
        <div className="focused-meta">
          <span>{item.positionLabel}</span>
          <span className={`status-text status-${item.progressState}`}>
            {progressLabel(item.progressState)}
          </span>
        </div>
        {item.description === undefined ? (
          <p className="context-empty">No description was supplied for this item.</p>
        ) : (
          <p className="focused-description">{item.description}</p>
        )}
        <LearnerProgressAction
          action={item.action}
          {...(onProgressAction === undefined
            ? {}
            : { onAction: () => onProgressAction(item.itemId, item.action.kind) })}
        />
        <ResourceList resources={item.resources} />
      </>
    )}
  </section>
);

export interface PlanDataControlsProps {
  readonly controls: PlanDataControlsViewModel;
  readonly onConfirmDelete?: () => void;
  readonly onRetryDelete?: () => void;
  readonly onRefresh?: () => void;
}

const deletionStatus = (state: DeletionState): string | undefined => {
  switch (state) {
    case 'submitting':
      return 'Deleting this plan…';
    case 'recovering':
      return 'We’re checking whether deletion completed.';
    case 'failed_retryable':
      return 'The plan was not deleted. Try again.';
    case 'conflict':
      return 'This plan changed. Refresh before trying to delete it again.';
    case 'deleted':
      return 'This plan has been deleted.';
    case 'unavailable':
      return 'Plan data controls are unavailable.';
    default:
      return undefined;
  }
};

export const PlanDataControls = ({
  controls,
  onConfirmDelete,
  onRetryDelete,
  onRefresh,
}: PlanDataControlsProps) => {
  const [confirming, setConfirming] = useState(controls.deletion.state === 'confirming');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) {
      return undefined;
    }
    keepRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirming(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming]);

  const closeConfirmation = () => {
    setConfirming(false);
    triggerRef.current?.focus();
  };
  const status = deletionStatus(controls.deletion.state);
  const canConfirm = controls.deletion.enabled && controls.deletion.state === 'available';

  return (
    <section className="panel data-controls" aria-labelledby="data-controls-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">Data controls</p>
        <h2 id="data-controls-heading">Plan data</h2>
      </div>
      <p className="muted">Delete this accepted plan and its learner progress from your workspace.</p>
      {status === undefined ? null : (
        <p className="control-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
      <button
        ref={triggerRef}
        className="button button-danger"
        type="button"
        disabled={!canConfirm}
        aria-expanded={confirming}
        aria-controls="delete-plan-confirmation"
        onClick={() => setConfirming(true)}
      >
        {controls.deletion.label}
      </button>
      {controls.deletion.state === 'failed_retryable' && onRetryDelete === undefined ? null : (
        controls.deletion.state === 'failed_retryable' && onRetryDelete !== undefined ? (
          <button className="button button-quiet" type="button" onClick={onRetryDelete}>
            Try again
          </button>
        ) : null
      )}
      {controls.deletion.state === 'conflict' && onRefresh === undefined ? null : (
        controls.deletion.state === 'conflict' && onRefresh !== undefined ? (
          <button className="button button-quiet" type="button" onClick={onRefresh}>
            Refresh plan
          </button>
        ) : null
      )}
      {confirming ? (
        <div className="confirmation" id="delete-plan-confirmation">
          <h3>Delete this plan?</h3>
          <p>
            {controls.deletion.consequence ??
              'This action is irreversible. The accepted plan and learner progress will be purged within 24 hours.'}
          </p>
          <div className="confirmation-actions">
            <button
              ref={keepRef}
              className="button button-secondary"
              type="button"
              onClick={closeConfirmation}
            >
              Keep plan
            </button>
            <button
              className="button button-danger"
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                setConfirming(false);
                onConfirmDelete?.();
              }}
            >
              Confirm delete
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export interface PlanSummaryCardProps {
  readonly plan: PlanSummaryViewModel;
  readonly onNavigate?: (href: string) => void;
}

export const PlanSummaryCard = ({ plan, onNavigate }: PlanSummaryCardProps) => (
  <li className="plan-card-item">
    <article className="plan-card">
      <a
        className="plan-card-link"
        href={plan.href}
        onClick={(event) => navigationClick(event, plan.href, onNavigate)}
      >
        <div className="plan-card-topline">
          <span className="state-pill">{stateLabel(plan.contentState)}</span>
          <span className="plan-arrow" aria-hidden="true">
            →
          </span>
        </div>
        <h2>{plan.title}</h2>
        <p>{plan.goalSummary}</p>
        <div className="plan-card-footer">
          <span>{plan.progress.label}</span>
          {plan.nextAction === undefined ? (
            <span>All current items complete</span>
          ) : (
            <span>Next: {plan.nextAction.title}</span>
          )}
        </div>
      </a>
    </article>
  </li>
);

export const LoadingState = ({ label = 'Loading your learning workspace…' }: { readonly label?: string }) => (
  <section className="panel state-panel loading-panel" role="status" aria-live="polite">
    <div className="skeleton skeleton-wide" aria-hidden="true" />
    <div className="skeleton skeleton-medium" aria-hidden="true" />
    <p>{label}</p>
  </section>
);

export interface EmptyStateProps {
  readonly title: string;
  readonly message: string;
}

export const EmptyState = ({ title, message }: EmptyStateProps) => (
  <section className="panel state-panel empty-panel" aria-labelledby="empty-heading">
    <span className="empty-icon" aria-hidden="true">
      ◌
    </span>
    <h2 id="empty-heading">{title}</h2>
    <p>{message}</p>
  </section>
);

export interface RecoveryPanelProps {
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export const RecoveryPanel = ({
  title,
  message,
  actionLabel,
  onAction,
}: RecoveryPanelProps) => (
  <section className="panel state-panel recovery-panel" role="alert" aria-labelledby="recovery-heading">
    <span className="recovery-icon" aria-hidden="true">
      !
    </span>
    <div>
      <h2 id="recovery-heading">{title}</h2>
      <p>{message}</p>
      {actionLabel === undefined || onAction === undefined ? null : (
        <button className="button button-secondary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  </section>
);

export interface PlanCollectionProps {
  readonly model: PlanListViewModel;
  readonly onNavigate?: (href: string) => void;
}

export const PlanCollection = ({ model, onNavigate }: PlanCollectionProps) => {
  if (model.pageState === 'loading') {
    return <LoadingState label="Loading your plans…" />;
  }
  if (model.pageState === 'empty') {
    return (
      <EmptyState
        title="No plans yet"
        message={model.pageMessage ?? 'A connected AI client can supply your first learning plan.'}
      />
    );
  }
  if (model.pageState === 'error') {
    return (
      <RecoveryPanel
        title="Your plans are unavailable"
        message={model.pageMessage ?? 'Try again or refresh when you are ready.'}
      />
    );
  }
  return (
    <ol className="plan-list" aria-label="Your learning plans">
      {model.plans.map((plan) => (
        <PlanSummaryCard
          key={plan.planId}
          plan={plan}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
      ))}
    </ol>
  );
};

export interface DashboardDetailProps {
  readonly model: PlanDetailViewModel;
  readonly onSelectItem?: (itemId: string) => void;
  readonly onProgressAction?: (itemId: string, action: LearnerActionKind) => void;
  readonly onConfirmDelete?: () => void;
  readonly onRetryDelete?: () => void;
  readonly onRefresh?: () => void;
}

export const DashboardDetail = ({
  model,
  onSelectItem,
  onProgressAction,
  onConfirmDelete,
  onRetryDelete,
  onRefresh,
}: DashboardDetailProps) => (
  <>
    <TrustStateBanner
      surfaceState={model.surfaceState}
      trust={model.trust}
      {...(model.operation === undefined ? {} : { operation: model.operation })}
      {...(model.recovery === undefined ? {} : { recovery: model.recovery })}
    />
    <div className="dashboard-summary">
      <GoalContext
        {...(model.goal === undefined ? {} : { goal: model.goal })}
        {...(model.context === undefined ? {} : { context: model.context })}
      />
      <ProgressSummary
        progress={model.progress}
        {...(model.progressMessage === undefined
          ? {}
          : { actionMessage: model.progressMessage })}
      />
      <NextActionCard
        {...(model.nextAction === undefined ? {} : { nextAction: model.nextAction })}
        {...(onSelectItem === undefined ? {} : { onSelect: onSelectItem })}
        disabled={model.operation !== undefined}
      />
    </div>
    <div className="dashboard-workspace">
      <PlanOutline
        nodes={model.outline}
        {...(model.focusedItem === undefined
          ? {}
          : { focusedItemId: model.focusedItem.itemId })}
        {...(onSelectItem === undefined ? {} : { onSelectItem })}
      />
      <PlanItemDetail
        {...(model.focusedItem === undefined ? {} : { item: model.focusedItem })}
        {...(onProgressAction === undefined ? {} : { onProgressAction })}
      />
    </div>
    {model.dataControls === undefined ? null : (
      <PlanDataControls
        controls={model.dataControls}
        {...(onConfirmDelete === undefined ? {} : { onConfirmDelete })}
        {...(onRetryDelete === undefined ? {} : { onRetryDelete })}
        {...(onRefresh === undefined ? {} : { onRefresh })}
      />
    )}
  </>
);
