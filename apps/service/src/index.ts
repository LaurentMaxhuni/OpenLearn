import { randomBytes } from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {
  connectMcpServer,
  createMcpServer,
  createStdioServerTransport,
  createStatelessStreamableHttpServerTransport,
  MCP_MAX_REQUEST_BYTES,
} from '@openlearn/mcp';
import type {
  ApplicationResult,
  ApplyProgressActionInput,
  ActorContext,
  DeletePlanInput,
  OpenLearnApplication,
  OperationIdGenerator,
  PlanHandoff,
  PlanSummary,
  PlanView,
} from '@openlearn/application';
import { securityHeaders, setRawSecurityHeaders } from './security.js';
import {
  createFixedWindowRateLimiter,
  type RateLimitOptions,
} from './rate-limit.js';
import { createServiceMetrics, type ServiceMetrics } from './metrics.js';

export type ServiceEnvironment = 'local' | 'preview' | 'production';

export interface ServiceConfig {
  readonly dashboardOrigin: string;
  readonly allowedOrigins: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly mcpPath: string;
  readonly buildVersion: string;
  readonly environment?: ServiceEnvironment;
  readonly trustProxy?: boolean;
  readonly rateLimit?: RateLimitOptions;
  readonly metricsPath?: string;
  readonly metricsToken?: string;
}

export interface HttpAuthenticationInput {
  readonly authorization?: string;
  readonly origin?: string;
  readonly cookie?: string;
  readonly csrfToken?: string;
  readonly method?: string;
}

export type HttpAuthenticator = (
  input: HttpAuthenticationInput,
) => ActorContext | undefined | Promise<ActorContext | undefined>;

export type StdioAuthenticator = () =>
  | ActorContext
  | undefined
  | Promise<ActorContext | undefined>;

export interface DashboardApplication {
  listPlanViews(actor: ActorContext): Promise<ApplicationResult<readonly PlanSummary[]>>;
  getPlanView(actor: ActorContext, input: { readonly planId: string }): Promise<ApplicationResult<PlanView>>;
  applyProgressAction(
    actor: ActorContext,
    input: ApplyProgressActionInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>>;
  deletePlan(
    actor: ActorContext,
    input: DeletePlanInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<void>>;
}

export interface DashboardDependencies {
  readonly application: DashboardApplication;
  readonly authenticate: HttpAuthenticator;
  readonly csrfProtection?: (input: HttpAuthenticationInput) => boolean | Promise<boolean>;
}

export interface ServiceDependencies {
  readonly application: OpenLearnApplication;
  readonly authenticateHttp: HttpAuthenticator;
  readonly authenticateStdio: StdioAuthenticator;
  readonly operationIds: Pick<OperationIdGenerator, 'next'>;
  readonly dashboard?: DashboardDependencies;
}

export interface ServiceOptions {
  readonly config: ServiceConfig;
  readonly dependencies: ServiceDependencies;
  readonly readiness?: () => boolean | Promise<boolean>;
  readonly metrics?: ServiceMetrics;
}

export interface OpenLearnService {
  readonly app: FastifyInstance;
  close(): Promise<void>;
}

const validateOrigin = (value: string, label: string): string => {
  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    (parsed.protocol !== 'https:' && !localHttp) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error(`${label} must be a controlled origin.`);
  }
  return parsed.origin;
};

const validateConfig = (config: ServiceConfig): ServiceConfig => {
  const dashboardOrigin = validateOrigin(
    config.dashboardOrigin,
    'dashboardOrigin',
  );
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new Error('port must be an integer between 1 and 65535.');
  }
  if (config.mcpPath !== '/mcp') {
    throw new Error('mcpPath must be /mcp for the Phase 6 contract.');
  }
  if (config.allowedOrigins.length === 0) {
    throw new Error('At least one allowed Origin is required.');
  }
  if (config.buildVersion.trim().length === 0) {
    throw new Error('buildVersion must not be empty.');
  }
  const environment = config.environment ?? 'local';
  if (!['local', 'preview', 'production'].includes(environment)) {
    throw new Error('environment must be local, preview, or production.');
  }
  if (environment === 'production') {
    if (!dashboardOrigin.startsWith('https://')) {
      throw new Error('Production dashboardOrigin must use HTTPS.');
    }
    if (allowedOriginsValueIsLocal(config.allowedOrigins)) {
      throw new Error('Production allowedOrigins must use HTTPS.');
    }
    if (config.metricsToken !== undefined && config.metricsToken.length < 32) {
      throw new Error('Production metricsToken must contain at least 32 characters.');
    }
  }
  if (config.metricsPath !== undefined && !/^\/[-A-Za-z0-9._~/]*$/u.test(config.metricsPath)) {
    throw new Error('metricsPath must be an absolute path without query parameters.');
  }
  const allowedOrigins = config.allowedOrigins.map((origin, index) =>
    validateOrigin(origin, `allowedOrigins[${index}]`),
  );
  return {
    ...config,
    dashboardOrigin,
    allowedOrigins,
    environment,
  };
};

const allowedOriginsValueIsLocal = (origins: readonly string[]): boolean =>
  origins.some((origin) => origin.startsWith('http://'));

const dashboardCors = (
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: readonly string[],
): boolean => {
  const origin = headerValue(request.headers.origin);
  if (!originAllowed(origin, allowedOrigins)) {
    void reply.code(403).send({ error: 'origin_not_allowed' });
    return false;
  }
  if (origin !== undefined) {
    reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('access-control-expose-headers', 'x-request-id, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset');
    reply.header('vary', 'Origin');
  }
  return true;
};

const csrfCookie = (token: string, secure: boolean): string => [
  `openlearn_csrf=${encodeURIComponent(token)}`,
  'Path=/',
  'SameSite=Lax',
  'Max-Age=3600',
  ...(secure ? ['Secure'] : []),
].join('; ');

const requireDependencies = (dependencies: ServiceDependencies): void => {
  if (
    dependencies.application === undefined ||
    dependencies.authenticateHttp === undefined ||
    dependencies.authenticateStdio === undefined ||
    dependencies.operationIds === undefined
  ) {
    throw new Error(
      'application, authenticateHttp, authenticateStdio, and operationIds are required service dependencies.',
    );
  }
};

const originAllowed = (
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean => origin === undefined || allowedOrigins.includes(origin);

const headerValue = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

const pathForRateLimit = (url: string): boolean => {
  const path = url.split('?')[0] ?? url;
  return path === '/mcp' || path === '/api/plans' || path.startsWith('/api/plans/');
};

const responseStatusFor = (result: ApplicationResult<unknown>): number =>
  result.outcome === 'succeeded'
    ? 200
    : result.outcome === 'conflict'
      ? 409
      : result.error?.retryable === true
        ? 503
        : 400;

const bodyRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export const createService = (options: ServiceOptions): OpenLearnService => {
  requireDependencies(options.dependencies);
  const config = validateConfig(options.config);
  const app = Fastify({
    logger: false,
    bodyLimit: MCP_MAX_REQUEST_BYTES,
    trustProxy: config.trustProxy ?? false,
  });
  const metrics = options.metrics ?? createServiceMetrics();
  const limiter = createFixedWindowRateLimiter(
    config.rateLimit ?? { maxRequests: 120, windowMs: 60_000, maxKeys: 10_000 },
  );
  const requestStartedAt = new WeakMap<object, number>();

  app.addHook('onRequest', async (request, reply) => {
    requestStartedAt.set(request, Date.now());
    reply.header('x-request-id', request.id);
    if (!pathForRateLimit(request.url)) return;
    const decision = limiter.consume(request.ip || 'unknown');
    reply.header('x-ratelimit-limit', String(config.rateLimit?.maxRequests ?? 120));
    reply.header('x-ratelimit-remaining', String(decision.remaining));
    reply.header('x-ratelimit-reset', String(Math.ceil(decision.resetAt / 1000)));
    if (!decision.allowed) {
      reply.header('retry-after', String(Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000))));
      await reply.code(429).send({ error: 'rate_limited' });
      return;
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    metrics.recordHttpRequest({
      method: request.method,
      route: request.routeOptions.url ?? (request.url.split('?')[0] ?? request.url),
      statusCode: reply.statusCode,
      durationMs: Date.now() - (requestStartedAt.get(request) ?? Date.now()),
    });
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    securityHeaders(reply);
    if (config.environment === 'production') {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    let ready = true;
    try {
      ready = await options.readiness?.() ?? true;
    } catch {
      ready = false;
    }
    if (!ready) {
      return reply.code(503).send({ status: 'not_ready' });
    }
    return { status: 'ok' };
  });

  app.get(config.metricsPath ?? '/metrics', async (request, reply) => {
    if (config.metricsToken !== undefined) {
      const authorization = headerValue(request.headers.authorization);
      if (authorization !== `Bearer ${config.metricsToken}`) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    }
    return reply
      .type('text/plain; version=0.0.4')
      .send(metrics.renderPrometheus());
  });

  const dashboard = options.dependencies.dashboard;
  if (dashboard !== undefined) {
    app.options('/api/*', async (request, reply) => {
      if (!dashboardCors(request, reply, config.allowedOrigins)) return;
      reply.header('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
      reply.header('access-control-allow-headers', 'authorization, content-type, x-openlearn-csrf');
      reply.header('access-control-max-age', '600');
      return reply.code(204).send();
    });

    const dashboardActor = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<ActorContext | undefined> => {
      if (!dashboardCors(request, reply, config.allowedOrigins)) return undefined;
      const origin = headerValue(request.headers.origin);
      const authorization = headerValue(request.headers.authorization);
      const cookie = headerValue(request.headers.cookie);
      const csrfToken = headerValue(request.headers['x-openlearn-csrf']);
      const input: HttpAuthenticationInput = {
        ...(authorization === undefined
          ? {}
          : { authorization }),
        ...(origin === undefined ? {} : { origin }),
        ...(cookie === undefined
          ? {}
          : { cookie }),
        ...(csrfToken === undefined
          ? {}
          : { csrfToken }),
        method: request.method,
      };
      if (
        dashboard.csrfProtection !== undefined &&
        !(await dashboard.csrfProtection(input))
      ) {
        await reply.code(403).send({ error: 'csrf_failed' });
        return undefined;
      }
      let actor: ActorContext | undefined;
      try {
        actor = await dashboard.authenticate(input);
      } catch {
        actor = undefined;
      }
      if (actor === undefined) {
        await reply.code(401).send({ error: 'unauthorized' });
        return undefined;
      }
      return { ...actor, actorClass: 'dashboard_session' as const };
    };

    app.get('/api/csrf', async (request, reply) => {
      const actor = await dashboardActor(request, reply);
      if (actor === undefined) return;
      const token = randomBytes(32).toString('base64url');
      reply.header('set-cookie', csrfCookie(token, config.environment === 'production'));
      return { csrfToken: token };
    });

    app.get('/api/plans', async (request, reply) => {
      const actor = await dashboardActor(request, reply);
      if (actor === undefined) return;
      try {
        const result = await dashboard.application.listPlanViews(actor);
        return reply.code(responseStatusFor(result)).send(result);
      } catch {
        return reply.code(503).send({ error: 'service_unavailable' });
      }
    });

    app.get('/api/plans/:planId', async (request, reply) => {
      const actor = await dashboardActor(request, reply);
      if (actor === undefined) return;
      const params = request.params as { readonly planId?: string };
      try {
        const result = await dashboard.application.getPlanView(actor, {
          planId: params.planId ?? '',
        });
        return reply.code(responseStatusFor(result)).send(result);
      } catch {
        return reply.code(503).send({ error: 'service_unavailable' });
      }
    });

    app.post('/api/plans/:planId/progress', async (request, reply) => {
      const actor = await dashboardActor(request, reply);
      if (actor === undefined) return;
      const params = request.params as { readonly planId?: string };
      const body = bodyRecord(request.body);
      if (body === undefined) {
        return reply.code(400).send({ error: 'invalid_request' });
      }
      try {
        const result = await dashboard.application.applyProgressAction(actor, {
          ...body,
          planId: params.planId ?? '',
        } as unknown as ApplyProgressActionInput);
        return reply.code(responseStatusFor(result)).send(result);
      } catch {
        return reply.code(503).send({ error: 'service_unavailable' });
      }
    });

    app.delete('/api/plans/:planId', async (request, reply) => {
      const actor = await dashboardActor(request, reply);
      if (actor === undefined) return;
      const params = request.params as { readonly planId?: string };
      const body = bodyRecord(request.body);
      if (body === undefined) {
        return reply.code(400).send({ error: 'invalid_request' });
      }
      try {
        const result = await dashboard.application.deletePlan(actor, {
          ...body,
          planId: params.planId ?? '',
        } as unknown as DeletePlanInput);
        return reply.code(responseStatusFor(result)).send(result);
      } catch {
        return reply.code(503).send({ error: 'service_unavailable' });
      }
    });
  }

  app.all(config.mcpPath, async (request, reply) => {
    const origin =
      typeof request.headers.origin === 'string'
        ? request.headers.origin
        : undefined;
    if (!originAllowed(origin, config.allowedOrigins)) {
      return reply.code(403).send({ error: 'origin_not_allowed' });
    }

    const authorization =
      typeof request.headers.authorization === 'string'
        ? request.headers.authorization
        : undefined;
    let actor: ActorContext | undefined;
    try {
      actor = await options.dependencies.authenticateHttp({
        ...(authorization === undefined ? {} : { authorization }),
        ...(origin === undefined ? {} : { origin }),
      });
    } catch {
      actor = undefined;
    }
    if (actor === undefined) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const mcpServer = createMcpServer({
      application: options.dependencies.application,
      actor: { ...actor, actorClass: 'remote_mcp' },
      operationIds: options.dependencies.operationIds,
    });
    const transport = createStatelessStreamableHttpServerTransport({
      enableJsonResponse: true,
    });

    setRawSecurityHeaders(reply.raw);
    reply.hijack();
    try {
      await connectMcpServer(mcpServer, transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch {
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.setHeader('content-type', 'application/json');
        reply.raw.end(JSON.stringify({ error: 'mcp_request_failed' }));
      }
    } finally {
      await mcpServer.close();
    }
  });

  return {
    app,
    close: () => app.close(),
  };
};

export const serviceConfigFromEnv = (
  env: Record<string, string | undefined>,
): ServiceConfig => {
  const dashboardOrigin = env.OPENLEARN_DASHBOARD_ORIGIN;
  const allowedOriginsValue = env.OPENLEARN_ALLOWED_ORIGINS;
  if (dashboardOrigin === undefined || allowedOriginsValue === undefined) {
    throw new Error(
      'OPENLEARN_DASHBOARD_ORIGIN and OPENLEARN_ALLOWED_ORIGINS are required.',
    );
  }
  const portValue = env.OPENLEARN_SERVICE_PORT ?? '3000';
  const port = Number(portValue);
  if (!Number.isInteger(port)) {
    throw new Error('OPENLEARN_SERVICE_PORT must be an integer.');
  }
  const allowedOrigins = allowedOriginsValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const environmentValue = env.OPENLEARN_ENVIRONMENT ?? 'local';
  if (!['local', 'preview', 'production'].includes(environmentValue)) {
    throw new Error('OPENLEARN_ENVIRONMENT must be local, preview, or production.');
  }
  const rateLimitMax = Number(env.OPENLEARN_RATE_LIMIT_MAX ?? '120');
  const rateLimitWindowMs = Number(env.OPENLEARN_RATE_LIMIT_WINDOW_MS ?? '60000');
  const metricsToken = env.OPENLEARN_METRICS_TOKEN;
  if (environmentValue === 'production' && (metricsToken === undefined || metricsToken.length < 32)) {
    throw new Error('OPENLEARN_METRICS_TOKEN is required in production and must contain 32 characters.');
  }
  return {
    dashboardOrigin,
    allowedOrigins,
    host: env.OPENLEARN_SERVICE_HOST ?? '127.0.0.1',
    port,
    mcpPath: '/mcp',
    buildVersion: env.OPENLEARN_BUILD_VERSION ?? 'dev',
    environment: environmentValue as ServiceEnvironment,
    trustProxy: env.OPENLEARN_TRUST_PROXY === 'true',
    rateLimit: {
      maxRequests: rateLimitMax,
      windowMs: rateLimitWindowMs,
    },
    metricsPath: env.OPENLEARN_METRICS_PATH ?? '/metrics',
    ...(metricsToken === undefined ? {} : { metricsToken }),
  };
};

export interface StdioRuntime {
  close(): Promise<void>;
}

export const startStdio = async (
  dependencies: ServiceDependencies,
): Promise<StdioRuntime> => {
  requireDependencies(dependencies);
  let actor: ActorContext | undefined;
  try {
    actor = await dependencies.authenticateStdio();
  } catch {
    actor = undefined;
  }
  if (actor === undefined) {
    throw new Error('stdio authentication failed.');
  }

  const server = createMcpServer({
    application: dependencies.application,
    actor: { ...actor, actorClass: 'local_stdio' },
    operationIds: dependencies.operationIds,
  });
  const transport = createStdioServerTransport();
  await connectMcpServer(server, transport);
  process.stderr.write('OpenLearn MCP stdio server started.\n');

  return {
    close: async () => {
      await server.close();
    },
  };
};
