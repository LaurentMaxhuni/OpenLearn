import { randomUUID } from 'node:crypto';
import {
  createApplication,
  type ActorContext,
  type Clock,
  type OperationIdGenerator,
} from '@openlearn/application';
import { brandIdentifier, type IdentityAllocator } from '@openlearn/domain';
import {
  createOidcAuthenticator,
  createSessionAuthenticator,
} from '@openlearn/identity';
import {
  createPostgresApplicationState,
  createPostgresPrincipalResolver,
  createPostgresPool,
} from '@openlearn/persistence';
import {
  createService,
  serviceConfigFromEnv,
  type DashboardApplication,
} from './index.js';
import { dashboardCsrfProtection } from './csrf.js';
import { createServiceMetrics } from './metrics.js';
import { createRedactedTelemetrySink } from './telemetry.js';

const requiredEnv = (
  env: Record<string, string | undefined>,
  name: string,
): string => {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for the hosted service.`);
  }
  return value;
};

const localActor = (env: Record<string, string | undefined>): ActorContext | undefined => {
  const ownerValue = env.OPENLEARN_LOCAL_OWNER_ID;
  if (ownerValue === undefined) return undefined;
  const owner = brandIdentifier('internal_owner', ownerValue);
  if (!owner.ok) return undefined;
  const scopes = (env.OPENLEARN_LOCAL_SCOPES ?? 'plan:read,plan:write,progress:write')
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope): scope is ActorContext['scopes'][number] =>
      ['plan:read', 'plan:write', 'progress:write', 'personalization:read', 'personalization:write'].includes(scope),
    );
  return { ownerId: owner.value, scopes, actorClass: 'local_stdio' };
};

const createAllocator = (): IdentityAllocator => ({
  allocate: (kind) => `openlearn-${kind}-${randomUUID()}`,
});

const clock: Clock = { now: () => new Date() };
const operationIds: OperationIdGenerator = { next: () => randomUUID() };

export const startHostedService = async (
  env: Record<string, string | undefined> = process.env,
): Promise<{ close(): Promise<void> }> => {
  const config = serviceConfigFromEnv(env);
  const connectionString = requiredEnv(env, 'OPENLEARN_DATABASE_URL');
  const issuer = requiredEnv(env, 'OPENLEARN_OIDC_ISSUER');
  const jwksUrl = requiredEnv(env, 'OPENLEARN_OIDC_JWKS_URL');
  const audience = requiredEnv(env, 'OPENLEARN_OIDC_AUDIENCE');
  const sessionSecret = requiredEnv(env, 'OPENLEARN_SESSION_SECRET');
  const pool = createPostgresPool({
    connectionString,
    max: Number(env.OPENLEARN_DATABASE_POOL_MAX ?? '10'),
    ...(config.environment === 'production'
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
  const state = createPostgresApplicationState({ pool, clock });
  const resolver = createPostgresPrincipalResolver({ pool, clock });
  const metrics = createServiceMetrics();
  const telemetry = createRedactedTelemetrySink({ metrics });
  const applicationWithTelemetry = createApplication({
    state,
    allocator: createAllocator(),
    clock,
    operationIds,
    telemetry,
    dashboardOrigin: config.dashboardOrigin,
  });
  if (
    applicationWithTelemetry.listPlanViews === undefined ||
    applicationWithTelemetry.deletePlan === undefined
  ) {
    await pool.end();
    throw new Error('The hosted application is missing dashboard use cases.');
  }
  const hostedDashboardApplication: DashboardApplication = {
    listPlanViews: applicationWithTelemetry.listPlanViews,
    getPlanView: applicationWithTelemetry.getPlanView,
    applyProgressAction: applicationWithTelemetry.applyProgressAction,
    deletePlan: applicationWithTelemetry.deletePlan,
  };
  const httpAuthenticator = createOidcAuthenticator({
    issuer,
    audience,
    jwksUrl,
    resolver,
    actorClass: 'remote_mcp',
  });
  const sessionAuthenticator = createSessionAuthenticator({
    issuer,
    audience: env.OPENLEARN_DASHBOARD_AUDIENCE ?? config.dashboardOrigin,
    secret: sessionSecret,
    resolver,
  });
  const service = createService({
    config,
    dependencies: {
      application: applicationWithTelemetry,
      authenticateHttp: httpAuthenticator,
      authenticateStdio: async () => localActor(env),
      operationIds,
      dashboard: {
        application: hostedDashboardApplication,
        authenticate: sessionAuthenticator,
        csrfProtection: dashboardCsrfProtection,
      },
    },
    metrics,
    readiness: () => state.ping(),
  });
  await service.app.listen({ host: config.host, port: config.port });
  const close = async (): Promise<void> => {
    await service.close();
    await pool.end();
  };
  process.once('SIGTERM', () => void close());
  process.once('SIGINT', () => void close());
  return { close };
};

if (process.argv[1]?.endsWith('entrypoint.js') === true) {
  try {
    await startHostedService();
  } catch (error) {
    process.stderr.write(
      `OpenLearn service failed to start: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
