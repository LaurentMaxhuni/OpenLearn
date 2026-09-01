import type { IdentifierKind } from './identity.js';

export const DOMAIN_ERROR_CATEGORIES = [
  'malformed_input',
  'missing_required',
  'invalid_identifier',
  'duplicate_identifier',
  'invalid_relationship',
  'unsafe_content',
  'too_large',
  'unknown_field',
  'stale_revision',
  'stale_progress',
  'stale_personalization',
  'invalid_transition',
  'deletion_conflict',
  'owner_unavailable',
  'plan_deleted',
  'mutation_replay_conflict',
] as const;

export type DomainErrorCategory = (typeof DOMAIN_ERROR_CATEGORIES)[number];

export type DomainErrorCode =
  | 'wrong_type'
  | 'invalid_shape'
  | 'null_not_allowed'
  | 'missing_field'
  | 'empty'
  | 'invalid_syntax'
  | 'control_character'
  | 'too_long'
  | 'duplicate_value'
  | 'relationship_mismatch'
  | 'unsafe_value'
  | 'limit_exceeded'
  | 'unknown_field'
  | 'stale_revision'
  | 'stale_progress'
  | 'stale_personalization'
  | 'transition_not_allowed'
  | 'deletion_conflict'
  | 'owner_unavailable'
  | 'plan_deleted'
  | 'mutation_replay_conflict';

export interface DomainErrorDetail {
  readonly path?: string;
  readonly code: DomainErrorCode;
  readonly identifierKind?: IdentifierKind;
  readonly limit?: number;
  readonly expectedVersion?: number;
  readonly actualVersion?: number;
}

export interface DomainSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface DomainFailure {
  readonly ok: false;
  readonly category: DomainErrorCategory;
  readonly details: readonly [DomainErrorDetail, ...DomainErrorDetail[]];
}

export type DomainResult<T> = DomainSuccess<T> | DomainFailure;

export const succeed = <T>(value: T): DomainSuccess<T> => ({
  ok: true,
  value,
});

export const fail = (
  category: DomainErrorCategory,
  details: readonly [DomainErrorDetail, ...DomainErrorDetail[]],
): DomainFailure => ({
  ok: false,
  category,
  details,
});
