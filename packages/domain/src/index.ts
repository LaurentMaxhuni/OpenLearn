export { DOMAIN_LIMITS } from './limits.js';
export {
  normalizePlanContent,
} from './normalize.js';
export {
  createPlan,
  replacePlan,
} from './plan.js';
export {
  applyProgressAction,
  effectiveProgress,
} from './progress.js';
export type {
  LearnerAction,
  ProgressCommand,
} from './progress.js';
export { deletePlan } from './deletion.js';
export type { DeletePlanCommand } from './deletion.js';
export {
  RETENTION_DURATIONS_MS,
  retentionDeadlines,
  type RetentionDeadlines,
} from './retention.js';
export {
  accountDeletionFixture,
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
  acceptedPartialFixture,
  deletionConfirmationFixture,
  deletionConflictFixture,
  deletionRecoveringFixture,
  duplicateIdentifiersFixture,
  deletedPlanFixture,
  malformedCandidateFixture,
  opaqueResourceFixture,
  progressCompletedWithUndoFixture,
  progressCompletionPendingFixture,
  progressConflictFixture,
  progressInProgressFixture,
  progressNotStartedFixture,
  progressUndoPendingFixture,
  revisionPreservesProgressFixture,
  staleRevisionConflictFixture,
  unsafeResourceFixture,
  unauthorizedPlanFixture,
} from './fixtures.js';
export type {
  AccountDeletionFixture,
  CandidateRejectionFixture,
  DeletionOperationFixture,
  DeletionConflictFixture,
  OpaqueResourceFixture,
  ProgressCompletedWithUndoFixture,
  ProgressCompletionPendingFixture,
  ProgressConflictFixture,
  ProgressStateFixture,
  ProgressUndoPendingFixture,
  RevisionPreservesProgressFixture,
  StaleRevisionConflictFixture,
} from './fixtures.js';
export {
  readOwnedAcceptedSnapshot,
} from './snapshots.js';
export type {
  AcceptedPlanSnapshot,
  ProgressSummary,
} from './snapshots.js';
export type {
  CreatePlanCommand,
  ReplacePlanCommand,
} from './revisions.js';
export { validatePlanCandidate } from './validation.js';
export {
  DOMAIN_ERROR_CATEGORIES,
  fail,
  succeed,
  type DomainErrorCategory,
  type DomainErrorCode,
  type DomainErrorDetail,
  type DomainFailure,
  type DomainResult,
  type DomainSuccess,
} from './errors.js';
export {
  IDENTIFIER_KINDS,
  IDENTIFIER_PATTERN,
  brandIdentifier,
  type IdentifierForKind,
  type IdentifierKind,
  type IdentityAllocator,
} from './identity.js';
export type {
  AcceptedRevisionRef,
  ActivePlanAggregate,
  BoundedOpaqueText,
  CanonicalPlanContent,
  Context,
  ContextEntry,
  ContextEntryId,
  DeletedPlanAggregate,
  Goal,
  GoalId,
  InternalOwnerId,
  LearnerProgressRecord,
  LongText,
  Milestone,
  MilestoneId,
  NonCompleteProgressState,
  NonEmptyReadonlyArray,
  NonNegativeInteger,
  NormalizedPlanContent,
  PlanAggregate,
  PlanDeletionTombstone,
  PlanId,
  PlanItem,
  PlanItemId,
  PlanLifecycle,
  PositiveInteger,
  ProgressState,
  Resource,
  ResourceId,
  RevisionId,
  SafeHttpsUrl,
  ShortText,
  Timestamp,
  Topic,
  TopicId,
} from './types.js';
