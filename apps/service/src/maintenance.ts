import {
  createPostgresApplicationState,
  createPostgresPool,
  type RetentionSweepResult,
} from '@openlearn/persistence';

export interface MaintenanceResult {
  readonly reconciledOperations: number;
  readonly retention: RetentionSweepResult;
}

const parseLimit = (value: string | undefined): number => {
  const limit = Number(value ?? '100');
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('OPENLEARN_RECONCILIATION_LIMIT must be an integer from 1 to 1000.');
  }
  return limit;
};

export const runMaintenance = async (
  env: Record<string, string | undefined>,
): Promise<MaintenanceResult> => {
  const connectionString = env.OPENLEARN_DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) {
    throw new Error('OPENLEARN_DATABASE_URL is required for maintenance.');
  }
  const environment = env.OPENLEARN_ENVIRONMENT ?? 'local';
  const pool = createPostgresPool({
    connectionString,
    max: 2,
    ...(environment === 'production'
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
  try {
    const state = createPostgresApplicationState({ pool });
    const reconciledOperations = await state.reconcileExpiredOperations(
      parseLimit(env.OPENLEARN_RECONCILIATION_LIMIT),
    );
    const retention = await state.runRetentionSweep();
    return { reconciledOperations, retention };
  } finally {
    await pool.end();
  }
};

if (process.argv[1]?.endsWith('maintenance.js') === true) {
  try {
    const result = await runMaintenance(process.env);
    process.stdout.write(`OpenLearn maintenance completed: ${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `OpenLearn maintenance failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
