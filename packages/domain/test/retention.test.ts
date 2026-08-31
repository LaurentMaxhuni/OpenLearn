import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RETENTION_DURATIONS_MS,
  retentionDeadlines,
  type Timestamp,
} from '../src/index.js';

const asTimestamp = (value: string): Timestamp => value as Timestamp;

test('calculates plan and integration deadlines from the requested timestamp', () => {
  const requestedAt = asTimestamp('2030-01-02T03:04:05Z');
  const deadlines = retentionDeadlines(requestedAt);

  assert.equal(
    deadlines.primaryPurgeAt,
    '2030-01-03T03:04:05.000Z',
  );
  assert.equal(
    deadlines.operationDetailsExpiresAt,
    '2030-01-03T03:04:05.000Z',
  );
  assert.equal(
    deadlines.telemetryExpiresAt,
    '2030-02-01T03:04:05.000Z',
  );
  assert.equal(
    deadlines.auditMetadataExpiresAt,
    '2030-04-02T03:04:05.000Z',
  );
  assert.equal(
    deadlines.backupExpiresAt,
    '2030-02-06T03:04:05.000Z',
  );
  assert.equal(deadlines.mutationMarkerExpiresAt, undefined);
  assert.equal(deadlines.accountPrimaryPurgeAt, undefined);
  assert.equal(deadlines.accountBackupExpiresAt, undefined);
  assert.equal(deadlines.tombstoneExpiresAt, undefined);
});

test('adds account-deletion purge, marker, backup, and tombstone deadlines only when supplied', () => {
  const deadlines = retentionDeadlines(
    asTimestamp('2030-01-02T03:04:05Z'),
    asTimestamp('2030-01-10T03:04:05Z'),
  );

  assert.equal(deadlines.accountPrimaryPurgeAt, '2030-01-11T03:04:05.000Z');
  assert.equal(deadlines.mutationMarkerExpiresAt, '2030-02-14T03:04:05.000Z');
  assert.equal(deadlines.accountBackupExpiresAt, '2030-02-14T03:04:05.000Z');
  assert.equal(deadlines.tombstoneExpiresAt, '2030-02-14T03:04:05.000Z');
});

test('exposes fixed retention windows without claiming to perform deletion', () => {
  assert.deepEqual(RETENTION_DURATIONS_MS, {
    primaryPurge: 24 * 60 * 60 * 1000,
    operationDetails: 24 * 60 * 60 * 1000,
    mutationMarkerAfterAccountDeletion: 35 * 24 * 60 * 60 * 1000,
    telemetry: 30 * 24 * 60 * 60 * 1000,
    auditMetadata: 90 * 24 * 60 * 60 * 1000,
    backup: 35 * 24 * 60 * 60 * 1000,
  });
});

test('rejects impossible calendar dates instead of normalizing them forward', () => {
  let didThrow = false;
  try {
    retentionDeadlines(asTimestamp('2030-02-31T03:04:05Z'));
  } catch (error) {
    didThrow = error instanceof RangeError;
  }

  assert.equal(didThrow, true);
});
