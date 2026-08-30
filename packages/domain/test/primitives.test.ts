import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOMAIN_ERROR_CATEGORIES,
  DOMAIN_LIMITS,
  type AcceptedRevisionRef,
  type CanonicalPlanContent,
  type Context,
  type ContextEntry,
  type DomainErrorCategory,
  type DomainErrorDetail,
  type DomainFailure,
  type DomainResult,
  type Goal,
  type IdentifierKind,
  type InternalOwnerId,
  type LearnerProgressRecord,
  type Milestone,
  type PlanAggregate,
  type PlanId,
  type PlanItem,
  type Resource,
  type RevisionId,
  type Topic,
  brandIdentifier,
} from '../src/index.js';

const TEST_TIMESTAMP = '2030-01-02T03:04:05Z';

const asRevisionId = (value: string): RevisionId => value as RevisionId;

const asShortText = (value: string) => value as Goal['title'];
const asLongText = (value: string) => value as NonNullable<Goal['description']>;
const asTimestamp = (value: string) =>
  value as LearnerProgressRecord['lastConfirmedAt'];
const asUrl = (value: string) => value as NonNullable<Resource['href']>;
const asOpaqueReference = (value: string) =>
  value as NonNullable<Resource['opaqueReference']>;

const assertType = <T>(_value: T): void => {};
const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }

  return result.value;
};

test('brands valid opaque identifiers without changing case', () => {
  const planIdResult = brandIdentifier('plan', 'Plan.Mixed_Case-01~ok');
  const itemIdResult = brandIdentifier('plan_item', 'fixture-item-reading');
  const ownerIdResult = brandIdentifier('internal_owner', 'OwnerABC.123');

  assert.equal(planIdResult.ok, true);
  assert.equal(itemIdResult.ok, true);
  assert.equal(ownerIdResult.ok, true);

  if (!planIdResult.ok || !itemIdResult.ok || !ownerIdResult.ok) {
    throw new Error('expected identifiers to brand successfully');
  }

  assert.equal(planIdResult.value, 'Plan.Mixed_Case-01~ok');
  assert.equal(itemIdResult.value, 'fixture-item-reading');
  assert.equal(ownerIdResult.value, 'OwnerABC.123');
});

test('rejects empty, whitespace-padded, control-containing, and overlong identifiers', () => {
  const overlongIdentifier = `a${'b'.repeat(DOMAIN_LIMITS.identifier.maxLength)}`;
  const invalidCases: ReadonlyArray<{
    candidate: string;
    code: DomainErrorDetail['code'];
    limit?: number;
  }> = [
    { candidate: '', code: 'empty' },
    { candidate: ' padded', code: 'invalid_syntax' },
    { candidate: 'padded ', code: 'invalid_syntax' },
    { candidate: 'bad\u0000id', code: 'control_character' },
    {
      candidate: overlongIdentifier,
      code: 'too_long',
      limit: DOMAIN_LIMITS.identifier.maxLength,
    },
  ];

  for (const invalidCase of invalidCases) {
    const result = brandIdentifier('goal', invalidCase.candidate);

    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected invalid identifier to be rejected');
    }

    assert.equal(result.category, 'invalid_identifier');
    assert.deepEqual(result.details, [
      {
        code: invalidCase.code,
        identifierKind: 'goal',
        ...(invalidCase.limit === undefined ? {} : { limit: invalidCase.limit }),
      },
    ]);
  }
});

test('accepts readable slug-like identifiers as opaque exact case-sensitive values', () => {
  const readableId = 'fixture-item-reading';
  const exactCaseId = 'Fixture-Item-Reading';

  const readableResult = brandIdentifier('plan_item', readableId);
  const exactCaseResult = brandIdentifier('plan_item', exactCaseId);

  assert.equal(readableResult.ok, true);
  assert.equal(exactCaseResult.ok, true);

  if (!readableResult.ok || !exactCaseResult.ok) {
    throw new Error('expected readable identifiers to be accepted');
  }

  assert.equal(readableResult.value, readableId);
  assert.equal(exactCaseResult.value, exactCaseId);
  assert.notEqual(readableResult.value, exactCaseResult.value);
});

test('defines required fields and preserves declared readonly collection order', () => {
  const planId = brandIdentifier('plan', 'fixture-plan-basics');
  const ownerId = brandIdentifier('internal_owner', 'owner-internal-fixture');
  const goalId = brandIdentifier('goal', 'fixture-goal-web');
  const contextEntryId = brandIdentifier(
    'context_entry',
    'fixture-context-background',
  );
  const milestoneIdA = brandIdentifier(
    'milestone',
    'fixture-milestone-foundations',
  );
  const milestoneIdB = brandIdentifier('milestone', 'fixture-milestone-practice');
  const topicIdA = brandIdentifier('topic', 'fixture-topic-documents');
  const topicIdB = brandIdentifier('topic', 'fixture-topic-requests');
  const itemIdA = brandIdentifier('plan_item', 'fixture-item-reading');
  const itemIdB = brandIdentifier('plan_item', 'fixture-item-request-flow');
  const resourceId = brandIdentifier('resource', 'fixture-resource-mdn');

  const goal: Goal = {
    goalId: expectSuccess(goalId),
    title: asShortText('Learn the foundations of the web'),
    description: asLongText(
      'Build a clear mental model of browsers, documents, styles, and requests.',
    ),
  };

  const contextEntry: ContextEntry = {
    entryId: expectSuccess(contextEntryId),
    label: asShortText('Starting point'),
    value: asLongText('No prior programming experience is assumed.'),
  };

  const context: Context = {
    summary: asLongText('The learner is new to web development.'),
    entries: [contextEntry],
  };

  const resource: Resource = {
    resourceId: expectSuccess(resourceId),
    label: asShortText('Document structure reference'),
    href: asUrl('https://example.test/resources/document-structure'),
    opaqueReference: asOpaqueReference('provider-neutral-reference'),
  };

  const itemA: PlanItem = {
    itemId: expectSuccess(itemIdA),
    title: asShortText('Read a document structure overview'),
    description: asLongText(
      'Identify the main structural elements in a simple document.',
    ),
    resources: [resource],
  };

  const itemB: PlanItem = {
    itemId: expectSuccess(itemIdB),
    title: asShortText('Trace a request flow'),
    description: asLongText(
      'Describe the visible steps in a simple page request.',
    ),
    resources: [],
  };

  const topicA: Topic = {
    topicId: expectSuccess(topicIdA),
    title: asShortText('Documents and structure'),
    description: asLongText('Recognize the role of HTML in a web document.'),
    items: [itemA],
  };

  const topicB: Topic = {
    topicId: expectSuccess(topicIdB),
    title: asShortText('Requests and responses'),
    description: asLongText('Connect a browser action to a request and response.'),
    items: [itemB],
  };

  const milestoneA: Milestone = {
    milestoneId: expectSuccess(milestoneIdA),
    title: asShortText('Understand the browser'),
    description: asLongText(
      'Learn how a browser turns a document into an interactive page.',
    ),
    topics: [topicA],
  };

  const milestoneB: Milestone = {
    milestoneId: expectSuccess(milestoneIdB),
    title: asShortText('Practice the model'),
    description: asLongText('Use the model to explain a basic request.'),
    topics: [topicB],
  };

  const content: CanonicalPlanContent = {
    title: asShortText('Web foundations'),
    goal,
    context,
    milestones: [milestoneA, milestoneB],
  };

  const revision: AcceptedRevisionRef = {
    revisionId: asRevisionId('fixture-revision-001'),
    revisionNumber: 1,
    acceptedAt: asTimestamp(TEST_TIMESTAMP),
  };

  const progress: LearnerProgressRecord = {
    ownerId: expectSuccess(ownerId),
    planId: expectSuccess(planId),
    itemId: expectSuccess(itemIdA),
    state: 'completed_by_learner',
    progressVersion: 1,
    lastNonCompleteState: 'not_started',
    lastConfirmedAt: asTimestamp(TEST_TIMESTAMP),
  };

  const aggregate: PlanAggregate = {
    ownerId: expectSuccess(ownerId),
    planId: expectSuccess(planId),
    lifecycle: 'active',
    currentRevision: revision,
    progress: [progress],
  };

  assertType<readonly ContextEntry[] | undefined>(context.entries);
  assertType<readonly Resource[] | undefined>(itemA.resources);
  assertType<readonly PlanItem[]>(topicA.items);
  assertType<readonly Topic[]>(milestoneA.topics);
  assertType<readonly Milestone[]>(content.milestones);
  assertType<DomainResult<PlanAggregate>>({
    ok: true,
    value: aggregate,
  });

  assert.deepEqual(
    content.milestones.map((milestone) => milestone.milestoneId),
    [expectSuccess(milestoneIdA), expectSuccess(milestoneIdB)],
  );
  assert.deepEqual(
    milestoneA.topics.map((topic) => topic.topicId),
    [expectSuccess(topicIdA)],
  );
  assert.deepEqual(
    topicA.items.map((item) => item.itemId),
    [expectSuccess(itemIdA)],
  );
  assert.deepEqual(
    itemA.resources?.map((entry) => entry.resourceId),
    [expectSuccess(resourceId)],
  );
});

test('defines every error category with safe machine-readable detail fields', () => {
  const categoriesByExpectedCode: ReadonlyArray<
    readonly [DomainErrorCategory, DomainErrorDetail['code']]
  > = [
    ['malformed_input', 'wrong_type'],
    ['missing_required', 'missing_field'],
    ['invalid_identifier', 'invalid_syntax'],
    ['duplicate_identifier', 'duplicate_value'],
    ['invalid_relationship', 'relationship_mismatch'],
    ['unsafe_content', 'unsafe_value'],
    ['too_large', 'limit_exceeded'],
    ['unknown_field', 'unknown_field'],
    ['stale_revision', 'stale_revision'],
    ['stale_progress', 'stale_progress'],
    ['invalid_transition', 'transition_not_allowed'],
    ['deletion_conflict', 'deletion_conflict'],
    ['owner_unavailable', 'owner_unavailable'],
    ['plan_deleted', 'plan_deleted'],
    ['mutation_replay_conflict', 'mutation_replay_conflict'],
  ];

  assert.deepEqual(DOMAIN_ERROR_CATEGORIES, categoriesByExpectedCode.map(([category]) => category));

  const failures: ReadonlyArray<DomainFailure> = categoriesByExpectedCode.map(
    ([category, code]) => ({
      ok: false,
      category,
      details: [
        {
          path: 'milestones[0].topics[0].items[0].title',
          code,
          identifierKind: 'plan_item',
          limit: DOMAIN_LIMITS.identifier.maxLength,
          expectedVersion: 2,
          actualVersion: 1,
        },
      ],
    }),
  );

  for (const failure of failures) {
    assert.equal(failure.ok, false);
    assert.equal(typeof failure.category, 'string');
    assert.equal(Array.isArray(failure.details), true);
    assert.equal(failure.details.length, 1);
    assert.equal(typeof failure.details[0]?.code, 'string');
    assert.equal(typeof failure.details[0]?.path, 'string');
    assert.equal(failure.details[0]?.identifierKind, 'plan_item');
    assert.equal(typeof failure.details[0]?.limit, 'number');
    assert.equal(typeof failure.details[0]?.expectedVersion, 'number');
    assert.equal(typeof failure.details[0]?.actualVersion, 'number');
  }
});

test('declares identifier allocation kinds for deterministic fixture allocators', () => {
  const expectedKinds: IdentifierKind[] = [
    'plan',
    'revision',
    'goal',
    'context_entry',
    'milestone',
    'topic',
    'plan_item',
    'resource',
    'internal_owner',
  ];

  const seenKinds = new Set<IdentifierKind>(expectedKinds);

  assert.equal(seenKinds.size, expectedKinds.length);
});

void ((_: PlanId, __: InternalOwnerId) => undefined);
