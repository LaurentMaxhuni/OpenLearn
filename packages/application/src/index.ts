export {
  APPLICATION_OPERATION_STATES,
  CAPABILITY_SCOPES,
  type ActorClass,
  type ActorContext,
  type ApplicationResult,
  type ApplyProgressActionInput,
  type CapabilityScope,
  type CreatePlanViewInput,
  type GetPlanViewInput,
  type MutationCommit,
  type MutationReference,
  type OperationKind,
  type OperationRecord,
  type OperationReservation,
  type OperationReservationInput,
  type OperationState,
  type OperationView,
  type PlanHandoff,
  type PlanView,
  type ProgressAction,
  type SafeApplicationError,
  type StoredOperationOutcome,
  type TelemetryEvent,
  type TerminalOperationState,
} from './contracts.js';
export {
  APPLICATION_ERROR_CODES,
  applicationFailure,
  applicationSuccess,
  type ApplicationErrorCode,
} from './errors.js';
export type {
  ApplicationDependencies,
  ApplicationStatePort,
  Clock,
  OperationIdGenerator,
  PersonalizationStatePort,
  PersonalizationWriteResult,
  TelemetrySink,
} from './ports.js';
export type { ApplicationTransaction } from './transactions.js';
export { createApplication } from './use-cases.js';
export type { OpenLearnApplication } from './use-cases.js';
export { createPersonalizationApplication } from './personalization.js';
export type {
  ChangePersonalizationConsentInput,
  CorrectLearnerFeedbackInput,
  DecidePersonalizationProposalInput,
  DeleteLearnerFeedbackInput,
  EvaluatePersonalizationInput,
  GetPersonalizationInput,
  ListPersonalizationProposalsInput,
  PersonalizationApplication,
  PersonalizationApplicationDependencies,
  PersonalizationMutationInput,
  PurgePersonalizationInput,
  RecordLearnerFeedbackInput,
} from './personalization.js';
export { createMemoryApplicationState } from './testing/memory-state.js';
export type { MemoryApplicationState } from './testing/memory-state.js';
