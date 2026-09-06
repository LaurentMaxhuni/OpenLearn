import { createPostgresPool, runMigrations } from '@openlearn/persistence';

export const runDatabaseMigrations = async (
  env: Record<string, string | undefined>,
): Promise<readonly number[]> => {
  const connectionString = env.OPENLEARN_DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) {
    throw new Error('OPENLEARN_DATABASE_URL is required for migrations.');
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
    const result = await runMigrations(pool);
    return result.applied;
  } finally {
    await pool.end();
  }
};

if (process.argv[1]?.endsWith('migrate.js') === true) {
  try {
    const applied = await runDatabaseMigrations(process.env);
    process.stdout.write(`OpenLearn migrations applied: ${JSON.stringify(applied)}\n`);
  } catch (error) {
    process.stderr.write(
      `OpenLearn migrations failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
