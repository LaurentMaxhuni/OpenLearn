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
}

export interface DeletedPlanAggregate extends PlanAggregateBase {
  readonly lifecycle: 'deleted';
  readonly currentRevision?: undefined;
}

export type PlanAggregate = ActivePlanAggregate | DeletedPlanAggregate;

export interface PlanDeletionTombstone {
  readonly planId: PlanId;
  readonly ownerId: InternalOwnerId;
  readonly deletedAt: Timestamp;
  readonly terminalRevision: AcceptedRevisionRef;
}
