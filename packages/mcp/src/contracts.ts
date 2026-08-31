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

export const MCP_TOOL_NAMES = [
  'openlearn.create_plan_view',
  'openlearn.get_plan_view',
  'openlearn.apply_progress_action',
] as const;

const identifierSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u);
const candidateSchema = z.union([
  z.null(),
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

export const createPlanViewInputSchema = z.strictObject({
  idempotencyKey: z.string().min(1),
  candidate: candidateSchema,
  acceptedAt: z.string().datetime({ offset: true }),
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
  idempotencyKey: z.string().min(1),
  confirmedAt: z.string().datetime({ offset: true }),
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
