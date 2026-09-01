export type ContentState =
  | 'accepted'
  | 'partial'
  | 'pending'
  | 'recovering'
  | 'invalid'
  | 'retryable'
  | 'cancelled'
  | 'expired'
  | 'conflict'
  | 'interrupted';

export type SurfaceState =
  | 'loading'
  | 'empty'
  | ContentState
  | 'unavailable';

export type LearnerProgressState =
  | 'not_started'
  | 'in_progress'
  | 'completed_by_learner';

export type LearnerActionKind = 'start' | 'complete' | 'undo_completion';

export type LearnerActionState =
  | 'available'
  | 'submitting'
  | 'confirmed'
  | 'conflict'
  | 'failed_retryable'
  | 'unavailable';

export type DeletionState =
  | 'available'
  | 'confirming'
  | 'submitting'
  | 'recovering'
  | 'failed_retryable'
  | 'conflict'
  | 'deleted'
  | 'unavailable';

export interface ProgressSummaryViewModel {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly inProgressCount: number;
  readonly notStartedCount: number;
  readonly label: string;
  readonly learnerConfirmed: boolean;
}

export interface ResourceViewModel {
  readonly resourceId: string;
  readonly label: string;
  readonly href?: string;
  readonly opaqueReference?: string;
}

export interface LearnerActionViewModel {
  readonly kind: LearnerActionKind;
  readonly label: string;
  readonly state: LearnerActionState;
  readonly enabled: boolean;
  readonly disabledReason?: string;
}

export interface PlanItemViewModel {
  readonly itemId: string;
  readonly title: string;
  readonly description?: string;
  readonly positionLabel: string;
  readonly progressState: LearnerProgressState;
  readonly action: LearnerActionViewModel;
  readonly resources: readonly ResourceViewModel[];
}

export interface OutlineNodeViewModel {
  readonly kind: 'milestone' | 'topic' | 'item';
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly progressState?: LearnerProgressState;
  readonly item?: PlanItemViewModel;
  readonly children: readonly OutlineNodeViewModel[];
}

export interface GoalViewModel {
  readonly title: string;
  readonly description?: string;
}

export interface ContextViewModel {
  readonly summary?: string;
  readonly entries: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}

export interface NextActionViewModel {
  readonly itemId: string;
  readonly title: string;
  readonly description?: string;
}

export interface TrustViewModel {
  readonly label: string;
  readonly detail: string;
  readonly tone: 'success' | 'info' | 'warning' | 'danger';
}

export interface OperationStatusViewModel {
  readonly label: string;
  readonly state: 'pending' | 'recovering' | 'retryable' | 'conflict' | 'interrupted';
}

export interface RecoveryViewModel {
  readonly label: string;
  readonly detail: string;
  readonly actionLabel?: string;
}

export interface PlanDataControlsViewModel {
  readonly deletion: {
    readonly state: DeletionState;
    readonly label: string;
    readonly consequence?: string;
    readonly enabled: boolean;
    readonly disabledReason?: string;
  };
}

export type PersonalizationConsentViewState =
  | 'disabled'
  | 'enabled'
  | 'paused'
  | 'revoked';

export type PersonalizationFeedbackAreaView =
  | 'difficulty'
  | 'pace'
  | 'relevance';

export interface PersonalizationFeedbackOptionViewModel {
  readonly value: string;
  readonly label: string;
}

export interface PersonalizationFeedbackViewModel {
  readonly feedbackId: string;
  readonly area: PersonalizationFeedbackAreaView;
  readonly areaLabel: string;
  readonly value: string;
  readonly valueLabel: string;
  readonly status: 'active' | 'corrected';
  readonly itemLabel?: string;
  readonly correctionOptions: readonly PersonalizationFeedbackOptionViewModel[];
}

export type PersonalizationProposalKindView =
  | 'recommend_existing_next_step'
  | 'suggest_pacing_preference'
  | 'request_plan_revision';

export interface PersonalizationProposalViewModel {
  readonly proposalId: string;
  readonly kind: PersonalizationProposalKindView;
  readonly title: string;
  readonly explanation: string;
  readonly basis: readonly string[];
  readonly status: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  readonly statusLabel: string;
  readonly proposalVersion: number;
  readonly canDecide: boolean;
  readonly handoffLabel?: string;
}

export interface PersonalizationViewModel {
  readonly state: PersonalizationConsentViewState;
  readonly consentVersion: number;
  readonly scopeLabel: string;
  readonly explanation: string;
  readonly feedbackTargetLabel?: string;
  readonly feedbackAreas: readonly {
    readonly area: PersonalizationFeedbackAreaView;
    readonly label: string;
    readonly options: readonly PersonalizationFeedbackOptionViewModel[];
  }[];
  readonly feedback: readonly PersonalizationFeedbackViewModel[];
  readonly proposals: readonly PersonalizationProposalViewModel[];
  readonly statusMessage?: string;
}

export interface PlanSummaryViewModel {
  readonly planId: string;
  readonly href: string;
  readonly title: string;
  readonly goalSummary: string;
  readonly contentState: ContentState;
  readonly progress: ProgressSummaryViewModel;
  readonly nextAction?: NextActionViewModel;
  readonly updatedAt: string;
}

export interface PlanListViewModel {
  readonly pageState: 'loading' | 'ready' | 'empty' | 'error';
  readonly pageMessage?: string;
  readonly plans: readonly PlanSummaryViewModel[];
}

export interface PlanDetailViewModel {
  readonly surfaceState: SurfaceState;
  readonly reference: {
    readonly planId: string;
    readonly href: string;
  };
  readonly title: string;
  readonly trust: TrustViewModel;
  readonly goal?: GoalViewModel;
  readonly context?: ContextViewModel;
  readonly progress: ProgressSummaryViewModel;
  readonly progressMessage?: string;
  readonly nextAction?: NextActionViewModel;
  readonly outline: readonly OutlineNodeViewModel[];
  readonly focusedItem?: PlanItemViewModel;
  readonly operation?: OperationStatusViewModel;
  readonly recovery?: RecoveryViewModel;
  readonly dataControls?: PlanDataControlsViewModel;
  readonly personalization?: PersonalizationViewModel;
}
