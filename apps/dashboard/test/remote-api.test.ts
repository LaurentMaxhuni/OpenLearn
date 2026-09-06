import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApiClient } from '../src/remote-api.js';

const summary = {
  totalCount: 1,
  completedCount: 0,
  inProgressCount: 0,
  notStartedCount: 1,
  remainingCount: 1,
};

const plan = {
  planId: 'connected-plan',
  revisionId: 'connected-revision',
  revisionNumber: 1,
  acceptedAt: '2030-01-06T03:04:05.000Z',
  content: {
    title: 'Connected plan',
    goal: { goalId: 'connected-goal', title: 'Learn connected systems' },
    milestones: [
      {
        milestoneId: 'connected-milestone',
        title: 'Start',
        topics: [
          {
            topicId: 'connected-topic',
            title: 'First topic',
            items: [{ itemId: 'connected-item', title: 'First item' }],
          },
        ],
      },
    ],
  },
  missingOptionalPaths: [],
  currentProgress: [
    {
      ownerId: 'connected-owner',
      planId: 'connected-plan',
      itemId: 'connected-item',
      progressVersion: 0,
      lastConfirmedAt: '2030-01-06T03:04:05.000Z',
      state: 'not_started',
    },
  ],
  progressSummary: summary,
  nextItemId: 'connected-item',
  dashboardUrl: 'https://dashboard.example.test/plans/connected-plan',
};

test('connected dashboard client hydrates plans and carries a CSRF token', async () => {
  const requests: { readonly url: string; readonly init?: RequestInit }[] = [];
  const client = createDashboardApiClient({
    fetch: async (input, init) => {
      const url = String(input);
      requests.push({ url, ...(init === undefined ? {} : { init }) });
      if (url.endsWith('/api/csrf')) {
        return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 });
      }
      if (url.endsWith('/api/plans') && init?.method === undefined) {
        return new Response(JSON.stringify({
          outcome: 'succeeded',
          value: [{
            planId: plan.planId,
            revisionId: plan.revisionId,
            revisionNumber: plan.revisionNumber,
            acceptedAt: plan.acceptedAt,
            goalTitle: plan.content.goal.title,
            progressSummary: summary,
            dashboardUrl: plan.dashboardUrl,
          }],
        }), { status: 200 });
      }
      if (url.endsWith('/api/plans/connected-plan')) {
        return new Response(JSON.stringify({ outcome: 'succeeded', value: plan }), { status: 200 });
      }
      return new Response(JSON.stringify({
        outcome: 'succeeded',
        value: {
          planId: plan.planId,
          revisionId: plan.revisionId,
          revisionNumber: plan.revisionNumber,
          dashboardUrl: plan.dashboardUrl,
        },
      }), { status: 200 });
    },
  });

  const plans = await client.listPlanViews();
  assert.equal(plans.length, 1);
  await client.applyProgressAction({
    planId: plan.planId,
    itemId: 'connected-item',
    action: 'start_item',
    expectedRevisionId: plan.revisionId,
    expectedProgressVersion: 0,
    idempotencyKey: 'progress-operation',
    confirmedAt: plan.acceptedAt,
  });
  await client.deletePlan({
    planId: plan.planId,
    expectedRevisionId: plan.revisionId,
    idempotencyKey: 'delete-operation',
    deletedAt: plan.acceptedAt,
  });

  assert.equal(requests[0]?.url.endsWith('/api/plans'), true);
  assert.equal(requests[2]?.url.endsWith('/api/csrf'), true);
  const progressRequest = requests.find((request) => request.url.endsWith('/progress'));
  const deleteRequest = requests.find((request) => request.init?.method === 'DELETE');
  assert.equal(new Headers(progressRequest?.init?.headers).get('x-openlearn-csrf'), 'csrf-token');
  assert.equal(new Headers(deleteRequest?.init?.headers).get('x-openlearn-csrf'), 'csrf-token');
});
