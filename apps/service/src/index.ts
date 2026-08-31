import Fastify, { type FastifyInstance } from 'fastify';
import {
  connectMcpServer,
  createMcpServer,
  createStdioServerTransport,
  createStatelessStreamableHttpServerTransport,
} from '@openlearn/mcp';
import type {
  ActorContext,
  OpenLearnApplication,
  OperationIdGenerator,
} from '@openlearn/application';

export interface ServiceConfig {
  readonly dashboardOrigin: string;
  readonly allowedOrigins: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly mcpPath: string;
  readonly buildVersion: string;
}

export interface HttpAuthenticationInput {
  readonly authorization?: string;
  readonly origin?: string;
}

export type HttpAuthenticator = (
  input: HttpAuthenticationInput,
) => ActorContext | undefined | Promise<ActorContext | undefined>;

export type StdioAuthenticator = () =>
  | ActorContext
  | undefined
  | Promise<ActorContext | undefined>;

export interface ServiceDependencies {
  readonly application: OpenLearnApplication;
  readonly authenticateHttp: HttpAuthenticator;
  readonly authenticateStdio: StdioAuthenticator;
  readonly operationIds: Pick<OperationIdGenerator, 'next'>;
}

export interface ServiceOptions {
  readonly config: ServiceConfig;
  readonly dependencies: ServiceDependencies;
  readonly readiness?: () => boolean | Promise<boolean>;
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
  const allowedOrigins = config.allowedOrigins.map((origin, index) =>
    validateOrigin(origin, `allowedOrigins[${index}]`),
  );
  return {
    ...config,
    dashboardOrigin,
    allowedOrigins,
  };
};

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

export const createService = (options: ServiceOptions): OpenLearnService => {
  requireDependencies(options.dependencies);
  const config = validateConfig(options.config);
  const app = Fastify({ logger: false });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await options.readiness?.() ?? true;
    if (!ready) {
      return reply.code(503).send({ status: 'not_ready' });
    }
    return { status: 'ok' };
  });

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
  return {
    dashboardOrigin,
    allowedOrigins,
    host: env.OPENLEARN_SERVICE_HOST ?? '127.0.0.1',
    port,
    mcpPath: '/mcp',
    buildVersion: env.OPENLEARN_BUILD_VERSION ?? 'dev',
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
