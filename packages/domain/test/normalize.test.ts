import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOMAIN_LIMITS,
  normalizePlanContent,
  validatePlanCandidate,
  type DomainErrorCategory,
  type DomainResult,
  type IdentifierKind,
  type IdentityAllocator,
  type NormalizedPlanContent,
} from '../src/index.js';

class DeterministicAllocator implements IdentityAllocator {
  readonly calls: IdentifierKind[] = [];
  readonly counters = new Map<IdentifierKind, number>();

  allocate(kind: IdentifierKind): string {
    this.calls.push(kind);
    const nextCount = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, nextCount);
    return `allocated-${kind}-${nextCount.toString().padStart(3, '0')}`;
  }
}

const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }

  return result.value;
};

const expectFailure = <T>(
  result: DomainResult<T>,
  expectedCategory: DomainErrorCategory,
) => {
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error('expected failure');
  }

  assert.equal(result.category, expectedCategory);
  return result.details;
};

const createValidCandidate = () => ({
  title: '  Cafe\u0301 plan \r\n',
  goal: {
    title: '\tShip the first release\t',
    description: '  Learn the core workflow.\rSecond line.\tTabbed  ',
  },
  context: {
    summary: '  Existing experience:\r\nNone yet.\t  ',
    entries: [
      {
        label: '  Starting point  ',
        value: '  Comfortable with browsers.\rNeeds structure.\t  ',
      },
    ],
  },
  milestones: [
    {
      title: '  Foundations  ',
      description: '  Start with the basics.\r\nKeep spacing  inside.  ',
      topics: [
        {
          title: '  Topic one  ',
          description: '\tLine one.\rLine two.\t',
          items: [
            {
              title: '  First item  ',
              description: '  Read docs.\r\nTake notes.\t  ',
              resources: [
                {
                  label: '  Resource label  ',
                  href: 'https://example.com/guide',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

test('normalizes text values and preserves internal spacing, line breaks, and sibling order', () => {
  const allocator = new DeterministicAllocator();

  const result = normalizePlanContent(createValidCandidate(), allocator);
  const normalized = expectSuccess(result);

  assert.equal(normalized.title, 'Caf\u00e9 plan');
  assert.equal(normalized.goal.title, 'Ship the first release');
  assert.equal(
    normalized.goal.description,
    'Learn the core workflow.\nSecond line. Tabbed',
  );
  assert.equal(normalized.context?.summary, 'Existing experience:\nNone yet.');
  assert.equal(normalized.context?.entries?.[0]?.label, 'Starting point');
  assert.equal(
    normalized.context?.entries?.[0]?.value,
    'Comfortable with browsers.\nNeeds structure.',
  );
  assert.equal(
    normalized.milestones[0]?.description,
    'Start with the basics.\nKeep spacing  inside.',
  );
  assert.equal(normalized.milestones[0]?.topics[0]?.title, 'Topic one');
  assert.equal(
    normalized.milestones[0]?.topics[0]?.description,
    'Line one.\nLine two.',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.description,
    'Read docs.\nTake notes.',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.label,
    'Resource label',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.href,
    'https://example.com/guide',
  );
  assert.deepEqual(normalized.missingOptionalPaths, []);
  assert.deepEqual(allocator.calls, [
    'goal',
    'context_entry',
    'milestone',
    'topic',
    'plan_item',
    'resource',
  ]);
});

test('treats optional empty values as absent, records deterministic missingOptionalPaths, and preserves supplied opaque ids exactly', () => {
  const allocator = new DeterministicAllocator();

  const result = normalizePlanContent(
    {
      title: ' \t ',
      goal: {
        goalId: 'Goal-Custom_01',
        title: 'Goal title',
        description: ' \r\n ',
      },
      context: {
        summary: ' \t ',
        entries: [
          {
            entryId: 'entry-provided',
            label: 'Context label',
            value: 'Context value',
          },
          {
            label: 'Empty optional siblings',
            value: 'Still here',
          },
        ],
      },
      milestones: [
        {
          milestoneId: 'milestone-provided',
          title: 'Milestone A',
          description: '',
          topics: [
            {
              topicId: 'Topic.Custom',
              title: 'Topic A',
              description: '\t',
              items: [
                {
                  itemId: 'fixture-item-reading',
                  title: 'Item A',
                  description: '',
                  resources: [
                    {
                      resourceId: 'resource-provided',
                      label: 'Label only',
                      href: ' \t ',
                      opaqueReference: ' \t ',
                    },
                    {
                      label: 'Opaque only',
                      opaqueReference: 'opaque-ref-1',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    allocator,
  );

  const normalized = expectSuccess(result);

  assert.equal(normalized.title, undefined);
  assert.equal(normalized.goal.goalId, 'Goal-Custom_01');
  assert.equal(normalized.goal.description, undefined);
  assert.equal(normalized.context?.summary, undefined);
  assert.equal(normalized.context?.entries?.[0]?.entryId, 'entry-provided');
  assert.equal(normalized.context?.entries?.[1]?.entryId, 'allocated-context_entry-001');
  assert.equal(normalized.milestones[0]?.milestoneId, 'milestone-provided');
  assert.equal(normalized.milestones[0]?.topics[0]?.topicId, 'Topic.Custom');
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.itemId,
    'fixture-item-reading',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.resourceId,
    'resource-provided',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.href,
    undefined,
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.opaqueReference,
    undefined,
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[1]?.opaqueReference,
    'opaque-ref-1',
  );
  assert.deepEqual(normalized.missingOptionalPaths, [
    'title',
    'goal.description',
    'context.summary',
    'milestones[0].description',
    'milestones[0].topics[0].description',
    'milestones[0].topics[0].items[0].description',
    'milestones[0].topics[0].items[0].resources[0].href',
    'milestones[0].topics[0].items[0].resources[0].opaqueReference',
  ]);
  assert.deepEqual(allocator.calls, [
    'context_entry',
    'resource',
  ]);
});

test('records omitted optional descriptive paths in traversal order', () => {
  const normalized = expectSuccess(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [{ title: 'Topic', items: [{ title: 'Item' }] }],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
  );

  assert.deepEqual(normalized.missingOptionalPaths, [
    'title',
    'goal.description',
    'milestones[0].description',
    'milestones[0].topics[0].description',
    'milestones[0].topics[0].items[0].description',
  ]);
});

test('rejects disallowed controls before edge trimming can hide them', () => {
  const details = expectFailure(
    normalizePlanContent(
      {
        goal: { title: '\u000BGoal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [{ title: 'Topic', items: [{ title: 'Item' }] }],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'unsafe_content',
  );

  assert.deepEqual(details, [
    { path: 'goal.title', code: 'control_character' },
  ]);
});

test('allows equal identifier strings in separate entity namespaces', () => {
  const normalized = expectSuccess(
    normalizePlanContent(
      {
        goal: { goalId: 'shared-id', title: 'Goal' },
        milestones: [
          {
            milestoneId: 'shared-id',
            title: 'Milestone',
            topics: [
              {
                topicId: 'shared-id',
                title: 'Topic',
                items: [
                  {
                    itemId: 'shared-id',
                    title: 'Item',
                    resources: [
                      {
                        resourceId: 'shared-id',
                        label: 'Resource',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
  );

  assert.equal(normalized.goal.goalId, 'shared-id');
  assert.equal(normalized.milestones[0]?.milestoneId, 'shared-id');
  assert.equal(normalized.milestones[0]?.topics[0]?.topicId, 'shared-id');
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.itemId,
    'shared-id',
  );
  assert.equal(
    normalized.milestones[0]?.topics[0]?.items[0]?.resources?.[0]?.resourceId,
    'shared-id',
  );

  const { missingOptionalPaths: _missingOptionalPaths, ...canonical } = normalized;
  assert.equal(validatePlanCandidate(canonical).ok, true);
});

test('allocates stable ids without reordering siblings', () => {
  const allocator = new DeterministicAllocator();

  const normalized = expectSuccess(
    normalizePlanContent(
      {
        goal: {
          title: 'Goal title',
        },
        milestones: [
          {
            title: 'Second milestone',
            topics: [
              {
                title: 'Second topic',
                items: [{ title: 'Second item' }],
              },
            ],
          },
          {
            title: 'First milestone',
            topics: [
              {
                title: 'First topic',
                items: [{ title: 'First item' }],
              },
            ],
          },
        ],
      },
      allocator,
    ),
  );

  assert.deepEqual(
    normalized.milestones.map((milestone) => milestone.title),
    ['Second milestone', 'First milestone'],
  );
  assert.deepEqual(
    normalized.milestones.map((milestone) => milestone.milestoneId),
    ['allocated-milestone-001', 'allocated-milestone-002'],
  );
  assert.deepEqual(
    normalized.milestones.flatMap((milestone) =>
      milestone.topics.map((topic) => topic.topicId),
    ),
    ['allocated-topic-001', 'allocated-topic-002'],
  );
  assert.deepEqual(
    normalized.milestones.flatMap((milestone) =>
      milestone.topics.flatMap((topic) => topic.items.map((item) => item.itemId)),
    ),
    ['allocated-plan_item-001', 'allocated-plan_item-002'],
  );
});

test('rejects malformed non-object input and remains atomic', () => {
  const allocator = new DeterministicAllocator();

  const details = expectFailure(
    normalizePlanContent('not an object', allocator),
    'malformed_input',
  );

  assert.deepEqual(details, [{ path: '', code: 'wrong_type' }]);
  assert.deepEqual(allocator.calls, []);
});

test('rejects required fields that normalize to empty', () => {
  const allocator = new DeterministicAllocator();

  const details = expectFailure(
    normalizePlanContent(
      {
        goal: {
          title: '\t',
        },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [{ title: 'Item' }],
              },
            ],
          },
        ],
      },
      allocator,
    ),
    'missing_required',
  );

  assert.deepEqual(details, [{ path: 'goal.title', code: 'empty' }]);
});

test('rejects text and collection limits at the exact boundary and one past it', () => {
  const shortBoundary = 's'.repeat(DOMAIN_LIMITS.shortText.maxLength);
  const shortOver = 's'.repeat(DOMAIN_LIMITS.shortText.maxLength + 1);
  const longBoundary = 'l'.repeat(DOMAIN_LIMITS.longText.maxLength);
  const longOver = 'l'.repeat(DOMAIN_LIMITS.longText.maxLength + 1);
  const opaqueBoundary = 'o'.repeat(DOMAIN_LIMITS.boundedOpaqueText.maxLength);
  const opaqueOver = 'o'.repeat(DOMAIN_LIMITS.boundedOpaqueText.maxLength + 1);

  const okAllocator = new DeterministicAllocator();
  const okResult = normalizePlanContent(
    {
      title: shortBoundary,
      goal: {
        title: shortBoundary,
        description: longBoundary,
      },
      milestones: [
        {
          title: shortBoundary,
          description: longBoundary,
          topics: [
            {
              title: shortBoundary,
              description: longBoundary,
              items: [
                {
                  title: shortBoundary,
                  description: longBoundary,
                  resources: [
                    {
                      label: shortBoundary,
                      opaqueReference: opaqueBoundary,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    okAllocator,
  );
  assert.equal(okResult.ok, true);

  const cases = [
    {
      name: 'short text over limit',
      candidate: {
        goal: { title: 'Goal' },
        milestones: [{ title: shortOver, topics: [{ title: 'Topic', items: [{ title: 'Item' }] }] }],
      },
      category: 'too_large',
      path: 'milestones[0].title',
      code: 'too_long',
      limit: DOMAIN_LIMITS.shortText.maxLength,
    },
    {
      name: 'long text over limit',
      candidate: {
        goal: { title: 'Goal', description: longOver },
        milestones: [{ title: 'Milestone', topics: [{ title: 'Topic', items: [{ title: 'Item' }] }] }],
      },
      category: 'too_large',
      path: 'goal.description',
      code: 'too_long',
      limit: DOMAIN_LIMITS.longText.maxLength,
    },
    {
      name: 'opaque reference over limit',
      candidate: {
        goal: { title: 'Goal' },
        milestones: [{
          title: 'Milestone',
          topics: [{
            title: 'Topic',
            items: [{
              title: 'Item',
              resources: [{ label: 'Label', opaqueReference: opaqueOver }],
            }],
          }],
        }],
      },
      category: 'too_large',
      path: 'milestones[0].topics[0].items[0].resources[0].opaqueReference',
      code: 'too_long',
      limit: DOMAIN_LIMITS.boundedOpaqueText.maxLength,
    },
  ] as const;

  for (const invalidCase of cases) {
    const details = expectFailure(
      normalizePlanContent(invalidCase.candidate, new DeterministicAllocator()),
      invalidCase.category,
    );
    assert.deepEqual(details, [
      {
        path: invalidCase.path,
        code: invalidCase.code,
        limit: invalidCase.limit,
      },
    ]);
  }
});

test('rejects canonical text totals over the configured limit', () => {
  const overflowingText = 'x'.repeat(DOMAIN_LIMITS.canonicalText.maxLength + 1);
  const allocator = new DeterministicAllocator();

  const details = expectFailure(
    normalizePlanContent(
      {
        goal: {
          title: 'Goal',
          description: overflowingText,
        },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [{ title: 'Item' }],
              },
            ],
          },
        ],
      },
      allocator,
    ),
    'too_large',
  );

  assert.deepEqual(details, [
    {
      path: 'goal.description',
      code: 'limit_exceeded',
      limit: DOMAIN_LIMITS.canonicalText.maxLength,
    },
  ]);
});

void ({} as NormalizedPlanContent);
