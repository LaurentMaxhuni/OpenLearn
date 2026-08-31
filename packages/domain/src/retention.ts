import type { Timestamp } from './types.js';
import { validateTimestamp } from './revisions.js';

export const RETENTION_DURATIONS_MS = {
  primaryPurge: 24 * 60 * 60 * 1000,
  operationDetails: 24 * 60 * 60 * 1000,
  mutationMarkerAfterAccountDeletion: 35 * 24 * 60 * 60 * 1000,
  telemetry: 30 * 24 * 60 * 60 * 1000,
  auditMetadata: 90 * 24 * 60 * 60 * 1000,
  backup: 35 * 24 * 60 * 60 * 1000,
} as const;

export interface RetentionDeadlines {
  readonly requestedAt: Timestamp;
  readonly accountDeletedAt?: Timestamp;
  readonly primaryPurgeAt: Timestamp;
  readonly accountPrimaryPurgeAt?: Timestamp;
  readonly operationDetailsExpiresAt: Timestamp;
  readonly mutationMarkerExpiresAt?: Timestamp;
  readonly telemetryExpiresAt: Timestamp;
  readonly auditMetadataExpiresAt: Timestamp;
  readonly backupExpiresAt: Timestamp;
  readonly accountBackupExpiresAt?: Timestamp;
  readonly tombstoneExpiresAt?: Timestamp;
}

const timestampMilliseconds = (value: unknown, label: string): number => {
  const result = validateTimestamp(value, label);
  if (!result.ok) {
    throw new RangeError(`${label} must be a valid UTC timestamp`);
  }

  return Date.parse(result.value);
};

const addDuration = (value: Timestamp, duration: number): Timestamp => {
  const milliseconds = timestampMilliseconds(value, 'timestamp') + duration;
  const result = new Date(milliseconds);
  if (Number.isNaN(result.getTime())) {
    throw new RangeError('timestamp is outside the supported date range');
  }

  return result.toISOString() as Timestamp;
};

export const retentionDeadlines = (
  requestedAt: Timestamp,
  accountDeletedAt?: Timestamp,
): RetentionDeadlines => {
  timestampMilliseconds(requestedAt, 'requestedAt');
  if (accountDeletedAt !== undefined) {
    timestampMilliseconds(accountDeletedAt, 'accountDeletedAt');
  }

  const accountDeadlineFields =
    accountDeletedAt === undefined
      ? {}
      : {
          accountDeletedAt,
          accountPrimaryPurgeAt: addDuration(
            accountDeletedAt,
            RETENTION_DURATIONS_MS.primaryPurge,
          ),
          mutationMarkerExpiresAt: addDuration(
            accountDeletedAt,
            RETENTION_DURATIONS_MS.mutationMarkerAfterAccountDeletion,
          ),
          accountBackupExpiresAt: addDuration(
            accountDeletedAt,
            RETENTION_DURATIONS_MS.backup,
          ),
          tombstoneExpiresAt: addDuration(
            accountDeletedAt,
            RETENTION_DURATIONS_MS.backup,
          ),
        };

  return {
    requestedAt,
    primaryPurgeAt: addDuration(
      requestedAt,
      RETENTION_DURATIONS_MS.primaryPurge,
    ),
    operationDetailsExpiresAt: addDuration(
      requestedAt,
      RETENTION_DURATIONS_MS.operationDetails,
    ),
    telemetryExpiresAt: addDuration(
      requestedAt,
      RETENTION_DURATIONS_MS.telemetry,
    ),
    auditMetadataExpiresAt: addDuration(
      requestedAt,
      RETENTION_DURATIONS_MS.auditMetadata,
    ),
    backupExpiresAt: addDuration(requestedAt, RETENTION_DURATIONS_MS.backup),
    ...accountDeadlineFields,
  };
};
