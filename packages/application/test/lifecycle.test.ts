import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedNoProgressFixture } from '@openlearn/domain';
import {
  executeMutation,
  type MutationRequest,
} from '../src/lifecycle.js';
import type {
  ApplicationTransaction,
  ApplicationStatePort,
  ActorContext,
  MutationReference,
  OperationRecord,
} from '../src/index.js';

const fixture = acceptedNoProgressFixture();
const actor: ActorContext = {
  ownerId: fixture.ownerId,
  scopes: ['progress:write'],
  actorClass: 'local_stdio',
};

const activeOperation = (overrides: Partial<OperationRecord> = {}): OperationRecord => ({
  operationId: 'operation-existing',
  kind: 'apply_progress_action',
  ownerId: fixture.ownerId,
  capability: 'progress:write',
  idempotencyKey: 'lifecycle-key',
  requestFingerprint: 'fingerprint-a',
  state: 'in_progress',
  startedAt: '2030-01-06T03:04:00.000Z',
  deadlineAt: '2030-01-06T03:04:30.000Z',
  leaseExpiresAt: '2030-01-06T03:04:40.000Z',
  fencingVersion: 0,
  ...overrides,
});

const successOutcome = { state: 'succeeded' as const };

const createState = (existing?: OperationRecord, reference?: MutationReference) => {
  let stored = existing;
  let reserveCalls = 0;
  let mutationCalls = 0;
  const mutationOperations: OperationRecord[] = [];
  const state: ApplicationStatePort = {
    readPlan: async () => undefined,
    reserveOperation: async (input) => {
      reserveCalls += 1;
      if (stored !== undefined) {
        return { kind: 'existing', operation: stored };
      }
      stored = {
        ...input,
        state: 'received',
        fencingVersion: 0,
      };
      return { kind: 'created', operation: stored };
    },
    runMutation: async (operation, work) => {
      mutationCalls += 1;
      mutationOperations.push(operation);
      const transaction: ApplicationTransaction = {
        readPlan: async () => undefined,
        writePlan: async () => undefined,
        commitMutation: async (outcome) => {
          stored = { ...operation, state: outcome.state, outcome };
          return {
            outcome,
            reference: {
              operationId: operation.operationId,
              ownerId: operation.ownerId,
              capability: operation.capability,
              requestFingerprint: operation.requestFingerprint,
              outcome,
            },
          };
        },
      };
      return work(transaction);
    },
    findMutationReference: async () => reference,
  };
  return {
    state,
    get reserveCalls() {
      return reserveCalls;
    },
    get mutationCalls() {
      return mutationCalls;
    },
    mutationOperations,
  };
};

const dependencies = (state: ApplicationStatePort, now: string) => ({
  state,
  clock: { now: () => new Date(now) },
  operationIds: { next: () => 'operation-created' },
});

const request = <T>(
  overrides: Partial<MutationRequest<T>> = {},
): MutationRequest<T> => ({
  actor,
  kind: 'apply_progress_action',
  capability: 'progress:write',
  idempotencyKey: 'lifecycle-key',
  requestFingerprint: 'fingerprint-a',
  execute: async () => ({ value: 'done' as T, outcome: successOutcome }),
  ...overrides,
});

test('rejects a mutation without an idempotency key before reserving an operation', async () => {
  const harness = createState();
  const result = await executeMutation(
    dependencies(harness.state, '2030-01-06T03:04:00.000Z'),
    request({ idempotencyKey: '' }),
  );

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.error?.code, 'missing_idempotency_key');
  assert.equal(harness.reserveCalls, 0);
});

test('replays a matching terminal key and conflicts on a changed fingerprint', async () => {
  let attempts = 0;
  const firstHarness = createState();
  const firstRequest = request({
    execute: async () => {
      attempts += 1;
      return { value: 'done', outcome: successOutcome };
    },
  });
  const first = await executeMutation(
    dependencies(firstHarness.state, '2030-01-06T03:04:00.000Z'),
    firstRequest,
  );
  const second = await executeMutation(
    dependencies(firstHarness.state, '2030-01-06T03:04:01.000Z'),
    firstRequest,
  );
  const conflict = await executeMutation(
    dependencies(firstHarness.state, '2030-01-06T03:04:02.000Z'),
    request({ requestFingerprint: 'fingerprint-b' }),
  );

  assert.equal(first.outcome, 'succeeded');
  assert.equal(second.outcome, 'succeeded');
  assert.equal(conflict.outcome, 'conflict');
  assert.equal(conflict.error?.code, 'mutation_replay_conflict');
  assert.equal(attempts, 1);
  assert.equal(firstHarness.mutationCalls, 1);
});

test('reconciles an expired operation from a matching mutation reference without rerunning work', async () => {
  const existing = activeOperation({ leaseExpiresAt: '2030-01-06T03:04:10.000Z' });
  const reference: MutationReference = {
    operationId: existing.operationId,
    ownerId: existing.ownerId,
    capability: existing.capability,
    requestFingerprint: existing.requestFingerprint,
    outcome: successOutcome,
  };
  const harness = createState(existing, reference);
  let workCalled = false;
  const result = await executeMutation(
    dependencies(harness.state, '2030-01-06T03:04:11.000Z'),
    request({
      execute: async () => {
        workCalled = true;
        return { value: 'unexpected', outcome: successOutcome };
      },
    }),
  );

  assert.equal(result.outcome, 'succeeded');
  assert.equal(workCalled, false);
  assert.equal(harness.mutationOperations[0]?.state, 'reconciling');
  assert.equal(harness.mutationOperations[0]?.fencingVersion, 1);
});

test('reports an active duplicate without inventing a terminal outcome', async () => {
  const harness = createState(activeOperation());
  const result = await executeMutation(
    dependencies(harness.state, '2030-01-06T03:04:11.000Z'),
    request(),
  );

  assert.equal(result.outcome, 'in_progress');
  assert.equal(result.error?.code, 'operation_in_progress');
  assert.equal(harness.mutationCalls, 0);
});

test('honors an already-aborted signal before domain work', async () => {
  const harness = createState();
  const controller = new AbortController();
  controller.abort();
  let workCalled = false;
  const result = await executeMutation(
    dependencies(harness.state, '2030-01-06T03:04:00.000Z'),
    request({
      signal: controller.signal,
      execute: async () => {
        workCalled = true;
        return { value: 'unexpected', outcome: successOutcome };
      },
    }),
  );

  assert.equal(result.outcome, 'cancelled');
  assert.equal(result.error?.code, 'operation_cancelled');
  assert.equal(workCalled, false);
});
