import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlConnection, SqlPool, SqlResult, SqlRow } from '../src/index.js';
import { MIGRATIONS, runMigrations } from '../src/index.js';

const result = <Row extends SqlRow = SqlRow>(
  rows: readonly Row[] = [],
): SqlResult<Row> => ({ rows, rowCount: rows.length });

const fakePool = (): SqlPool & { readonly statements: string[] } => {
  const statements: string[] = [];
  let applied: { version: number }[] = [];
  const connection: SqlConnection = {
    async query<Row extends SqlRow = SqlRow>(text: string): Promise<SqlResult<Row>> {
      statements.push(text);
      if (text.includes('SELECT version FROM')) return result(applied as unknown as Row[]);
      if (text.startsWith('INSERT INTO openlearn_schema_migrations')) {
        applied = [...applied, { version: 1 }];
      }
      return result();
    },
    release() {},
  };
  return {
    statements,
    async query<Row extends SqlRow = SqlRow>(text: string): Promise<SqlResult<Row>> {
      statements.push(text);
      if (text.includes('SELECT version FROM')) return result(applied as unknown as Row[]);
      return result();
    },
    async connect() {
      return connection;
    },
    async end() {},
  };
};

test('runs each reviewed migration once and records its version transactionally', async () => {
  const pool = fakePool();
  const first = await runMigrations(pool);
  const second = await runMigrations(pool);

  assert.deepEqual(first.applied, [1]);
  assert.deepEqual(second.applied, []);
  assert.equal(MIGRATIONS.length, 1);
  assert.match(MIGRATIONS[0]?.sql ?? '', /openlearn_mutation_markers/);
  assert.ok(pool.statements.includes('BEGIN'));
  assert.ok(pool.statements.includes('COMMIT'));
});
