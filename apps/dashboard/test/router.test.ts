import test from 'node:test';
import assert from 'node:assert/strict';
import { routeForPath } from '../src/router.js';

test('routes the shell root and plans collection', () => {
  assert.deepEqual(routeForPath('/'), { kind: 'plans' });
  assert.deepEqual(routeForPath('/plans'), { kind: 'plans' });
});

test('decodes a plan route and rejects malformed or unknown paths', () => {
  assert.deepEqual(routeForPath('/plans/plan%2Ffoundations'), {
    kind: 'plan',
    planId: 'plan/foundations',
  });
  assert.deepEqual(routeForPath('/plans/%E0%A4%A'), { kind: 'unknown' });
  assert.deepEqual(routeForPath('/settings'), { kind: 'unknown' });
});
