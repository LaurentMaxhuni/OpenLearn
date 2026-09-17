import test from 'node:test';
import assert from 'node:assert/strict';
import type { OperationReservationInput } from '@openlearn/application';
import type { SqlPool, SqlResult, SqlRow } from '../src/index.js';
import { createPostgresApplicationState } from '../src/index.js';

const input: OperationReservationInput = {
  operationId: 'operation-retry',
  kind: 'apply_progress_action',
  ownerId: 'owner-1' as OperationReservationInput['ownerId'],
  capability: 'progress:write',
  idempotencyKey: 'key-1',
  requestFingerprint: 'fingerprint-a',
  startedAt: '2030-01-06T03:04:00.000Z',
  deadlineAt: '2030-01-06T03:04:30.000Z',
  leaseExpiresAt: '2030-01-06T03:04:40.000Z',
};

const operationRow = {
  operation_id: input.operationId,
  kind: input.kind,
  owner_id: input.ownerId,
  capability: input.capability,
  idempotency_key: input.idempotencyKey,
  request_fingerprint: input.requestFingerprint,
  state: 'received',
  started_at: input.startedAt,
  deadline_at: input.deadlineAt,
  lease_expires_at: input.leaseExpiresAt,
  fencing_version: 0,
  outcome: null,
};

for (const fingerprint of ['fingerprint-a', 'fingerprint-changed']) {
  test(`retained marker prevents reserving a new mutation for ${fingerprint}`, async () => {
    let insertCount = 0;
    const marker = {
      ...operationRow,
      operation_id: 'operation-original',
      state: null,
      outcome: { state: 'succeeded' },
    };
    const pool: SqlPool = {
      async query<Row extends SqlRow = SqlRow>(text: string): Promise<SqlResult<Row>> {
        let rows: SqlRow[] = [];
        if (text.includes('FROM openlearn_mutation_markers WHERE owner_id')) {
          rows = [marker];
        } else if (text.startsWith('INSERT INTO openlearn_operations')) {
          insertCount += 1;
          rows = [operationRow];
        }
        return { rows: rows as Row[], rowCount: rows.length };
      },
      async connect() {
        throw new Error('Reservation should not run a mutation.');
      },
      async end() {},
    };
    const state = createPostgresApplicationState({ pool });
    const reservation = await state.reserveOperation({
      ...input,
      requestFingerprint: fingerprint,
    });

    assert.equal(reservation.kind, 'existing');
    assert.equal(reservation.operation.operationId, 'operation-original');
    assert.equal(reservation.operation.requestFingerprint, 'fingerprint-a');
    assert.equal(reservation.operation.state, 'succeeded');
    assert.deepEqual(reservation.operation.outcome, { state: 'succeeded' });
    assert.equal(insertCount, 0);
  });
}
