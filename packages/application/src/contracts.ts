import type {
  AcceptedPlanSnapshot,
  InternalOwnerId,
  PlanAggregate,
  PlanId,
  PlanItemId,
  RevisionId,
} from '@openlearn/domain';

export const CAPABILITY_SCOPES = [
  'plan:read',
  'plan:write',
  'progress:write',
  'personalization:read',
  'personalization:write',
] as const;

export type CapabilityScope = (typeof CAPABILITY_SCOPES)[number];

export const APPLICATION_OPERATION_STATES = [
  'received',
  'in_progress',
  'reconciling',
  'succeeded',
  'rejected',
  'failed_retryable',
  'cancelled',
  'expired',
  'conflict',
] as const;

export type OperationState = (typeof APPLICATION_OPERATION_STATES)[number];

export type ActorClass =
  | 'dashboard_session'
  | 'remote_mcp'
  | 'local_stdio';

export interface ActorContext {
  readonly ownerId: InternalOwnerId;
  readonly scopes: readonly CapabilityScope[];
  readonly actorClass: ActorClass;
}

export type OperationKind =
  | 'create_plan_view'
  | 'replace_plan_view'
  | 'apply_progress_action';

export interface OperationView {
  readonly operationId: string;
  readonly state: OperationState;
}

export interface SafeApplicationError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ApplicationResult<T> {
  readonly outcome: OperationState;
  readonly operation: OperationView;
  readonly value?: T;
  readonly error?: SafeApplicationError;
}

export interface PlanHandoff {
  readonly planId: PlanId;
  readonly revisionId: RevisionId;
  readonly revisionNumber: number;
  readonly dashboardUrl: string;
}

export interface PlanView extends AcceptedPlanSnapshot {
  readonly dashboardUrl: string;
}

export interface CreatePlanViewInput {
  readonly idempotencyKey: string;
  readonly candidate: unknown;
  readonly acceptedAt: string;
  readonly planId?: string;
  readonly expectedRevisionId?: string;
}

export interface GetPlanViewInput {
  readonly planId: string;
}

export type ProgressAction =
  | 'start_item'
  | 'complete_item'
  | 'undo_completion';

export interface ApplyProgressActionInput {
  readonly planId: string;
  readonly itemId: string;
  readonly action: ProgressAction;
  readonly expectedRevisionId: string;
  readonly expectedProgressVersion: number;
  readonly idempotencyKey: string;
  readonly confirmedAt: string;
}

export interface OperationRecord {
  readonly operationId: string;
  readonly kind: OperationKind;
  readonly ownerId: InternalOwnerId;
  readonly capability: CapabilityScope;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly state: OperationState;
  readonly startedAt: string;
  readonly deadlineAt: string;
  readonly leaseExpiresAt: string;
  readonly fencingVersion: number;
  readonly outcome?: StoredOperationOutcome;
}

export type TerminalOperationState = Exclude<
  OperationState,
  'received' | 'in_progress' | 'reconciling'
>;

export interface StoredOperationOutcome {
  readonly state: TerminalOperationState;
  readonly planId?: PlanId;
  readonly revisionId?: RevisionId;
  readonly revisionNumber?: number;
  readonly dashboardUrl?: string;
  readonly snapshot?: AcceptedPlanSnapshot;
  readonly error?: SafeApplicationError;
}

export interface MutationReference {
  readonly operationId: string;
  readonly ownerId: InternalOwnerId;
  readonly capability: CapabilityScope;
  readonly requestFingerprint: string;
  readonly outcome: StoredOperationOutcome;
}

export interface OperationReservationInput {
  readonly operationId: string;
  readonly kind: OperationKind;
  readonly ownerId: InternalOwnerId;
  readonly capability: CapabilityScope;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly startedAt: string;
  readonly deadlineAt: string;
  readonly leaseExpiresAt: string;
}

export type OperationReservation =
  | { readonly kind: 'created'; readonly operation: OperationRecord }
  | { readonly kind: 'existing'; readonly operation: OperationRecord };

export interface MutationCommit {
  readonly plan?: PlanAggregate;
  readonly outcome: StoredOperationOutcome;
  readonly reference: MutationReference;
}

export interface TelemetryEvent {
  readonly operationId?: string;
  readonly requestId?: string;
  readonly capability: CapabilityScope;
  readonly actorClass: ActorClass;
  readonly transition: OperationState;
  readonly durationMs?: number;
  readonly validationCategory?: string;
}
