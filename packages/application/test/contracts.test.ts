import test from 'node:test';
import assert from 'node:assert/strict';
import type { InternalOwnerId, PlanId } from '@openlearn/domain';
import {
  APPLICATION_OPERATION_STATES,
  CAPABILITY_SCOPES,
  applicationFailure,
  type ActorContext,
  type ApplicationResult,
  type ApplicationStatePort,
} from '../src/index.js';

test('exports the exact capability scopes and lifecycle states', () => {
  assert.deepEqual(CAPABILITY_SCOPES, [
    'plan:read',
    'plan:write',
    'progress:write',
  ]);
  assert.deepEqual(APPLICATION_OPERATION_STATES, [
    'received',
    'in_progress',
    'reconciling',
    'succeeded',
    'rejected',
    'failed_retryable',
    'cancelled',
    'expired',
    'conflict',
  ]);
});

test('failure results omit values while preserving a safe operation envelope', () => {
  const result = applicationFailure<PlanId>(
    { operationId: 'operation-1', state: 'rejected' },
    {
      code: 'missing_capability',
      message: 'The requested capability is not available.',
      retryable: false,
    },
  );

  assert.deepEqual(result, {
    outcome: 'rejected',
    operation: { operationId: 'operation-1', state: 'rejected' },
    error: {
      code: 'missing_capability',
      message: 'The requested capability is not available.',
      retryable: false,
    },
  });
  assert.equal('value' in result, false);
});

test('application ports accept internal actors without transport or credential types', () => {
  const actor: ActorContext = {
    ownerId: 'owner-storm' as InternalOwnerId,
    scopes: ['plan:read'],
    actorClass: 'local_stdio',
  };
  const port: ApplicationStatePort = {
    readPlan: async () => undefined,
    reserveOperation: async () => {
      throw new Error('not used in contract test');
    },
    runMutation: async () => {
      throw new Error('not used in contract test');
    },
    findMutationReference: async () => undefined,
  };

  const result: ApplicationResult<undefined> = {
    outcome: 'succeeded',
    operation: { operationId: 'read-1', state: 'succeeded' },
  };

  assert.equal(actor.actorClass, 'local_stdio');
  assert.equal(typeof port.readPlan, 'function');
  assert.equal(result.operation.state, 'succeeded');
});
