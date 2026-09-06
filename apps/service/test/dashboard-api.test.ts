import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ActorContext,
  ApplicationResult,
  PlanHandoff,
  PlanSummary,
  PlanView,
} from '@openlearn/application';
import { createService, type DashboardApplication } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-dashboard-api' as ActorContext['ownerId'],
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'dashboard_session',
};

const success = <T>(value: T): ApplicationResult<T> => ({
  outcome: 'succeeded',
  operation: { operationId: 'dashboard-api-operation', state: 'succeeded' },
  value,
});

const application: DashboardApplication = {
  listPlanViews: async () => success<readonly PlanSummary[]>([]),
  getPlanView: async (_actor, input) => success<PlanView>({
    planId: input.planId as PlanView['planId'],
    revisionId: 'revision-dashboard-api' as PlanView['revisionId'],
    revisionNumber: 1,
    acceptedAt: '2030-01-06T03:04:05.000Z' as PlanView['acceptedAt'],
    content: {} as PlanView['content'],
    missingOptionalPaths: [],
    currentProgress: [],
    progressSummary: { totalCount: 0, completedCount: 0, inProgressCount: 0, notStartedCount: 0, remainingCount: 0 },
    dashboardUrl: `https://dashboard.example.test/plans/${input.planId}`,
  }),
  applyProgressAction: async () => success<PlanHandoff>({
    planId: 'plan-dashboard-api' as PlanHandoff['planId'],
    revisionId: 'revision-dashboard-api' as PlanHandoff['revisionId'],
    revisionNumber: 1,
    dashboardUrl: 'https://dashboard.example.test/plans/plan-dashboard-api',
  }),
  deletePlan: async () => success<void>(undefined),
};

const serviceFor = (calls: string[]) => createService({
  config: {
    dashboardOrigin: 'https://dashboard.example.test',
    allowedOrigins: ['https://dashboard.example.test'],
    host: '127.0.0.1',
    port: 3000,
    mcpPath: '/mcp',
    buildVersion: 'dashboard-api-test',
  },
  dependencies: {
    application: {
      createPlanView: async () => success<PlanHandoff>({
        planId: 'plan-dashboard-api' as PlanHandoff['planId'],
        revisionId: 'revision-dashboard-api' as PlanHandoff['revisionId'],
        revisionNumber: 1,
        dashboardUrl: 'https://dashboard.example.test/plans/plan-dashboard-api',
      }),
      getPlanView: async () => success<PlanView>({} as PlanView),
      applyProgressAction: async () => success<PlanHandoff>({} as PlanHandoff),
    },
    authenticateHttp: async () => actor,
    authenticateStdio: async () => actor,
    operationIds: { next: () => 'dashboard-api-mcp-operation' },
    dashboard: {
      application,
      authenticate: async (input) => {
        calls.push(`${input.method ?? 'unknown'}:${input.cookie ?? 'no-cookie'}`);
        return actor;
      },
      csrfProtection: (input) => input.method === 'GET' || input.csrfToken === 'csrf-ok',
    },
  },
});

test('serves authenticated dashboard reads and protects mutations with CSRF', async () => {
  const calls: string[] = [];
  const service = serviceFor(calls);
  try {
    const preflight = await service.app.inject({
      method: 'OPTIONS',
      url: '/api/plans',
      headers: { origin: 'https://dashboard.example.test' },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['access-control-allow-methods'], 'GET, POST, DELETE, OPTIONS');

    const list = await service.app.inject({
      method: 'GET',
      url: '/api/plans',
      headers: { origin: 'https://dashboard.example.test', cookie: 'openlearn_session=session' },
    });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.json().value, []);

    const csrf = await service.app.inject({
      method: 'GET',
      url: '/api/csrf',
      headers: { origin: 'https://dashboard.example.test', cookie: 'openlearn_session=session' },
    });
    assert.equal(csrf.statusCode, 200);
    assert.equal(typeof csrf.json().csrfToken, 'string');
    assert.match(String(csrf.headers['set-cookie']), /openlearn_csrf=/u);

    const rejected = await service.app.inject({
      method: 'POST',
      url: '/api/plans/plan-dashboard-api/progress',
      headers: { origin: 'https://dashboard.example.test', cookie: 'openlearn_session=session' },
      payload: {},
    });
    assert.equal(rejected.statusCode, 403);

    const accepted = await service.app.inject({
      method: 'POST',
      url: '/api/plans/plan-dashboard-api/progress',
      headers: {
        origin: 'https://dashboard.example.test',
        cookie: 'openlearn_session=session',
        'x-openlearn-csrf': 'csrf-ok',
      },
      payload: { action: 'start_item' },
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(calls.length, 3);
  } finally {
    await service.app.close();
  }
});
