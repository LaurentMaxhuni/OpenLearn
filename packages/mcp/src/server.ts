import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  ActorContext,
  ApplicationResult,
  ApplyProgressActionInput,
  CreatePlanViewInput,
  GetPlanViewInput,
  OperationIdGenerator,
  PlanHandoff,
  PlanView,
} from '@openlearn/application';
import {
  MCP_CONTRACT_VERSION,
  MCP_TOOL_NAMES,
  applyProgressActionInputSchema,
  createPlanViewInputSchema,
  getPlanViewInputSchema,
  oauth2SecuritySchemes,
  resultOutputSchema,
  type McpResultEnvelope,
  type McpServerDependencies,
  type McpServerInfo,
} from './contracts.js';

interface RequestExtra {
  readonly signal: AbortSignal;
}

type ResultFields = Pick<McpResultEnvelope, 'plan' | 'snapshot'>;

const defaultServerInfo: McpServerInfo = {
  name: 'openlearn-mcp',
  version: '0.0.0',
};

const internalFailureResult = (
  operationIds: Pick<OperationIdGenerator, 'next'>,
): ApplicationResult<never> => ({
  outcome: 'failed_retryable',
  operation: {
    operationId: operationIds.next(),
    state: 'failed_retryable',
  },
  error: {
    code: 'internal_failure',
    message: 'The request could not be completed. Try again later.',
    retryable: true,
  },
});

const resultFieldsForPlan = (value: PlanHandoff): ResultFields => ({
  plan: value,
});

const resultFieldsForView = (value: PlanView): ResultFields => ({
  plan: {
    planId: value.planId,
    revisionId: value.revisionId,
    revisionNumber: value.revisionNumber,
    dashboardUrl: value.dashboardUrl,
  },
  snapshot: (({ dashboardUrl: _dashboardUrl, ...snapshot }) => snapshot)(value),
});

type SerializedTool = Record<string, unknown> & {
  readonly _meta?: Record<string, unknown>;
};

type ToolListResult = {
  readonly tools: readonly SerializedTool[];
};

type RequestHandler = (
  request: unknown,
  extra: unknown,
) => Promise<ToolListResult>;

type ServerInternals = {
  readonly _requestHandlers?: Map<string, RequestHandler>;
};

/**
 * The MCP SDK currently serializes custom tool metadata under `_meta`, while
 * ChatGPT's connector auth contract reads `securitySchemes` at the tool root.
 * Keep the metadata mirrored and promote it at the SDK boundary. This is
 * isolated here so the rest of the application remains SDK-agnostic.
 */
const exposeRootSecuritySchemes = (server: McpServer): void => {
  const internals = server.server as unknown as ServerInternals;
  const originalHandler = internals._requestHandlers?.get('tools/list');
  if (originalHandler === undefined) {
    throw new Error('MCP SDK did not install the tools/list handler.');
  }

  server.server.setRequestHandler(
    ListToolsRequestSchema,
    async (request, extra) => {
      const result = await originalHandler(request, extra);
      return {
        ...result,
        tools: result.tools.map((tool) => {
          const securitySchemes = tool._meta?.securitySchemes;
          return securitySchemes === undefined
            ? tool
            : { ...tool, securitySchemes };
        }),
      };
    },
  );
};

const toEnvelope = <T>(
  result: ApplicationResult<T>,
  resultFields?: (value: T) => ResultFields,
): McpResultEnvelope => {
  const fields = result.value === undefined || resultFields === undefined
    ? undefined
    : resultFields(result.value);
  return {
    contractVersion: MCP_CONTRACT_VERSION,
    outcome: result.outcome,
    operation: result.operation,
    ...(fields?.plan === undefined ? {} : { plan: fields.plan }),
    ...(fields?.snapshot === undefined ? {} : { snapshot: fields.snapshot }),
    ...(result.error === undefined ? {} : { error: result.error }),
  };
};

const toToolResult = <T>(
  result: ApplicationResult<T>,
  resultFields?: (value: T) => ResultFields,
): CallToolResult => {
  const structuredContent = toEnvelope(result, resultFields);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent),
      },
    ],
    structuredContent,
    ...(result.outcome === 'succeeded' ? {} : { isError: true }),
  };
};

const createRequestRunner = (dependencies: McpServerDependencies) => {
  return async <T>(
    extra: RequestExtra,
    invoke: (
      actor: ActorContext,
      signal: AbortSignal,
    ) => Promise<ApplicationResult<T>>,
    resultFields?: (value: T) => ResultFields,
  ): Promise<CallToolResult> => {
    try {
      return toToolResult(
        await invoke(dependencies.actor, extra.signal),
        resultFields,
      );
    } catch {
      return toToolResult(internalFailureResult(dependencies.operationIds));
    }
  };
};

export const createMcpServer = (
  dependencies: McpServerDependencies,
  serverInfo: McpServerInfo = defaultServerInfo,
): McpServer => {
  const server = new McpServer(serverInfo);
  const run = createRequestRunner(dependencies);

  if (dependencies.actor.scopes.includes('plan:write')) {
    server.registerTool(
      MCP_TOOL_NAMES[0],
      {
        title: 'Create plan view',
        description: 'Create or replace an accepted OpenLearn plan view.',
        inputSchema: createPlanViewInputSchema,
        outputSchema: resultOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
        _meta: {
          securitySchemes: oauth2SecuritySchemes(['plan:write']),
        },
      },
      (input, extra) =>
        run(
          extra,
          (actor, signal) =>
            dependencies.application.createPlanView(
              actor,
              input as CreatePlanViewInput,
              signal,
            ),
          resultFieldsForPlan,
        ),
    );
  }

  if (dependencies.actor.scopes.includes('plan:read')) {
    server.registerTool(
      MCP_TOOL_NAMES[1],
      {
        title: 'Get plan view',
        description: 'Read an authorized accepted OpenLearn plan view.',
        inputSchema: getPlanViewInputSchema,
        outputSchema: resultOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
        _meta: {
          securitySchemes: oauth2SecuritySchemes(['plan:read']),
        },
      },
      (input, extra) =>
        run(
          extra,
          (actor) => dependencies.application.getPlanView(
            actor,
            input as GetPlanViewInput,
          ),
          resultFieldsForView,
        ),
    );
  }

  if (dependencies.actor.scopes.includes('progress:write')) {
    server.registerTool(
      MCP_TOOL_NAMES[2],
      {
        title: 'Apply progress action',
        description: 'Apply a confirmed progress action to an authorized plan.',
        inputSchema: applyProgressActionInputSchema,
        outputSchema: resultOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
        _meta: {
          securitySchemes: oauth2SecuritySchemes(['progress:write']),
        },
      },
      (input, extra) =>
        run(
          extra,
          (actor, signal) =>
            dependencies.application.applyProgressAction(
              actor,
              input as ApplyProgressActionInput,
              signal,
            ),
          resultFieldsForPlan,
        ),
    );
  }

  exposeRootSecuritySchemes(server);
  return server;
};

/**
 * The SDK's Node transport declarations are compiled without exact optional
 * property types, while this workspace enables that stricter mode. Keep the
 * narrow compatibility cast at the SDK boundary instead of leaking it into
 * the service composition code.
 */
export const connectMcpServer = (
  server: McpServer,
  transport: unknown,
): Promise<void> => server.connect(transport as Transport);
