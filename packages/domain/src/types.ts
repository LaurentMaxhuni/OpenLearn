declare const opaqueBrand: unique symbol;

type OpaqueString<Brand extends string> = string & {
  readonly [opaqueBrand]: Brand;
};

export type ShortText = OpaqueString<'ShortText'>;
export type LongText = OpaqueString<'LongText'>;
export type BoundedOpaqueText = OpaqueString<'BoundedOpaqueText'>;
export type SafeHttpsUrl = OpaqueString<'SafeHttpsUrl'>;
export type Timestamp = OpaqueString<'Timestamp'>;

export type PlanId = OpaqueString<'PlanId'>;
export type RevisionId = OpaqueString<'RevisionId'>;
export type GoalId = OpaqueString<'GoalId'>;
export type ContextEntryId = OpaqueString<'ContextEntryId'>;
export type MilestoneId = OpaqueString<'MilestoneId'>;
export type TopicId = OpaqueString<'TopicId'>;
export type PlanItemId = OpaqueString<'PlanItemId'>;
export type ResourceId = OpaqueString<'ResourceId'>;
export type InternalOwnerId = OpaqueString<'InternalOwnerId'>;
export type FeedbackId = OpaqueString<'FeedbackId'>;
export type ProposalId = OpaqueString<'ProposalId'>;

export type PositiveInteger = number;
export type NonNegativeInteger = number;

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export interface Goal {
  readonly goalId: GoalId;
  readonly title: ShortText;
  readonly description?: LongText;
}

export interface ContextEntry {
  readonly entryId: ContextEntryId;
  readonly label: ShortText;
  readonly value: LongText;
}

export interface Context {
  readonly summary?: LongText;
  readonly entries?: readonly ContextEntry[];
}

export interface Resource {
  readonly resourceId: ResourceId;
  readonly label: ShortText;
  readonly href?: SafeHttpsUrl;
  readonly opaqueReference?: BoundedOpaqueText;
}

export interface PlanItem {
  readonly itemId: PlanItemId;
  readonly title: ShortText;
  readonly description?: LongText;
  readonly resources?: readonly Resource[];
}

export interface Topic {
  readonly topicId: TopicId;
  readonly title: ShortText;
  readonly description?: LongText;
  readonly items: NonEmptyReadonlyArray<PlanItem>;
}

export interface Milestone {
  readonly milestoneId: MilestoneId;
  readonly title: ShortText;
  readonly description?: LongText;
  readonly topics: NonEmptyReadonlyArray<Topic>;
}

export interface CanonicalPlanContent {
  readonly title?: ShortText;
  readonly goal: Goal;
  readonly context?: Context;
  readonly milestones: NonEmptyReadonlyArray<Milestone>;
}

export interface NormalizedPlanContent extends CanonicalPlanContent {
  readonly missingOptionalPaths: readonly string[];
}

export type PlanLifecycle = 'active' | 'deleted';

export type ProgressState =
  | 'not_started'
  | 'in_progress'
  | 'completed_by_learner';

export type NonCompleteProgressState = Extract<
  ProgressState,
  'not_started' | 'in_progress'
>;

interface LearnerProgressRecordBase {
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly itemId: PlanItemId;
  readonly progressVersion: NonNegativeInteger;
  readonly lastConfirmedAt: Timestamp;
}

export interface NotStartedProgressRecord extends LearnerProgressRecordBase {
  readonly state: 'not_started';
  readonly lastNonCompleteState?: never;
}

export interface InProgressProgressRecord extends LearnerProgressRecordBase {
  readonly state: 'in_progress';
  readonly lastNonCompleteState?: never;
}

export interface CompletedByLearnerProgressRecord
  extends LearnerProgressRecordBase {
  readonly state: 'completed_by_learner';
  readonly lastNonCompleteState?: NonCompleteProgressState;
}

export type LearnerProgressRecord =
  | NotStartedProgressRecord
  | InProgressProgressRecord
  | CompletedByLearnerProgressRecord;

export interface AcceptedRevisionRef {
  readonly revisionId: RevisionId;
  readonly revisionNumber: PositiveInteger;
  readonly acceptedAt: Timestamp;
}

interface PlanAggregateBase {
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly progress: readonly LearnerProgressRecord[];
}

export interface ActivePlanAggregate extends PlanAggregateBase {
  readonly lifecycle: 'active';
  readonly currentRevision: AcceptedRevisionRef;
  readonly content: NormalizedPlanContent;
}

export interface DeletedPlanAggregate extends PlanAggregateBase {
  readonly lifecycle: 'deleted';
  readonly currentRevision?: undefined;
  readonly tombstone: PlanDeletionTombstone;
}

export type PlanAggregate = ActivePlanAggregate | DeletedPlanAggregate;

export interface PlanDeletionTombstone {
  readonly planId: PlanId;
  readonly ownerId: InternalOwnerId;
  readonly deletedAt: Timestamp;
  readonly terminalRevision: AcceptedRevisionRef;
}

export type PersonalizationConsentState =
  | 'disabled'
  | 'enabled'
  | 'paused'
  | 'revoked';

export interface PersonalizationConsent {
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly state: PersonalizationConsentState;
  readonly consentVersion: NonNegativeInteger;
  readonly enabledAt?: Timestamp;
  readonly updatedAt: Timestamp;
}

export type PersonalizationFeedbackArea =
  | 'difficulty'
  | 'pace'
  | 'relevance';

export type DifficultyFeedbackValue =
  | 'too_easy'
  | 'about_right'
  | 'too_hard';

export type PaceFeedbackValue =
  | 'too_slow'
  | 'about_right'
  | 'too_fast';

export type RelevanceFeedbackValue = 'relevant' | 'not_relevant';

export type PersonalizationFeedbackValue =
  | DifficultyFeedbackValue
  | PaceFeedbackValue
  | RelevanceFeedbackValue;

export type PersonalizationFeedbackStatus =
  | 'active'
  | 'corrected'
  | 'deleted';

export interface LearnerFeedback {
  readonly feedbackId: FeedbackId;
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly itemId?: PlanItemId;
  readonly area: PersonalizationFeedbackArea;
  readonly value: PersonalizationFeedbackValue;
  readonly recordedAt: Timestamp;
  readonly consentVersion: NonNegativeInteger;
  readonly status: PersonalizationFeedbackStatus;
  readonly supersedesFeedbackId?: FeedbackId;
}

export type PersonalizationProposalKind =
  | 'recommend_existing_next_step'
  | 'suggest_pacing_preference'
  | 'request_plan_revision';

export type PersonalizationProposalBasis =
  | 'confirmed_progress'
  | 'difficulty_feedback'
  | 'pace_feedback'
  | 'relevance_feedback';

export type PacingPreference = 'slower' | 'steady' | 'faster';

export type PlanRevisionReason = 'difficulty' | 'pace' | 'relevance';

export type PersonalizationProposalParameters =
  | {
      readonly kind: 'recommend_existing_next_step';
      readonly itemId: PlanItemId;
    }
  | {
      readonly kind: 'suggest_pacing_preference';
      readonly preference: PacingPreference;
    }
  | {
      readonly kind: 'request_plan_revision';
      readonly reason: PlanRevisionReason;
      readonly itemId?: PlanItemId;
    };

export type PersonalizationProposalStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export interface PersonalizationProposal {
  readonly proposalId: ProposalId;
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly sourceRevisionId: RevisionId;
  readonly consentVersion: NonNegativeInteger;
  readonly parameters: PersonalizationProposalParameters;
  readonly explanation: LongText;
  readonly basis: readonly [
    PersonalizationProposalBasis,
    ...PersonalizationProposalBasis[],
  ];
  readonly createdAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly status: PersonalizationProposalStatus;
  readonly proposalVersion: PositiveInteger;
  readonly decidedAt?: Timestamp;
}

export type PersonalizationHandoffIntent =
  | {
      readonly kind: 'pacing';
      readonly preference: PacingPreference;
    }
  | {
      readonly kind: 'plan_revision';
      readonly reason: PlanRevisionReason;
      readonly itemId?: PlanItemId;
    };

export interface PersonalizationRevisionHandoff {
  readonly requestId: ProposalId;
  readonly proposalId: ProposalId;
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly sourceRevisionId: RevisionId;
  readonly intent: PersonalizationHandoffIntent;
  readonly createdAt: Timestamp;
}

export interface PersonalizationState {
  readonly ownerId: InternalOwnerId;
  readonly planId: PlanId;
  readonly stateVersion: NonNegativeInteger;
  readonly consent: PersonalizationConsent;
  readonly feedback: readonly LearnerFeedback[];
  readonly proposals: readonly PersonalizationProposal[];
}
