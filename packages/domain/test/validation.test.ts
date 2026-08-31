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

const createMinimalCandidate = () => ({
  goal: {
    title: 'Goal',
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
});

test('accepts validation of a minimal normalized candidate', () => {
  const allocator = new DeterministicAllocator();
  const normalizedResult = normalizePlanContent(createMinimalCandidate(), allocator);

  assert.equal(normalizedResult.ok, true);
  if (!normalizedResult.ok) {
    throw new Error(`expected normalized candidate, received ${normalizedResult.category}`);
  }

  const { missingOptionalPaths: _missingOptionalPaths, ...canonical } =
    normalizedResult.value;
  const validated = validatePlanCandidate(canonical);
  assert.equal(validated.ok, true);
});

test('accepts label-only, opaque-reference-only, and safe https resources', () => {
  const allocator = new DeterministicAllocator();
  const result = normalizePlanContent(
    {
      goal: {
        title: 'Goal',
      },
      milestones: [
        {
          title: 'Milestone',
          topics: [
            {
              title: 'Topic',
              items: [
                {
                  title: 'Item',
                  resources: [
                    { label: 'Label only' },
                    { label: 'Opaque only', opaqueReference: 'course/segment-1' },
                    { label: 'Safe URL', href: 'https://example.com/guide' },
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

  assert.equal(result.ok, true);
});

test('rejects unsafe, malformed, credential-bearing, overlong, and control-containing urls', () => {
  const invalidCases = [
    { href: 'http://example.com', code: 'unsafe_value' },
    { href: 'https://user:pass@example.com/path', code: 'unsafe_value' },
    { href: 'https://example.com/\u0000bad', code: 'control_character' },
    { href: 'https://', code: 'invalid_syntax' },
    { href: `https://example.com/${'a'.repeat(DOMAIN_LIMITS.safeHttpsUrl.maxLength)}`, code: 'too_long' },
  ] as const;

  for (const invalidCase of invalidCases) {
    const allocator = new DeterministicAllocator();
    const details = expectFailure(
      normalizePlanContent(
        {
          goal: {
            title: 'Goal',
          },
          milestones: [
            {
              title: 'Milestone',
              topics: [
                {
                  title: 'Topic',
                  items: [
                    {
                      title: 'Item',
                      resources: [{ label: 'Resource', href: invalidCase.href }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        allocator,
      ),
      invalidCase.code === 'too_long' ? 'too_large' : 'unsafe_content',
    );

    assert.deepEqual(details, [
      {
        path: 'milestones[0].topics[0].items[0].resources[0].href',
        code: invalidCase.code,
        ...(invalidCase.code === 'too_long'
          ? { limit: DOMAIN_LIMITS.safeHttpsUrl.maxLength }
          : {}),
      },
    ]);
  }
});

test('rejects unknown fields and forbidden accepted-state fields at root and nested levels', () => {
  const forbiddenCases = [
    { path: 'ownerId', candidate: { ...createMinimalCandidate(), ownerId: 'owner-1' } },
    { path: 'goal.primary', candidate: { ...createMinimalCandidate(), goal: { title: 'Goal', primary: true } } },
    { path: 'context.lifecycle', candidate: { ...createMinimalCandidate(), context: { lifecycle: 'active' } } },
    {
      path: 'milestones[0].topics[0].items[0].progress',
      candidate: {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [{ title: 'Item', progress: 'done' }],
              },
            ],
          },
        ],
      },
    },
    {
      path: 'milestones[0].topics[0].items[0].resources[0].deletedAt',
      candidate: {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [
                  {
                    title: 'Item',
                    resources: [{ label: 'Resource', deletedAt: '2030-01-01T00:00:00Z' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ] as const;

  for (const invalidCase of forbiddenCases) {
    const details = expectFailure(
      normalizePlanContent(invalidCase.candidate, new DeterministicAllocator()),
      'unknown_field',
    );
    assert.deepEqual(details, [{ path: invalidCase.path, code: 'unknown_field' }]);
  }
});

test('rejects structural minimums and maximums at boundaries', () => {
  const noMilestones = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [],
      },
      new DeterministicAllocator(),
    ),
    'missing_required',
  );
  assert.deepEqual(noMilestones, [{ path: 'milestones', code: 'empty' }]);

  const noTopics = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [{ title: 'Milestone', topics: [] }],
      },
      new DeterministicAllocator(),
    ),
    'missing_required',
  );
  assert.deepEqual(noTopics, [{ path: 'milestones[0].topics', code: 'empty' }]);

  const noItems = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [{ title: 'Milestone', topics: [{ title: 'Topic', items: [] }] }],
      },
      new DeterministicAllocator(),
    ),
    'missing_required',
  );
  assert.deepEqual(noItems, [{ path: 'milestones[0].topics[0].items', code: 'empty' }]);

  const tooManyMilestones = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: Array.from({ length: DOMAIN_LIMITS.milestones.max + 1 }, (_, index) => ({
          title: `Milestone ${index + 1}`,
          topics: [{ title: 'Topic', items: [{ title: 'Item' }] }],
        })),
      },
      new DeterministicAllocator(),
    ),
    'too_large',
  );
  assert.deepEqual(tooManyMilestones, [
    { path: 'milestones', code: 'limit_exceeded', limit: DOMAIN_LIMITS.milestones.max },
  ]);

  const topicsAtBoundary = normalizePlanContent(
    {
      goal: { title: 'Goal' },
      milestones: [
        {
          title: 'Milestone',
          topics: Array.from({ length: DOMAIN_LIMITS.topicsPerPlan.max }, (_, index) => ({
            title: `Topic ${index + 1}`,
            items: [{ title: 'Item' }],
          })),
        },
      ],
    },
    new DeterministicAllocator(),
  );
  assert.equal(topicsAtBoundary.ok, true);

  const tooManyTopics = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: Array.from({ length: DOMAIN_LIMITS.topicsPerPlan.max + 1 }, (_, index) => ({
              title: `Topic ${index + 1}`,
              items: [{ title: 'Item' }],
            })),
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'too_large',
  );
  assert.deepEqual(tooManyTopics, [
    { path: 'milestones[0].topics', code: 'limit_exceeded', limit: DOMAIN_LIMITS.topicsPerPlan.max },
  ]);

  const itemsAtBoundary = normalizePlanContent(
    {
      goal: { title: 'Goal' },
      milestones: [
        {
          title: 'Milestone',
          topics: [
            {
              title: 'Topic',
              items: Array.from({ length: DOMAIN_LIMITS.planItemsPerPlan.max }, (_, index) => ({
                title: `Item ${index + 1}`,
              })),
            },
          ],
        },
      ],
    },
    new DeterministicAllocator(),
  );
  assert.equal(itemsAtBoundary.ok, true);

  const tooManyItems = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: Array.from({ length: DOMAIN_LIMITS.planItemsPerPlan.max + 1 }, (_, index) => ({
                  title: `Item ${index + 1}`,
                })),
              },
            ],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'too_large',
  );
  assert.deepEqual(tooManyItems, [
    {
      path: 'milestones[0].topics[0].items',
      code: 'limit_exceeded',
      limit: DOMAIN_LIMITS.planItemsPerPlan.max,
    },
  ]);

  const resourcesAtBoundary = normalizePlanContent(
    {
      goal: { title: 'Goal' },
      milestones: [
        {
          title: 'Milestone',
          topics: [
            {
              title: 'Topic',
              items: [
                {
                  title: 'Item',
                  resources: Array.from(
                    { length: DOMAIN_LIMITS.resourcesPerItem.max },
                    (_, index) => ({ label: `Resource ${index + 1}` }),
                  ),
                },
              ],
            },
          ],
        },
      ],
    },
    new DeterministicAllocator(),
  );
  assert.equal(resourcesAtBoundary.ok, true);

  const tooManyResources = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        milestones: [
          {
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [
                  {
                    title: 'Item',
                    resources: Array.from(
                      { length: DOMAIN_LIMITS.resourcesPerItem.max + 1 },
                      (_, index) => ({ label: `Resource ${index + 1}` }),
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'too_large',
  );
  assert.deepEqual(tooManyResources, [
    {
      path: 'milestones[0].topics[0].items[0].resources',
      code: 'limit_exceeded',
      limit: DOMAIN_LIMITS.resourcesPerItem.max,
    },
  ]);

  const contextAtBoundary = normalizePlanContent(
    {
      goal: { title: 'Goal' },
      context: {
        entries: Array.from({ length: DOMAIN_LIMITS.contextEntries.max }, (_, index) => ({
          label: `Entry ${index + 1}`,
          value: `Value ${index + 1}`,
        })),
      },
      milestones: [
        {
          title: 'Milestone',
          topics: [{ title: 'Topic', items: [{ title: 'Item' }] }],
        },
      ],
    },
    new DeterministicAllocator(),
  );
  assert.equal(contextAtBoundary.ok, true);

  const tooManyContextEntries = expectFailure(
    normalizePlanContent(
      {
        goal: { title: 'Goal' },
        context: {
          entries: Array.from({ length: DOMAIN_LIMITS.contextEntries.max + 1 }, (_, index) => ({
            label: `Entry ${index + 1}`,
            value: `Value ${index + 1}`,
          })),
        },
        milestones: [
          {
            title: 'Milestone',
            topics: [{ title: 'Topic', items: [{ title: 'Item' }] }],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'too_large',
  );
  assert.deepEqual(tooManyContextEntries, [
    { path: 'context.entries', code: 'limit_exceeded', limit: DOMAIN_LIMITS.contextEntries.max },
  ]);
});

test('rejects duplicate identifiers and invalid parent-child relationships atomically', () => {
  const duplicateDetails = expectFailure(
    normalizePlanContent(
      {
        goal: {
          goalId: 'dup-id',
          title: 'Goal',
        },
        milestones: [
          {
            milestoneId: 'dup-milestone-id',
            title: 'Milestone',
            topics: [
              {
                title: 'Topic',
                items: [{ title: 'Item' }],
              },
            ],
          },
          {
            milestoneId: 'dup-milestone-id',
            title: 'Another milestone',
            topics: [
              {
                title: 'Another topic',
                items: [{ title: 'Another item' }],
              },
            ],
          },
        ],
      },
      new DeterministicAllocator(),
    ),
    'duplicate_identifier',
  );
  assert.deepEqual(duplicateDetails, [{ path: 'milestones[1].milestoneId', code: 'duplicate_value' }]);

  const normalized = normalizePlanContent(
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
  );
  assert.equal(normalized.ok, true);
  if (!normalized.ok) {
    throw new Error(`expected normalized candidate, received ${normalized.category}`);
  }

  const { missingOptionalPaths: _missingOptionalPaths, ...canonical } =
    normalized.value;

  const relationshipDetails = expectFailure(
    validatePlanCandidate({
      ...canonical,
      milestones: [
        {
          ...canonical.milestones[0],
          topics: [],
        },
      ],
    }),
    'invalid_relationship',
  );
  assert.deepEqual(relationshipDetails, [
    { path: 'milestones[0].topics', code: 'relationship_mismatch' },
  ]);
});

test('rejects control characters in descriptive content and does not return partial normalization', () => {
  const allocator = new DeterministicAllocator();

  const details = expectFailure(
    normalizePlanContent(
      {
        goal: {
          title: 'Goal',
          description: 'Unsafe\u0007bell',
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
    'unsafe_content',
  );

  assert.deepEqual(details, [{ path: 'goal.description', code: 'control_character' }]);
  assert.deepEqual(allocator.calls, []);
});

test('validates a plan with 101 topics without double-counting topics', () => {
  const normalizedResult = normalizePlanContent(
    {
      goal: { title: 'Goal' },
      milestones: [
        {
          title: 'Milestone',
          topics: Array.from({ length: 101 }, (_, index) => ({
            title: `Topic ${index + 1}`,
            items: [{ title: `Item ${index + 1}` }],
          })),
        },
      ],
    },
    new DeterministicAllocator(),
  );

  assert.equal(normalizedResult.ok, true);
  if (!normalizedResult.ok) {
    throw new Error(`expected normalized candidate, received ${normalizedResult.category}`);
  }

  const { missingOptionalPaths: _missingOptionalPaths, ...canonical } =
    normalizedResult.value;
  const validated = validatePlanCandidate(canonical);

  assert.equal(validated.ok, true);
});

test('rejects manually constructed non-canonical text during runtime validation', () => {
  const normalizedResult = normalizePlanContent(
    createMinimalCandidate(),
    new DeterministicAllocator(),
  );

  assert.equal(normalizedResult.ok, true);
  if (!normalizedResult.ok) {
    throw new Error(`expected normalized candidate, received ${normalizedResult.category}`);
  }

  const { missingOptionalPaths: _missingOptionalPaths, ...canonical } =
    normalizedResult.value;

  const result = validatePlanCandidate({
    ...canonical,
    goal: {
      ...canonical.goal,
      title: ' Goal\t\r\n',
    },
  });

  const details = expectFailure(result, 'malformed_input');

  assert.deepEqual(details, [{ path: 'goal.title', code: 'invalid_syntax' }]);
});

test('rejects normalization diagnostics supplied as candidate fields', () => {
  const result = validatePlanCandidate({
    ...createMinimalCandidate(),
    missingOptionalPaths: ['x'.repeat(100_000)],
  });

  const details = expectFailure(result, 'unknown_field');

  assert.deepEqual(details, [
    { path: 'missingOptionalPaths', code: 'unknown_field' },
  ]);
});

test('counts href values toward the aggregate canonical text limit', () => {
  const hrefPrefix = 'https://example.com/';
  const href = `${hrefPrefix}${'a'.repeat(
    DOMAIN_LIMITS.safeHttpsUrl.maxLength - hrefPrefix.length,
  )}`;
  const candidate = {
    goal: { goalId: 'goal-url-budget', title: 'Goal' },
    milestones: [
      {
        milestoneId: 'milestone-url-budget',
        title: 'Milestone',
        topics: [
          {
            topicId: 'topic-url-budget',
            title: 'Topic',
            items: Array.from({ length: 5 }, (_, itemIndex) => ({
              itemId: `item-url-budget-${itemIndex}`,
              title: `Item ${itemIndex}`,
              resources: Array.from({ length: 20 }, (_, resourceIndex) => ({
                resourceId: `resource-url-budget-${itemIndex}-${resourceIndex}`,
                label: 'Resource',
                href,
              })),
            })),
          },
        ],
      },
    ],
  };

  const result = validatePlanCandidate(candidate);
  const details = expectFailure(result, 'too_large');

  assert.equal(details[0]?.code, 'limit_exceeded');
  assert.equal(details[0]?.path?.endsWith('.href'), true);
  assert.equal(details[0]?.limit, DOMAIN_LIMITS.canonicalText.maxLength);
});
