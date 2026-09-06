import { Pool, type PoolConfig } from 'pg';
import type { SqlConnection, SqlPool, SqlResult, SqlRow } from './sql.js';

const adaptClient = (client: {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release?(): void;
}): SqlConnection => ({
  query: async <Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>> =>
    (await client.query(text, values === undefined ? [] : [...values])) as SqlResult<Row>,
  release: () => client.release?.(),
});

/** Create the only production PostgreSQL client used by OpenLearn. */
export const createPostgresPool = (config: PoolConfig): SqlPool => {
  const pool = new Pool(config);
  return {
    query: async <Row extends SqlRow = SqlRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<SqlResult<Row>> =>
      (await pool.query(text, values === undefined ? [] : [...values])) as SqlResult<Row>,
    connect: async () => adaptClient(await pool.connect()),
    end: () => pool.end(),
  };
};
