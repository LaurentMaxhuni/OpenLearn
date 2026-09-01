import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safePlanHref,
  toPlanDetailViewModel,
  toPlanListViewModel,
} from '../src/view-model.js';

const snapshot = () => ({
    planId: 'plan-foundations',
    revisionId: 'revision-1',
    revisionNumber: 1,
    acceptedAt: '2030-01-02T03:04:05Z',
    content: {
      title: 'Web foundations',
      goal: {
        goalId: 'goal-web',
        title: 'Learn the foundations of the web',
        description: 'Build a clear mental model of browsers and documents.',
      },
      context: {
        summary: 'New to web development.',
        entries: [
          {
            entryId: 'context-start',
            label: 'Starting point',
            value: 'No prior programming experience is assumed.',
          },
        ],
      },
      milestones: [
        {
          milestoneId: 'milestone-browser',
          title: 'Understand the browser',
          topics: [
            {
              topicId: 'topic-documents',
              title: 'Documents and structure',
              items: [
                {
                  itemId: 'item-reading',
                  title: 'Read the overview',
                  description: 'Identify the structural elements in a document.',
                  resources: [
                    {
                      resourceId: 'resource-mdn',
                      label: 'Document reference',
                      href: 'https://example.test/docs',
                    },
                  ],
                },
                {
                  itemId: 'item-request',
                  title: 'Trace a request',
                },
              ],
            },
          ],
        },
      ],
    },
    missingOptionalPaths: [],
    currentProgress: [
      {
        ownerId: 'owner-1',
        planId: 'plan-foundations',
        itemId: 'item-reading',
        progressVersion: 1,
        lastConfirmedAt: '2030-01-03T03:04:05Z',
        state: 'completed_by_learner',
        lastNonCompleteState: 'not_started',
      },
      {
        ownerId: 'owner-1',
        planId: 'plan-foundations',
        itemId: 'item-request',
        progressVersion: 0,
        lastConfirmedAt: '2030-01-02T03:04:05Z',
        state: 'not_started',
      },
    ],
    progressSummary: {
      totalCount: 2,
      completedCount: 1,
      inProgressCount: 0,
      notStartedCount: 1,
      remainingCount: 1,
    },
    nextItemId: 'item-request',
  } as const);

test('maps accepted domain snapshots into ordered dashboard detail view models', () => {
  const view = toPlanDetailViewModel(snapshot(), {
    href: '/plans/plan-foundations',
  });

  assert.equal(view.surfaceState, 'accepted');
  assert.equal(view.title, 'Web foundations');
  assert.equal(view.goal?.title, 'Learn the foundations of the web');
  assert.equal(view.progress.label, '1 of 2 items completed by you');
  assert.equal(view.nextAction?.itemId, 'item-request');
  assert.equal(view.focusedItem?.itemId, 'item-request');
  assert.equal(view.focusedItem?.progressState, 'not_started');
  assert.equal(view.focusedItem?.action.kind, 'start');
  assert.equal(view.focusedItem?.action.label, 'Start item');
  assert.equal(view.outline[0]?.children[0]?.children[0]?.title, 'Read the overview');
  assert.equal(view.outline[0]?.children[0]?.children[1]?.title, 'Trace a request');
});

test('labels in-progress items as complete and keeps retryable actions enabled', () => {
  const base = snapshot();
  const inProgress = base.currentProgress.map((record) =>
    record.itemId === 'item-request'
      ? { ...record, state: 'in_progress' as const }
      : record,
  );
  const inProgressView = toPlanDetailViewModel(
    { ...base, currentProgress: inProgress },
    { href: '/plans/plan-foundations' },
  );
  assert.equal(inProgressView.focusedItem?.action.kind, 'complete');
  assert.equal(inProgressView.focusedItem?.action.label, 'Mark complete');

  const retryView = toPlanDetailViewModel(base, {
    href: '/plans/plan-foundations',
    actionStates: { 'item-request': 'failed_retryable' },
  });
  assert.equal(retryView.focusedItem?.action.state, 'failed_retryable');
  assert.equal(retryView.focusedItem?.action.enabled, true);
});

test('keeps partial diagnostics visible without inventing missing content', () => {
  const view = toPlanDetailViewModel(
    {
      ...snapshot(),
      missingOptionalPaths: ['context', 'milestones[0].topics[0].items[0].description'],
    },
    { href: '/plans/plan-foundations' },
  );

  assert.equal(view.surfaceState, 'partial');
  assert.equal(view.trust.label, 'Plan accepted with some details missing');
  assert.equal(view.context?.summary, 'New to web development.');
  assert.equal(view.focusedItem?.description, undefined);
});

test('gives completed items an explicit undo action while preserving confirmed state', () => {
  const view = toPlanDetailViewModel(snapshot(), {
    href: '/plans/plan-foundations',
    focusedItemId: 'item-reading',
  });

  assert.equal(view.focusedItem?.progressState, 'completed_by_learner');
  assert.equal(view.focusedItem?.action.kind, 'undo_completion');
  assert.equal(view.focusedItem?.action.label, 'Undo completion');
  assert.equal(view.focusedItem?.action.state, 'available');
});

test('builds deterministic list view models and encodes trusted plan references', () => {
  const list = toPlanListViewModel([
    { snapshot: snapshot(), href: '/plans/plan-foundations' },
    {
      snapshot: (() => {
        const { title: _title, ...contentWithoutTitle } = snapshot().content;
        return {
          ...snapshot(),
          planId: 'plan-partial',
          content: contentWithoutTitle,
        missingOptionalPaths: ['title'],
        };
      })(),
      href: '/plans/plan-partial',
    },
  ]);

  assert.equal(list.pageState, 'ready');
  assert.equal(list.plans.length, 2);
  assert.equal(list.plans[0]?.title, 'Web foundations');
  assert.equal(list.plans[1]?.contentState, 'partial');
  assert.equal(safePlanHref('plan/with spaces'), '/plans/plan%2Fwith%20spaces');
});
