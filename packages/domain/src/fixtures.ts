import { fail, type DomainFailure, type DomainResult } from './errors.js';
import { applyProgressAction, effectiveProgress } from './progress.js';
import { deletePlan } from './deletion.js';
import { createPlan, replacePlan } from './plan.js';
import { brandIdentifier, type IdentifierKind, type IdentityAllocator } from './identity.js';
import { retentionDeadlines, type RetentionDeadlines } from './retention.js';
import type {
  ActivePlanAggregate,
  DeletedPlanAggregate,
  InternalOwnerId,
  LearnerProgressRecord,
  PlanItemId,
  PlanId,
  Resource,
  Timestamp,
} from './types.js';

const COMPLETE_TIMESTAMP = '2030-01-02T03:04:05Z' as Timestamp;
const PROGRESS_TIMESTAMP = '2030-01-03T03:04:05Z' as Timestamp;
const REPLACEMENT_TIMESTAMP = '2030-01-04T03:04:05Z' as Timestamp;
const DELETION_TIMESTAMP = '2030-01-05T03:04:05Z' as Timestamp;

class FixtureAllocator implements IdentityAllocator {
  private readonly counters = new Map<IdentifierKind, number>();

  allocate(kind: IdentifierKind): string {
    const next = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, next);
    return `fixture-${kind}-${next.toString().padStart(3, '0')}`;
  }
}

const expectSuccess = <T>(result: DomainResult<T>): T => {
  if (!result.ok) {
    throw new Error(`fixture construction failed: ${result.category}`);
  }
  return result.value;
};

const owner = (value: string): InternalOwnerId => {
  const result = brandIdentifier('internal_owner', value);
  if (!result.ok) {
    throw new Error('invalid fixture owner');
  }
  return result.value;
};

const item = (value: string): PlanItemId => {
  const result = brandIdentifier('plan_item', value);
  if (!result.ok) {
    throw new Error('invalid fixture item');
  }
  return result.value;
};

const acceptedOwner = owner('owner-internal-fixture');

const completeCandidate = (
  itemIds: readonly string[] = [
    'fixture-item-reading',
    'fixture-item-request-flow',
  ],
) => ({
  title: 'Web foundations',
  goal: {
    goalId: 'fixture-goal-web',
    title: 'Learn the foundations of the web',
    description:
      'Build a clear mental model of browsers, documents, styles, and requests.',
  },
  context: {
    summary: 'The learner is new to web development.',
    entries: [
      {
        entryId: 'fixture-context-background',
        label: 'Starting point',
        value: 'No prior programming experience is assumed.',
      },
    ],
  },
  milestones: [
    {
      milestoneId: 'fixture-milestone-foundations',
      title: 'Understand the browser',
      description: 'Learn how a browser turns a document into an interactive page.',
      topics: [
        {
          topicId: 'fixture-topic-documents',
          title: 'Documents and structure',
          description: 'Recognize the role of HTML in a web document.',
          items: itemIds.map((itemId) => ({
            itemId,
            title:
              itemId === 'fixture-item-reading'
                ? 'Read a document structure overview'
                : itemId === 'fixture-item-request-flow'
                  ? 'Trace a request flow'
                  : 'Study the new item',
            description:
              itemId === 'fixture-item-reading'
                ? 'Identify the main structural elements in a simple document.'
                : 'Describe the visible steps in a simple page request.',
            resources:
              itemId === 'fixture-item-reading'
                ? [
                    {
                      resourceId: 'fixture-resource-mdn',
                      label: 'Document structure reference',
                      href: 'https://example.test/resources/document-structure',
                    },
                  ]
                : [],
          })),
        },
      ],
    },
  ],
});

const partialCandidate = () => ({
  goal: {
    goalId: 'fixture-goal-partial',
    title: 'Learn from a partial plan',
  },
  milestones: [
    {
      milestoneId: 'fixture-milestone-partial',
      title: 'Start with the outline',
      topics: [
        {
          topicId: 'fixture-topic-partial',
          title: 'First topic',
          items: [
            {
              itemId: 'fixture-item-partial',
              title: 'Take the first step',
            },
          ],
        },
      ],
    },
  ],
});

const candidateWithReadingResource = (resource: Record<string, string>) => {
  const base = completeCandidate(['fixture-item-reading']);
  const milestone = base.milestones[0];
  if (milestone === undefined) {
    throw new Error('expected fixture milestone');
  }
  const topic = milestone.topics[0];
  if (topic === undefined) {
    throw new Error('expected fixture topic');
  }
  const readingItem = topic.items[0];
  if (readingItem === undefined) {
    throw new Error('expected fixture item');
  }

  return {
    ...base,
    milestones: [
      {
        ...milestone,
        topics: [
          {
            ...topic,
            items: [{ ...readingItem, resources: [resource] }],
          },
        ],
      },
    ],
  };
};

const createAccepted = (
  candidate: unknown,
  allocator = new FixtureAllocator(),
): ActivePlanAggregate =>
  expectSuccess(
    createPlan({
      ownerId: acceptedOwner,
      candidate,
      allocator,
      acceptedAt: COMPLETE_TIMESTAMP,
    }),
  );

const completeItem = (
  plan: ActivePlanAggregate,
  itemIdValue: PlanItemId,
): ActivePlanAggregate =>
  expectSuccess(
    applyProgressAction({
      plan,
      ownerId: plan.ownerId,
      expectedRevisionId: plan.currentRevision.revisionId,
      itemId: itemIdValue,
      expectedProgressVersion: effectiveProgress(plan, itemIdValue).progressVersion,
      action: 'complete_item',
      confirmedAt: PROGRESS_TIMESTAMP,
    }),
  );

const startItem = (
  plan: ActivePlanAggregate,
  itemIdValue: PlanItemId,
): ActivePlanAggregate =>
  expectSuccess(
    applyProgressAction({
      plan,
      ownerId: plan.ownerId,
      expectedRevisionId: plan.currentRevision.revisionId,
      itemId: itemIdValue,
      expectedProgressVersion: effectiveProgress(plan, itemIdValue).progressVersion,
      action: 'start_item',
      confirmedAt: PROGRESS_TIMESTAMP,
    }),
  );

export interface RevisionPreservesProgressFixture {
  readonly before: ActivePlanAggregate;
  readonly after: ActivePlanAggregate;
  readonly stableItemId: PlanItemId;
  readonly omittedItemId: PlanItemId;
  readonly newItemId: PlanItemId;
}

export interface ProgressCompletionPendingFixture {
  readonly plan: ActivePlanAggregate;
  readonly itemId: PlanItemId;
  readonly confirmedProgress: LearnerProgressRecord;
  readonly operation: {
    readonly status: 'pending';
    readonly action: 'complete_item';
    readonly itemId: PlanItemId;
  };
}

export interface ProgressConflictFixture {
  readonly plan: ActivePlanAggregate;
  readonly outcome: DomainFailure;
}

export interface DeletionConflictFixture {
  readonly plan: ActivePlanAggregate;
  readonly outcome: DomainFailure;
}

export interface StaleRevisionConflictFixture {
  readonly plan: ActivePlanAggregate;
  readonly outcome: DomainFailure;
}

export interface CandidateRejectionFixture {
  readonly plan: ActivePlanAggregate;
  readonly candidate: unknown;
  readonly outcome: DomainFailure;
}

export interface OpaqueResourceFixture {
  readonly plan: ActivePlanAggregate;
  readonly resource: Resource;
}

export interface ProgressStateFixture {
  readonly plan: ActivePlanAggregate;
  readonly itemId: PlanItemId;
  readonly progress: LearnerProgressRecord;
}

export interface ProgressCompletedWithUndoFixture extends ProgressStateFixture {
  readonly undoAction: 'undo_completion';
}

export interface ProgressUndoPendingFixture {
  readonly plan: ActivePlanAggregate;
  readonly itemId: PlanItemId;
  readonly confirmedProgress: LearnerProgressRecord;
  readonly operation: {
    readonly status: 'pending';
    readonly action: 'undo_completion';
    readonly itemId: PlanItemId;
  };
}

export interface DeletionOperationFixture {
  readonly plan: ActivePlanAggregate;
  readonly operation: {
    readonly status: 'confirmed' | 'recovering';
    readonly action: 'delete_plan';
    readonly planId: PlanId;
  };
}

export interface AccountDeletionFixture {
  readonly plan: ActivePlanAggregate;
  readonly operation: {
    readonly status: 'access_revoked_pending_purge';
    readonly planId: PlanId;
  };
  readonly retention: RetentionDeadlines;
}

export const acceptedCompleteFixture = (): ActivePlanAggregate => {
  const plan = createAccepted(completeCandidate());
  const withCompletedFirst = completeItem(plan, item('fixture-item-reading'));
  return expectSuccess(
    applyProgressAction({
      plan: withCompletedFirst,
      ownerId: withCompletedFirst.ownerId,
      expectedRevisionId: withCompletedFirst.currentRevision.revisionId,
      itemId: item('fixture-item-request-flow'),
      expectedProgressVersion: 0,
      action: 'start_item',
      confirmedAt: PROGRESS_TIMESTAMP,
    }),
  );
};

export const acceptedPartialFixture = (): ActivePlanAggregate =>
  createAccepted(partialCandidate());

export const acceptedNoProgressFixture = (): ActivePlanAggregate =>
  createAccepted(completeCandidate());

export const malformedCandidateFixture = (): CandidateRejectionFixture => {
  const plan = acceptedNoProgressFixture();
  const candidate = { goal: null };
  const result = replacePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: plan.currentRevision.revisionId,
    candidate,
    allocator: new FixtureAllocator(),
    acceptedAt: REPLACEMENT_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected malformed candidate fixture failure');
  }
  return { plan, candidate, outcome: result };
};

export const duplicateIdentifiersFixture = (): CandidateRejectionFixture => {
  const plan = acceptedNoProgressFixture();
  const candidate = completeCandidate([
    'fixture-item-reading',
    'fixture-item-reading',
  ]);
  const result = replacePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: plan.currentRevision.revisionId,
    candidate,
    allocator: new FixtureAllocator(),
    acceptedAt: REPLACEMENT_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected duplicate identifier fixture failure');
  }
  return { plan, candidate, outcome: result };
};

export const unsafeResourceFixture = (): CandidateRejectionFixture => {
  const plan = acceptedNoProgressFixture();
  const candidate = candidateWithReadingResource({
    resourceId: 'fixture-resource-unsafe',
    label: 'Unsafe resource',
    href: 'javascript:alert(1)',
  });
  const result = replacePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: plan.currentRevision.revisionId,
    candidate,
    allocator: new FixtureAllocator(),
    acceptedAt: REPLACEMENT_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected unsafe resource fixture failure');
  }
  return { plan, candidate, outcome: result };
};

export const opaqueResourceFixture = (): OpaqueResourceFixture => {
  const plan = createAccepted(
    candidateWithReadingResource({
      resourceId: 'fixture-resource-opaque',
      label: 'Opaque resource',
      opaqueReference: 'fixture-opaque-reference',
    }),
  );
  const resource = plan.content.milestones[0]?.topics[0]?.items[0]?.resources?.[0];
  if (resource === undefined) {
    throw new Error('expected opaque resource fixture');
  }
  return { plan, resource };
};

export const progressNotStartedFixture = (): ProgressStateFixture => {
  const plan = acceptedNoProgressFixture();
  const itemIdValue = item('fixture-item-reading');
  return {
    plan,
    itemId: itemIdValue,
    progress: effectiveProgress(plan, itemIdValue),
  };
};

export const progressInProgressFixture = (): ProgressStateFixture => {
  const plan = startItem(
    acceptedNoProgressFixture(),
    item('fixture-item-reading'),
  );
  const itemIdValue = item('fixture-item-reading');
  return {
    plan,
    itemId: itemIdValue,
    progress: effectiveProgress(plan, itemIdValue),
  };
};

export const progressCompletedWithUndoFixture = (): ProgressCompletedWithUndoFixture => {
  const plan = completeItem(
    acceptedNoProgressFixture(),
    item('fixture-item-reading'),
  );
  const itemIdValue = item('fixture-item-reading');
  return {
    plan,
    itemId: itemIdValue,
    progress: effectiveProgress(plan, itemIdValue),
    undoAction: 'undo_completion',
  };
};

export const progressUndoPendingFixture = (): ProgressUndoPendingFixture => {
  const plan = completeItem(
    acceptedNoProgressFixture(),
    item('fixture-item-reading'),
  );
  const itemIdValue = item('fixture-item-reading');
  return {
    plan,
    itemId: itemIdValue,
    confirmedProgress: effectiveProgress(plan, itemIdValue),
    operation: {
      status: 'pending',
      action: 'undo_completion',
      itemId: itemIdValue,
    },
  };
};

export const deletionConfirmationFixture = (): DeletionOperationFixture => {
  const plan = acceptedNoProgressFixture();
  return {
    plan,
    operation: {
      status: 'confirmed',
      action: 'delete_plan',
      planId: plan.planId,
    },
  };
};

export const deletionRecoveringFixture = (): DeletionOperationFixture => {
  const plan = acceptedNoProgressFixture();
  return {
    plan,
    operation: {
      status: 'recovering',
      action: 'delete_plan',
      planId: plan.planId,
    },
  };
};

export const accountDeletionFixture = (): AccountDeletionFixture => {
  const plan = acceptedNoProgressFixture();
  return {
    plan,
    operation: {
      status: 'access_revoked_pending_purge',
      planId: plan.planId,
    },
    retention: retentionDeadlines(
      COMPLETE_TIMESTAMP,
      '2030-01-10T03:04:05Z' as Timestamp,
    ),
  };
};

export const revisionPreservesProgressFixture = (): RevisionPreservesProgressFixture => {
  const allocator = new FixtureAllocator();
  const base = createAccepted(completeCandidate(), allocator);
  const completedFirst = completeItem(base, item('fixture-item-reading'));
  const before = startItem(
    completedFirst,
    item('fixture-item-request-flow'),
  );
  const after = expectSuccess(
    replacePlan({
      plan: before,
      ownerId: before.ownerId,
      expectedRevisionId: before.currentRevision.revisionId,
      candidate: completeCandidate([
        'fixture-item-reading',
        'fixture-item-new',
      ]),
      allocator,
      acceptedAt: REPLACEMENT_TIMESTAMP,
    }),
  );

  return {
    before,
    after,
    stableItemId: item('fixture-item-reading'),
    omittedItemId: item('fixture-item-request-flow'),
    newItemId: item('fixture-item-new'),
  };
};

export const staleRevisionConflictFixture = (): StaleRevisionConflictFixture => {
  const plan = acceptedNoProgressFixture();
  const result = replacePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: 'fixture-revision-stale' as import('./types.js').RevisionId,
    candidate: completeCandidate(),
    allocator: new FixtureAllocator(),
    acceptedAt: REPLACEMENT_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected stale revision fixture failure');
  }
  return { plan, outcome: result };
};

export const progressCompletionPendingFixture = (): ProgressCompletionPendingFixture => {
  const plan = acceptedNoProgressFixture();
  const itemIdValue = item('fixture-item-reading');
  return {
    plan,
    itemId: itemIdValue,
    confirmedProgress: effectiveProgress(plan, itemIdValue),
    operation: {
      status: 'pending',
      action: 'complete_item',
      itemId: itemIdValue,
    },
  };
};

export const progressConflictFixture = (): ProgressConflictFixture => {
  const plan = completeItem(
    acceptedNoProgressFixture(),
    item('fixture-item-reading'),
  );
  const result = applyProgressAction({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: plan.currentRevision.revisionId,
    itemId: item('fixture-item-reading'),
    expectedProgressVersion: 0,
    action: 'complete_item',
    confirmedAt: PROGRESS_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected progress conflict fixture failure');
  }
  return { plan, outcome: result };
};

export const deletionConflictFixture = (): DeletionConflictFixture => {
  const plan = acceptedNoProgressFixture();
  const result = deletePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: 'fixture-revision-stale' as import('./types.js').RevisionId,
    deletedAt: DELETION_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected deletion conflict fixture failure');
  }
  return { plan, outcome: result };
};

export const deletedPlanFixture = (): DeletedPlanAggregate => {
  const plan = acceptedNoProgressFixture();
  const deleted = expectSuccess(
    deletePlan({
      plan,
      ownerId: plan.ownerId,
      expectedRevisionId: plan.currentRevision.revisionId,
      deletedAt: DELETION_TIMESTAMP,
    }),
  );
  if (deleted.lifecycle !== 'deleted') {
    throw new Error('expected deleted fixture aggregate');
  }
  return deleted;
};

export const unauthorizedPlanFixture = (): DomainFailure => {
  const plan = acceptedNoProgressFixture();
  const result = replacePlan({
    plan,
    ownerId: owner('owner-unauthorized-fixture'),
    expectedRevisionId: plan.currentRevision.revisionId,
    candidate: completeCandidate(),
    allocator: new FixtureAllocator(),
    acceptedAt: REPLACEMENT_TIMESTAMP,
  });
  if (result.ok) {
    throw new Error('expected unauthorized fixture failure');
  }
  return result;
};
