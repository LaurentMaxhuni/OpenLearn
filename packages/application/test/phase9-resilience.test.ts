import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedNoProgressFixture } from '@openlearn/domain';
import { executeMutation, type MutationRequest } from '../src/lifecycle.js';
import type {
  ActorContext,
  ApplicationStatePort,
  TelemetryEvent,
} from '../src/index.js';

const plan = acceptedNoProgressFixture();
const actor: ActorContext = {
  ownerId: plan.ownerId,
  scopes: ['progress:write'],
  actorClass: 'local_stdio',
};

test('maps storage failure to a retryable result without fabricating a state change', async () => {
  let writeCalls = 0;
  const state: ApplicationStatePort = {
    readPlan: async () => plan,
    reserveOperation: async (input) => ({
      kind: 'created',
      operation: { ...input, state: 'received', fencingVersion: 0 },
    }),
    runMutation: async () => {
      writeCalls += 1;
      throw new Error('database unavailable');
    },
    findMutationReference: async () => undefined,
  };
  const request: MutationRequest<string> = {
    actor,
    kind: 'apply_progress_action',
    capability: 'progress:write',
    idempotencyKey: 'phase9-storage-failure',
    requestFingerprint: 'phase9-fingerprint',
    execute: async () => ({
      value: 'must-not-escape',
      outcome: { state: 'succeeded' },
    }),
  };

  const result = await executeMutation(
    {
      state,
      clock: { now: () => new Date('2030-01-06T03:04:05.000Z') },
      operationIds: { next: () => 'phase9-operation' },
    },
    request,
  );

  assert.equal(result.outcome, 'failed_retryable');
  assert.equal(result.error?.code, 'internal_failure');
  assert.equal('value' in result, false);
  assert.equal(JSON.stringify(plan.content).includes('must-not-escape'), false);
  assert.equal(writeCalls, 2);
});

test('emits only bounded lifecycle metadata and never raw mutation values', async () => {
  const events: TelemetryEvent[] = [];
  const state: ApplicationStatePort = {
    readPlan: async () => plan,
    reserveOperation: async (input) => ({
      kind: 'created',
      operation: { ...input, state: 'received', fencingVersion: 0 },
    }),
    runMutation: async (operation, work) => {
      const transaction = {
        readPlan: async () => plan,
        writePlan: async () => undefined,
        commitMutation: async (outcome: { state: 'succeeded' }) => ({
          plan,
          outcome,
          reference: {
            operationId: operation.operationId,
            ownerId: operation.ownerId,
            capability: operation.capability,
            requestFingerprint: operation.requestFingerprint,
            outcome,
          },
        }),
      };
      return work(transaction);
    },
    findMutationReference: async () => undefined,
  };
  const request: MutationRequest<string> = {
    actor,
    kind: 'apply_progress_action',
    capability: 'progress:write',
    idempotencyKey: 'phase9-telemetry',
    requestFingerprint: 'phase9-telemetry-fingerprint',
    execute: async () => ({
      value: 'raw feedback must not be emitted',
      outcome: { state: 'succeeded' },
    }),
  };

  const result = await executeMutation(
    {
      state,
      clock: { now: () => new Date('2030-01-06T03:04:05.000Z') },
      operationIds: { next: () => 'phase9-telemetry-operation' },
      telemetry: {
        record: (event) => {
          events.push(event);
        },
      },
    },
    request,
  );

  assert.equal(result.outcome, 'succeeded');
  assert.deepEqual(Object.keys(events[0] ?? {}).sort(), [
    'actorClass',
    'capability',
    'operationId',
    'transition',
  ]);
  assert.equal(JSON.stringify(events).includes('raw feedback'), false);
});
