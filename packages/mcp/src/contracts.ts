import type {
  ActorClass,
  ActorContext,
  ApplicationResult,
  OperationState,
  OpenLearnApplication,
  OperationIdGenerator,
  PlanView,
  SafeApplicationError,
} from '@openlearn/application';
import { z } from 'zod';

export const MCP_CONTRACT_VERSION = 'openlearn.phase6.v1' as const;

export const MCP_MAX_REQUEST_BYTES = 512 * 1024;
export const MCP_MAX_IDEMPOTENCY_KEY_LENGTH = 128;
export const MCP_MAX_TIMESTAMP_LENGTH = 64;

export const MCP_TOOL_NAMES = [
  'openlearn.create_plan_view',
  'openlearn.get_plan_view',
  'openlearn.apply_progress_action',
] as const;

const identifierSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u);
const boundedIdempotencyKeySchema = z
  .string()
  .min(1)
  .max(MCP_MAX_IDEMPOTENCY_KEY_LENGTH)
  .regex(/^[\x21-\x7e]+$/u);
const boundedTimestampSchema = z
  .string()
  .max(MCP_MAX_TIMESTAMP_LENGTH)
  .datetime({ offset: true });
const candidateSchema = z.union([
  z.null(),
  z.string().max(20_000),
  z.number(),
  z.boolean(),
  z.array(z.unknown()).max(256),
  z.record(z.string().max(128), z.unknown()).refine(
    (value) => Object.keys(value).length <= 256,
    'candidate object has too many keys',
  ),
]);

export const createPlanViewInputSchema = z.strictObject({
  idempotencyKey: boundedIdempotencyKeySchema,
  candidate: candidateSchema,
  acceptedAt: boundedTimestampSchema,
  planId: identifierSchema.optional(),
  expectedRevisionId: identifierSchema.optional(),
});

export const getPlanViewInputSchema = z.strictObject({
  planId: identifierSchema,
});

export const applyProgressActionInputSchema = z.strictObject({
  planId: identifierSchema,
  itemId: identifierSchema,
  action: z.enum(['start_item', 'complete_item', 'undo_completion']),
  expectedRevisionId: identifierSchema,
  expectedProgressVersion: z.number().int().nonnegative(),
  idempotencyKey: boundedIdempotencyKeySchema,
  confirmedAt: boundedTimestampSchema,
});

const operationSchema = {
  operationId: z.string(),
  state: z.enum([
    'received',
    'in_progress',
    'reconciling',
    'succeeded',
    'rejected',
    'failed_retryable',
    'cancelled',
    'expired',
    'conflict',
  ]),
} as const;

export const resultOutputSchema = {
  contractVersion: z.literal(MCP_CONTRACT_VERSION),
  outcome: z.enum([
    'received',
    'in_progress',
    'reconciling',
    'succeeded',
    'rejected',
    'failed_retryable',
    'cancelled',
    'expired',
    'conflict',
  ]),
  operation: z.object(operationSchema),
  plan: z
    .object({
      planId: z.string(),
      revisionId: z.string(),
      revisionNumber: z.number().int().nonnegative(),
      dashboardUrl: z.string(),
    })
    .optional(),
  snapshot: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
} as const;

export interface McpResultEnvelope {
  readonly [key: string]: unknown;
  readonly contractVersion: typeof MCP_CONTRACT_VERSION;
  readonly outcome: OperationState;
  readonly operation: {
    readonly operationId: string;
    readonly state: OperationState;
  };
  readonly plan?: {
    readonly planId: string;
    readonly revisionId: string;
    readonly revisionNumber: number;
    readonly dashboardUrl: string;
  };
  readonly snapshot?: Omit<PlanView, 'dashboardUrl'>;
  readonly error?: SafeApplicationError;
}

export interface McpServerDependencies {
  readonly application: OpenLearnApplication;
  readonly actor: ActorContext;
  readonly operationIds: Pick<OperationIdGenerator, 'next'>;
}

export interface McpServerInfo {
  readonly name: string;
  readonly version: string;
}
