import type {
  ApplicationResult,
  OperationView,
  SafeApplicationError,
} from './contracts.js';

export const APPLICATION_ERROR_CODES = [
  'missing_capability',
  'invalid_reference',
  'missing_idempotency_key',
  'mutation_replay_conflict',
  'operation_in_progress',
  'operation_expired',
  'operation_cancelled',
  'unauthorized',
  'unavailable',
  'invalid_input',
  'domain_rejected',
  'stale_personalization',
  'internal_failure',
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export const applicationFailure = <T>(
  operation: OperationView,
  error: SafeApplicationError,
): ApplicationResult<T> => ({
  outcome: operation.state,
  operation,
  error,
});

export const applicationSuccess = <T>(
  operation: OperationView,
  value: T,
): ApplicationResult<T> => ({
  outcome: 'succeeded',
  operation: { ...operation, state: 'succeeded' },
  value,
});
