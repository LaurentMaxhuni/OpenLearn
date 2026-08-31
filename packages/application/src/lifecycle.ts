import type {
  ActorContext,
  ApplicationResult,
  CapabilityScope,
  MutationCommit,
  OperationKind,
  OperationRecord,
  OperationReservationInput,
  OperationState,
  SafeApplicationError,
  StoredOperationOutcome,
} from './contracts.js';
import type {
  ApplicationStatePort,
  Clock,
  OperationIdGenerator,
  TelemetrySink,
} from './ports.js';
import type { ApplicationTransaction } from './transactions.js';
import { applicationFailure } from './errors.js';

export const REQUEST_DEADLINE_MS = 30_000;
export const RECOVERY_LEASE_GRACE_MS = 10_000;

export interface LifecycleDependencies {
  readonly state: ApplicationStatePort;
  readonly clock: Clock;
  readonly operationIds: OperationIdGenerator;
  readonly telemetry?: TelemetrySink;
}

export interface MutationExecution<T> {
  readonly value?: T;
  readonly outcome: StoredOperationOutcome;
}

export interface MutationRequest<T> {
  readonly actor: ActorContext;
  readonly kind: OperationKind;
  readonly capability: CapabilityScope;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly signal?: AbortSignal;
  readonly execute: (
    transaction: ApplicationTransaction,
    operation: OperationRecord,
  ) => Promise<MutationExecution<T>>;
  readonly replay?: (outcome: StoredOperationOutcome) => T | undefined;
}

const terminalError = (
  state: Exclude<OperationState, 'received' | 'in_progress' | 'reconciling'>,
): SafeApplicationError => {
  switch (state) {
    case 'conflict':
      return {
        code: 'mutation_replay_conflict',
        message: 'The request conflicts with an existing operation.',
        retryable: false,
      };
    case 'cancelled':
      return {
        code: 'operation_cancelled',
        message: 'The operation was cancelled before it was committed.',
        retryable: true,
      };
    case 'expired':
      return {
        code: 'operation_expired',
        message: 'The operation expired before a committed result was found.',
        retryable: true,
      };
    case 'failed_retryable':
      return {
        code: 'internal_failure',
        message: 'The operation failed before it was committed and may be retried.',
        retryable: true,
      };
    case 'rejected':
      return {
        code: 'domain_rejected',
        message: 'The operation was rejected without changing accepted state.',
        retryable: false,
      };
    case 'succeeded':
      return {
        code: 'internal_failure',
        message: 'The operation succeeded.',
        retryable: false,
      };
  }
};

const operationView = (
  operation: OperationRecord,
  state: OperationState = operation.state,
) => ({
  operationId: operation.operationId,
  state,
});

const resultFromOutcome = <T>(
  operationId: string,
  outcome: StoredOperationOutcome,
  replay?: (outcome: StoredOperationOutcome) => T | undefined,
  value?: T,
): ApplicationResult<T> => {
  const operation = { operationId, state: outcome.state };
  if (outcome.state === 'succeeded') {
    const replayed = value ?? replay?.(outcome);
    return replayed === undefined
      ? { outcome: 'succeeded', operation }
      : { outcome: 'succeeded', operation, value: replayed };
  }

  return applicationFailure(
    operation,
    outcome.error ?? terminalError(outcome.state),
  );
};

const resultFromExistingOperation = <T>(
  operation: OperationRecord,
  replay?: (outcome: StoredOperationOutcome) => T | undefined,
): ApplicationResult<T> => {
  if (operation.outcome !== undefined) {
    return resultFromOutcome(operation.operationId, operation.outcome, replay);
  }

  if (operation.state === 'succeeded') {
    return {
      outcome: 'succeeded',
      operation: operationView(operation),
    };
  }

  if (
    operation.state === 'received' ||
    operation.state === 'in_progress' ||
    operation.state === 'reconciling'
  ) {
    return applicationFailure(
      operationView(operation),
      {
        code: 'operation_in_progress',
        message: 'The operation is still being reconciled.',
        retryable: true,
      },
    );
  }

  return applicationFailure(
    operationView(operation),
    terminalError(operation.state),
  );
};

const activeOperation = (operation: OperationRecord): OperationRecord => ({
  ...operation,
  state: 'in_progress',
});

const recoveryOperation = (operation: OperationRecord): OperationRecord => ({
  ...operation,
  state: 'reconciling',
  fencingVersion: operation.fencingVersion + 1,
});

const isLeaseExpired = (operation: OperationRecord, now: Date): boolean =>
  now.getTime() >= Date.parse(operation.leaseExpiresAt);

const recordTelemetry = (
  dependencies: LifecycleDependencies,
  request: MutationRequest<unknown>,
  operationId: string,
  transition: OperationState,
): void => {
  if (dependencies.telemetry === undefined) {
    return;
  }
  void Promise.resolve(
    dependencies.telemetry.record({
      operationId,
      capability: request.capability,
      actorClass: request.actor.actorClass,
      transition,
    }),
  ).catch(() => undefined);
};

const commitWithoutWork = async <T>(
  dependencies: LifecycleDependencies,
  operation: OperationRecord,
  outcome: StoredOperationOutcome,
  replay: ((outcome: StoredOperationOutcome) => T | undefined) | undefined,
): Promise<ApplicationResult<T>> => {
  const committed = await dependencies.state.runMutation(
    operation,
    (transaction) => transaction.commitMutation(outcome),
  );
  recordTelemetry(dependencies, {
    actor: {
      ownerId: operation.ownerId,
      scopes: [operation.capability],
      actorClass: 'local_stdio',
    },
    kind: operation.kind,
    capability: operation.capability,
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    execute: async () => ({ outcome }),
  }, operation.operationId, committed.outcome.state);
  return resultFromOutcome(operation.operationId, committed.outcome, replay);
};

export const executeMutation = async <T>(
  dependencies: LifecycleDependencies,
  request: MutationRequest<T>,
): Promise<ApplicationResult<T>> => {
  const operationId = dependencies.operationIds.next();
  if (request.idempotencyKey.trim().length === 0) {
    return applicationFailure(
      { operationId, state: 'rejected' },
      {
        code: 'missing_idempotency_key',
        message: 'Mutations require an idempotency key.',
        retryable: false,
      },
    );
  }

  const startedAt = dependencies.clock.now();
  const reservationInput: OperationReservationInput = {
    operationId,
    kind: request.kind,
    ownerId: request.actor.ownerId,
    capability: request.capability,
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: request.requestFingerprint,
    startedAt: startedAt.toISOString(),
    deadlineAt: new Date(startedAt.getTime() + REQUEST_DEADLINE_MS).toISOString(),
    leaseExpiresAt: new Date(
      startedAt.getTime() + REQUEST_DEADLINE_MS + RECOVERY_LEASE_GRACE_MS,
    ).toISOString(),
  };
  const reservation = await dependencies.state.reserveOperation(reservationInput);
  const existing = reservation.kind === 'existing';

  if (
    existing &&
    reservation.operation.requestFingerprint !== request.requestFingerprint
  ) {
    return applicationFailure(
      operationView(reservation.operation, 'conflict'),
      terminalError('conflict'),
    );
  }

  if (existing && reservation.operation.state === 'in_progress') {
    if (!isLeaseExpired(reservation.operation, dependencies.clock.now())) {
      return resultFromExistingOperation(reservation.operation, request.replay);
    }

    const recovering = recoveryOperation(reservation.operation);
    const reference = await dependencies.state.findMutationReference(
      recovering.operationId,
    );
    const outcome: StoredOperationOutcome = reference?.outcome ?? {
      state: 'expired',
      error: terminalError('expired'),
    };
    return commitWithoutWork(
      dependencies,
      recovering,
      outcome,
      request.replay,
    );
  }

  if (
    existing &&
    (reservation.operation.state === 'reconciling' ||
      reservation.operation.state === 'succeeded' ||
      reservation.operation.state === 'rejected' ||
      reservation.operation.state === 'cancelled' ||
      reservation.operation.state === 'conflict')
  ) {
    return resultFromExistingOperation(reservation.operation, request.replay);
  }

  const operation =
    existing &&
    (reservation.operation.state === 'failed_retryable' ||
      reservation.operation.state === 'expired')
      ? {
          ...reservation.operation,
          state: 'in_progress' as const,
          fencingVersion: reservation.operation.fencingVersion + 1,
        }
      : activeOperation(reservation.operation);

  if (request.signal?.aborted) {
    return commitWithoutWork(
      dependencies,
      operation,
      {
        state: 'cancelled',
        error: terminalError('cancelled'),
      },
      request.replay,
    );
  }

  let value: T | undefined;
  try {
    const committed = await dependencies.state.runMutation(
      operation,
      async (transaction) => {
        if (request.signal?.aborted) {
          return transaction.commitMutation({
            state: 'cancelled',
            error: terminalError('cancelled'),
          });
        }

        const execution = await request.execute(transaction, operation);
        if (execution.value !== undefined) {
          value = execution.value;
        }
        return transaction.commitMutation(execution.outcome);
      },
    );
    recordTelemetry(dependencies, request as MutationRequest<unknown>, operation.operationId, committed.outcome.state);
    return resultFromOutcome(
      operation.operationId,
      committed.outcome,
      request.replay,
      value,
    );
  } catch {
    const outcome: StoredOperationOutcome = {
      state: 'failed_retryable',
      error: terminalError('failed_retryable'),
    };
    try {
      await dependencies.state.runMutation(
        operation,
        (transaction) => transaction.commitMutation(outcome),
      );
    } catch {
      // The caller still receives a retryable result; the durable adapter owns recovery.
    }
    recordTelemetry(dependencies, request as MutationRequest<unknown>, operation.operationId, outcome.state);
    return resultFromOutcome(operation.operationId, outcome, request.replay);
  }
};
