import {
  APPLICATION_OPERATION_STATES,
  CAPABILITY_SCOPES,
  type ApplicationStatePort,
  type ApplicationTransaction,
  type MutationCommit,
  type MutationReference,
  type OperationKind,
  type OperationRecord,
  type OperationReservation,
  type OperationReservationInput,
  type PersonalizationStatePort,
  type PersonalizationWriteResult,
  type StoredOperationOutcome,
} from '@openlearn/application';
import type { Clock } from '@openlearn/application';
import type {
  InternalOwnerId,
  PersonalizationState,
  PlanAggregate,
  PlanId,
} from '@openlearn/domain';
import type { SqlClient, SqlConnection, SqlPool, SqlResult, SqlRow } from './sql.js';

const TERMINAL_STATES = new Set<string>(
  APPLICATION_OPERATION_STATES.filter(
    (state) => !['received', 'in_progress', 'reconciling'].includes(state),
  ),
);
const OPERATION_KINDS = new Set<OperationKind>([
  'create_plan_view',
  'replace_plan_view',
  'apply_progress_action',
  'delete_plan',
]);
const CAPABILITIES = new Set<string>(CAPABILITY_SCOPES);
const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_FIVE_DAYS_MS = 35 * DAY_MS;

export class PersistenceDataError extends Error {
  public override readonly name = 'PersistenceDataError';
}

export class PersistenceConcurrencyError extends Error {
  public override readonly name = 'PersistenceConcurrencyError';
}

export interface PostgresStateOptions {
  readonly pool: SqlPool;
  readonly clock?: Clock;
}

export interface RetentionSweepResult {
  readonly deletedPlans: number;
  readonly deletedOperations: number;
  readonly deletedMarkers: number;
  readonly deletedTombstones: number;
}

export interface PostgresApplicationState
  extends ApplicationStatePort,
    PersonalizationStatePort {
  readonly listPlansByOwner: (
    ownerId: InternalOwnerId,
  ) => Promise<readonly PlanAggregate[]>;
  readonly ping: () => Promise<boolean>;
  readonly reconcileExpiredOperations: (limit?: number) => Promise<number>;
  readonly runRetentionSweep: (now?: Date) => Promise<RetentionSweepResult>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PersistenceDataError(`Stored ${field} is invalid.`);
  }
  return value;
};

const requiredNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PersistenceDataError(`Stored ${field} is invalid.`);
  }
  return value;
};

const jsonValue = (value: unknown, field: string): unknown => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new PersistenceDataError(`Stored ${field} is not valid JSON.`);
    }
  }
  return value;
};

const requiredJsonRecord = (value: unknown, field: string): Record<string, unknown> => {
  const parsed = jsonValue(value, field);
  if (!isRecord(parsed)) {
    throw new PersistenceDataError(`Stored ${field} is not an object.`);
  }
  return parsed;
};

const timestamp = (value: unknown, field: string): string => {
  const date = value instanceof Date
    ? value
    : typeof value === 'string'
      ? new Date(value)
      : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new PersistenceDataError(`Stored ${field} is not a timestamp.`);
  }
  return date.toISOString();
};

const optionalTimestamp = (value: unknown, field: string): string | undefined =>
  value === null || value === undefined ? undefined : timestamp(value, field);

const encodeJson = (value: unknown, field: string): string => {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new TypeError();
    }
    return encoded;
  } catch {
    throw new PersistenceDataError(`${field} cannot be serialized.`);
  }
};

const isPlanAggregate = (value: unknown): value is PlanAggregate => {
  if (!isRecord(value)) return false;
  if (typeof value.ownerId !== 'string' || typeof value.planId !== 'string') return false;
  if (!Array.isArray(value.progress)) return false;
  if (value.lifecycle === 'active') {
    return isRecord(value.currentRevision) && isRecord(value.content);
  }
  return value.lifecycle === 'deleted' && isRecord(value.tombstone);
};

const decodePlan = (value: unknown): PlanAggregate => {
  const parsed = jsonValue(value, 'plan aggregate');
  if (!isPlanAggregate(parsed)) {
    throw new PersistenceDataError('Stored plan aggregate is invalid.');
  }
  return parsed;
};

const decodeOutcome = (value: unknown): StoredOperationOutcome => {
  const parsed = requiredJsonRecord(value, 'operation outcome');
  const state = requiredString(parsed.state, 'operation outcome state');
  if (!TERMINAL_STATES.has(state)) {
    throw new PersistenceDataError('Stored operation outcome state is invalid.');
  }
  return parsed as unknown as StoredOperationOutcome;
};

const decodeOptionalOutcome = (value: unknown): StoredOperationOutcome | undefined =>
  value === null || value === undefined ? undefined : decodeOutcome(value);

const operationFromRow = (row: SqlRow): OperationRecord => {
  const kind = requiredString(row.kind, 'operation kind');
  const capability = requiredString(row.capability, 'operation capability');
  const state = requiredString(row.state, 'operation state');
  if (!OPERATION_KINDS.has(kind as OperationKind) || !CAPABILITIES.has(capability)) {
    throw new PersistenceDataError('Stored operation contract is invalid.');
  }
  if (!APPLICATION_OPERATION_STATES.includes(state as (typeof APPLICATION_OPERATION_STATES)[number])) {
    throw new PersistenceDataError('Stored operation state is invalid.');
  }
  const outcome = decodeOptionalOutcome(row.outcome);
  return {
    operationId: requiredString(row.operation_id, 'operation id'),
    kind: kind as OperationKind,
    ownerId: requiredString(row.owner_id, 'operation owner') as InternalOwnerId,
    capability: capability as OperationRecord['capability'],
    idempotencyKey: requiredString(row.idempotency_key, 'idempotency key'),
    requestFingerprint: requiredString(row.request_fingerprint, 'request fingerprint'),
    state: state as OperationRecord['state'],
    startedAt: timestamp(row.started_at, 'operation started_at'),
    deadlineAt: timestamp(row.deadline_at, 'operation deadline_at'),
    leaseExpiresAt: timestamp(row.lease_expires_at, 'operation lease_expires_at'),
    fencingVersion: requiredNumber(row.fencing_version, 'operation fencing_version'),
    ...(outcome === undefined ? {} : { outcome }),
  };
};

const referenceFromRow = (row: SqlRow): MutationReference => ({
  operationId: requiredString(row.operation_id, 'mutation marker operation id'),
  ownerId: requiredString(row.owner_id, 'mutation marker owner') as InternalOwnerId,
  capability: requiredString(row.capability, 'mutation marker capability') as MutationReference['capability'],
  requestFingerprint: requiredString(row.request_fingerprint, 'mutation marker fingerprint'),
  outcome: decodeOutcome(row.outcome),
});

const count = (result: SqlResult): number => result.rowCount ?? result.rows.length;

const currentTime = (clock: Clock | undefined): Date => clock?.now() ?? new Date();

const operationKeyWhere = `owner_id = $1 AND capability = $2 AND idempotency_key = $3`;

const minimalOutcome = (outcome: StoredOperationOutcome): StoredOperationOutcome => {
  const { snapshot: _snapshot, ...withoutSnapshot } = outcome;
  return withoutSnapshot;
};

const planColumns = (plan: PlanAggregate, now: string) =>
  plan.lifecycle === 'active'
    ? {
        lifecycle: plan.lifecycle,
        currentRevisionId: plan.currentRevision.revisionId,
        currentRevisionNumber: plan.currentRevision.revisionNumber,
        acceptedAt: plan.currentRevision.acceptedAt,
        deletedAt: null,
        aggregate: encodeJson(plan, 'plan aggregate'),
        ownerId: plan.ownerId,
        planId: plan.planId,
        now,
      }
    : {
        lifecycle: plan.lifecycle,
        currentRevisionId: null,
        currentRevisionNumber: null,
        acceptedAt: null,
        deletedAt: plan.tombstone.deletedAt,
        aggregate: encodeJson(plan, 'plan tombstone aggregate'),
        ownerId: plan.ownerId,
        planId: plan.planId,
        now,
      };

const upsertPlan = async (
  connection: SqlClient,
  plan: PlanAggregate,
  now: string,
): Promise<void> => {
  const columns = planColumns(plan, now);
  await connection.query(
    `INSERT INTO openlearn_plans
      (plan_id, owner_id, lifecycle, current_revision_id, current_revision_number, accepted_at, aggregate, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     ON CONFLICT (plan_id) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       lifecycle = EXCLUDED.lifecycle,
       current_revision_id = EXCLUDED.current_revision_id,
       current_revision_number = EXCLUDED.current_revision_number,
       accepted_at = EXCLUDED.accepted_at,
       aggregate = EXCLUDED.aggregate,
       updated_at = EXCLUDED.updated_at,
       deleted_at = EXCLUDED.deleted_at`,
    [
      columns.planId,
      columns.ownerId,
      columns.lifecycle,
      columns.currentRevisionId,
      columns.currentRevisionNumber,
      columns.acceptedAt,
      columns.aggregate,
      now,
      columns.now,
      columns.deletedAt,
    ],
  );
  if (plan.lifecycle === 'deleted') {
    await connection.query(
      `INSERT INTO openlearn_plan_tombstones
        (plan_id, owner_id, deleted_at, terminal_revision, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (plan_id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         deleted_at = EXCLUDED.deleted_at,
         terminal_revision = EXCLUDED.terminal_revision,
         expires_at = EXCLUDED.expires_at`,
      [
        plan.planId,
        plan.ownerId,
        plan.tombstone.deletedAt,
        encodeJson(plan.tombstone.terminalRevision, 'terminal revision'),
        new Date(Date.parse(plan.tombstone.deletedAt) + THIRTY_FIVE_DAYS_MS).toISOString(),
      ],
    );
  }
};

const markerOutcome = (outcome: StoredOperationOutcome): string =>
  encodeJson(minimalOutcome(outcome), 'mutation outcome');

export const createPostgresApplicationState = (
  options: PostgresStateOptions,
): PostgresApplicationState => {
  const { pool, clock } = options;

  const readPlan = async (planId: PlanId): Promise<PlanAggregate | undefined> => {
    const result = await pool.query(
      'SELECT aggregate FROM openlearn_plans WHERE plan_id = $1',
      [planId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : decodePlan(row.aggregate);
  };

  const listPlansByOwner = async (
    ownerId: InternalOwnerId,
  ): Promise<readonly PlanAggregate[]> => {
    const result = await pool.query(
      `SELECT aggregate FROM openlearn_plans
       WHERE owner_id = $1 AND lifecycle = 'active'
       ORDER BY updated_at DESC, plan_id ASC`,
      [ownerId],
    );
    return result.rows.map((row) => decodePlan(row.aggregate));
  };

  const findRetainedOperation = async (
    input: OperationReservationInput,
  ): Promise<OperationRecord | undefined> => {
    const marker = await pool.query(
      `SELECT operation_id, operation_kind AS kind, owner_id, capability, idempotency_key, request_fingerprint,
              outcome, created_at AS started_at, created_at AS deadline_at, created_at AS lease_expires_at,
              0 AS fencing_version, NULL AS state
       FROM openlearn_mutation_markers WHERE ${operationKeyWhere}`,
      [input.ownerId, input.capability, input.idempotencyKey],
    );
    const row = marker.rows[0];
    if (row === undefined) return undefined;
    const reference = referenceFromRow(row);
    return operationFromRow({ ...row, state: reference.outcome.state });
  };

  const reserveOperation = async (
    input: OperationReservationInput,
  ): Promise<OperationReservation> => {
    const retained = await findRetainedOperation(input);
    if (retained !== undefined) {
      return { kind: 'existing', operation: retained };
    }
    const now = currentTime(clock).toISOString();
    const inserted = await pool.query(
      `INSERT INTO openlearn_operations
        (operation_id, kind, owner_id, capability, idempotency_key, request_fingerprint, state, started_at, deadline_at, lease_expires_at, fencing_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'received', $7, $8, $9, 0, $10)
       ON CONFLICT (owner_id, capability, idempotency_key) DO NOTHING
       RETURNING operation_id, kind, owner_id, capability, idempotency_key, request_fingerprint, state, started_at, deadline_at, lease_expires_at, fencing_version, outcome`,
      [
        input.operationId,
        input.kind,
        input.ownerId,
        input.capability,
        input.idempotencyKey,
        input.requestFingerprint,
        input.startedAt,
        input.deadlineAt,
        input.leaseExpiresAt,
        now,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow !== undefined) {
      return { kind: 'created', operation: operationFromRow(insertedRow) };
    }

    const existing = await pool.query(
      `SELECT operation_id, kind, owner_id, capability, idempotency_key, request_fingerprint, state, started_at, deadline_at, lease_expires_at, fencing_version, outcome
       FROM openlearn_operations WHERE ${operationKeyWhere}`,
      [input.ownerId, input.capability, input.idempotencyKey],
    );
    const existingRow = existing.rows[0];
    if (existingRow !== undefined) {
      return { kind: 'existing', operation: operationFromRow(existingRow) };
    }

    const retainedAfterInsert = await findRetainedOperation(input);
    if (retainedAfterInsert !== undefined) {
      return { kind: 'existing', operation: retainedAfterInsert };
    }
    throw new PersistenceConcurrencyError('Operation reservation disappeared during insert.');
  };

  const runMutation = async (
    operation: OperationRecord,
    work: (transaction: ApplicationTransaction) => Promise<MutationCommit>,
  ): Promise<MutationCommit> => {
    const connection = await pool.connect();
    let committed = false;
    try {
      await connection.query('BEGIN');
      const locked = await connection.query(
        `SELECT operation_id, kind, owner_id, capability, idempotency_key, request_fingerprint, state, started_at, deadline_at, lease_expires_at, fencing_version, outcome
         FROM openlearn_operations WHERE operation_id = $1 FOR UPDATE`,
        [operation.operationId],
      );
      const row = locked.rows[0];
      if (row === undefined) {
        throw new PersistenceConcurrencyError('Operation is no longer available.');
      }
      const stored = operationFromRow(row);
      if (
        stored.ownerId !== operation.ownerId ||
        stored.capability !== operation.capability ||
        stored.requestFingerprint !== operation.requestFingerprint ||
        stored.fencingVersion !== operation.fencingVersion
      ) {
        throw new PersistenceConcurrencyError('Operation fencing check failed.');
      }
      if (stored.outcome !== undefined && TERMINAL_STATES.has(stored.state)) {
        const reference = await findMutationReferenceWithin(connection, stored.operationId);
        if (reference === undefined) {
          throw new PersistenceConcurrencyError('Terminal operation has no mutation marker.');
        }
        await connection.query('COMMIT');
        committed = true;
        return { outcome: reference.outcome, reference: reference };
      }

      let pendingPlan: PlanAggregate | undefined;
      let mutationResult: MutationCommit | undefined;
      let commitCalled = false;
      const transaction: ApplicationTransaction = {
        readPlan: async (planId) => {
          if (pendingPlan?.planId === planId) return pendingPlan;
          const result = await connection.query(
            'SELECT aggregate FROM openlearn_plans WHERE plan_id = $1 FOR UPDATE',
            [planId],
          );
          const planRow = result.rows[0];
          return planRow === undefined ? undefined : decodePlan(planRow.aggregate);
        },
        writePlan: async (plan) => {
          if (plan.ownerId !== operation.ownerId) {
            throw new PersistenceConcurrencyError('Plan owner does not match operation owner.');
          }
          pendingPlan = plan;
        },
        commitMutation: async (outcome) => {
          if (commitCalled) {
            throw new PersistenceConcurrencyError('Mutation was committed more than once.');
          }
          commitCalled = true;
          if (!TERMINAL_STATES.has(outcome.state)) {
            throw new PersistenceConcurrencyError('Mutation outcome must be terminal.');
          }
          const now = currentTime(clock).toISOString();
          if (pendingPlan !== undefined) {
            await upsertPlan(connection, pendingPlan, now);
          }
          const storedOutcome = minimalOutcome(outcome);
          const marker = await connection.query(
            `INSERT INTO openlearn_mutation_markers
              (operation_id, operation_kind, owner_id, capability, idempotency_key, request_fingerprint, outcome, plan_id, expires_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NULL, $9)
             ON CONFLICT (owner_id, capability, idempotency_key) DO UPDATE SET
               outcome = EXCLUDED.outcome
             WHERE openlearn_mutation_markers.operation_id = EXCLUDED.operation_id
               AND openlearn_mutation_markers.request_fingerprint = EXCLUDED.request_fingerprint
             RETURNING operation_id`,
            [
              operation.operationId,
              operation.kind,
              operation.ownerId,
              operation.capability,
              operation.idempotencyKey,
              operation.requestFingerprint,
              markerOutcome(storedOutcome),
              storedOutcome.planId ?? pendingPlan?.planId ?? null,
              now,
            ],
          );
          if (count(marker) === 0) {
            throw new PersistenceConcurrencyError('Mutation marker fingerprint conflict.');
          }
          const updated = await connection.query(
            `UPDATE openlearn_operations
             SET state = $2, outcome = $3::jsonb, updated_at = $4
             WHERE operation_id = $1 AND fencing_version = $5`,
            [
              operation.operationId,
              storedOutcome.state,
              markerOutcome(storedOutcome),
              now,
              operation.fencingVersion,
            ],
          );
          if (count(updated) !== 1) {
            throw new PersistenceConcurrencyError('Operation fencing update failed.');
          }
          const reference: MutationReference = {
            operationId: operation.operationId,
            ownerId: operation.ownerId,
            capability: operation.capability,
            requestFingerprint: operation.requestFingerprint,
            outcome: storedOutcome,
          };
          mutationResult = {
            ...(pendingPlan === undefined ? {} : { plan: pendingPlan }),
            outcome: storedOutcome,
            reference,
          };
          return mutationResult;
        },
      };

      const result = await work(transaction);
      if (!commitCalled || mutationResult === undefined) {
        throw new PersistenceConcurrencyError('Mutation work did not commit an outcome.');
      }
      await connection.query('COMMIT');
      committed = true;
      return result;
    } catch (error) {
      if (!committed) {
        try {
          await connection.query('ROLLBACK');
        } catch {
          // Preserve the application error; a later retry can reconcile it.
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  };

  const findMutationReference = async (
    operationId: string,
  ): Promise<MutationReference | undefined> => {
    const result = await pool.query(
      `SELECT operation_id, owner_id, capability, request_fingerprint, outcome
       FROM openlearn_mutation_markers WHERE operation_id = $1`,
      [operationId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : referenceFromRow(row);
  };

  const readPersonalization = async (
    ownerId: InternalOwnerId,
    planId: PlanId,
  ): Promise<PersonalizationState | undefined> => {
    const result = await pool.query(
      'SELECT state FROM openlearn_personalization WHERE owner_id = $1 AND plan_id = $2',
      [ownerId, planId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return requiredJsonRecord(row.state, 'personalization state') as unknown as PersonalizationState;
  };

  const writePersonalization = async (
    state: PersonalizationState,
    expectedStateVersion: number,
  ): Promise<PersonalizationWriteResult> => {
    try {
      const now = currentTime(clock).toISOString();
      const result = await pool.query(
        `INSERT INTO openlearn_personalization
          (owner_id, plan_id, state_version, state, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (owner_id, plan_id) DO UPDATE SET
           state_version = EXCLUDED.state_version,
           state = EXCLUDED.state,
           updated_at = EXCLUDED.updated_at
         WHERE openlearn_personalization.state_version = $6`,
        [
          state.ownerId,
          state.planId,
          state.stateVersion,
          encodeJson(state, 'personalization state'),
          now,
          expectedStateVersion,
        ],
      );
      return count(result) === 1 ? { ok: true } : { ok: false, kind: 'conflict' };
    } catch {
      return { ok: false, kind: 'unavailable' };
    }
  };

  const purgePersonalization = async (
    ownerId: InternalOwnerId,
    planId: PlanId,
    expectedStateVersion?: number,
  ): Promise<PersonalizationWriteResult> => {
    try {
      const result = await pool.query(
        `DELETE FROM openlearn_personalization
         WHERE owner_id = $1 AND plan_id = $2
           AND ($3::integer IS NULL OR state_version = $3)`,
        [ownerId, planId, expectedStateVersion ?? null],
      );
      return count(result) === 1 || expectedStateVersion === undefined
        ? { ok: true }
        : { ok: false, kind: 'conflict' };
    } catch {
      return { ok: false, kind: 'unavailable' };
    }
  };

  const ping = async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  const reconcileExpiredOperations = async (limit = 100): Promise<number> => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RangeError('Reconciliation limit must be between 1 and 1000.');
    }
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const now = currentTime(clock).toISOString();
      const candidates = await connection.query(
        `SELECT operation_id, kind, owner_id, capability, idempotency_key, request_fingerprint,
                state, started_at, deadline_at, lease_expires_at, fencing_version, outcome
         FROM openlearn_operations
         WHERE state IN ('in_progress', 'reconciling') AND lease_expires_at <= $1
         ORDER BY lease_expires_at ASC
         LIMIT $2 FOR UPDATE SKIP LOCKED`,
        [now, limit],
      );
      let reconciled = 0;
      for (const row of candidates.rows) {
        const operation = operationFromRow(row);
        const reference = await findMutationReferenceWithin(connection, operation.operationId);
        const outcome: StoredOperationOutcome = reference?.outcome ?? {
          state: 'expired',
          error: {
            code: 'operation_expired',
            message: 'The operation expired before a committed result was found.',
            retryable: true,
          },
        };
        const updated = await connection.query(
          `UPDATE openlearn_operations
           SET state = $2, outcome = $3::jsonb, fencing_version = fencing_version + 1, updated_at = $4
           WHERE operation_id = $1 AND state IN ('in_progress', 'reconciling') AND fencing_version = $5`,
          [operation.operationId, outcome.state, markerOutcome(outcome), now, operation.fencingVersion],
        );
        if (count(updated) !== 1) continue;
        if (reference === undefined) {
          await connection.query(
            `INSERT INTO openlearn_mutation_markers
              (operation_id, operation_kind, owner_id, capability, idempotency_key, request_fingerprint, outcome, plan_id, expires_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL, NULL, $8)
             ON CONFLICT (owner_id, capability, idempotency_key) DO NOTHING`,
            [
              operation.operationId,
              operation.kind,
              operation.ownerId,
              operation.capability,
              operation.idempotencyKey,
              operation.requestFingerprint,
              markerOutcome(outcome),
              now,
            ],
          );
        }
        reconciled += 1;
      }
      await connection.query('COMMIT');
      return reconciled;
    } catch (error) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }
      throw error;
    } finally {
      connection.release();
    }
  };

  const runRetentionSweep = async (now = currentTime(clock)): Promise<RetentionSweepResult> => {
    const planCutoff = new Date(now.getTime() - DAY_MS).toISOString();
    const operationCutoff = planCutoff;
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const plans = await connection.query(
        `DELETE FROM openlearn_plans
         WHERE lifecycle = 'deleted' AND deleted_at <= $1`,
        [planCutoff],
      );
      const operations = await connection.query(
        `DELETE FROM openlearn_operations
         WHERE state NOT IN ('received', 'in_progress', 'reconciling') AND updated_at <= $1`,
        [operationCutoff],
      );
      const markers = await connection.query(
        `DELETE FROM openlearn_mutation_markers
         WHERE expires_at IS NOT NULL AND expires_at <= $1`,
        [now.toISOString()],
      );
      const tombstones = await connection.query(
        'DELETE FROM openlearn_plan_tombstones WHERE expires_at <= $1',
        [now.toISOString()],
      );
      await connection.query('COMMIT');
      return {
        deletedPlans: count(plans),
        deletedOperations: count(operations),
        deletedMarkers: count(markers),
        deletedTombstones: count(tombstones),
      };
    } catch (error) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }
      throw error;
    } finally {
      connection.release();
    }
  };

  return {
    readPlan,
    listPlansByOwner,
    reserveOperation,
    runMutation,
    findMutationReference,
    readPersonalization,
    writePersonalization,
    purgePersonalization,
    ping,
    reconcileExpiredOperations,
    runRetentionSweep,
  };
};

const findMutationReferenceWithin = async (
  connection: SqlConnection,
  operationId: string,
): Promise<MutationReference | undefined> => {
  const result = await connection.query(
    `SELECT operation_id, owner_id, capability, request_fingerprint, outcome
     FROM openlearn_mutation_markers WHERE operation_id = $1`,
    [operationId],
  );
  const row = result.rows[0];
  return row === undefined ? undefined : referenceFromRow(row);
};
