import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionStatesForPlan,
  setActionState,
} from '../src/action-state.js';

test('keeps transient action state isolated when plans reuse item ids', () => {
  const firstPlan = setActionState({}, 'plan-one', 'shared-item', 'conflict');
  const bothPlans = setActionState(
    firstPlan,
    'plan-two',
    'shared-item',
    'failed_retryable',
  );

  assert.deepEqual(actionStatesForPlan(bothPlans, 'plan-one'), {
    'shared-item': 'conflict',
  });
  assert.deepEqual(actionStatesForPlan(bothPlans, 'plan-two'), {
    'shared-item': 'failed_retryable',
  });
  assert.deepEqual(actionStatesForPlan(bothPlans, 'plan-three'), {});
});
