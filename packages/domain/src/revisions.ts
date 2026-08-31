import { fail, succeed, type DomainResult } from './errors.js';
import {
  brandIdentifier,
  type IdentifierForKind,
  type IdentifierKind,
  type IdentityAllocator,
} from './identity.js';
import type { InternalOwnerId, Timestamp } from './types.js';

export interface CreatePlanCommand {
  readonly ownerId: InternalOwnerId;
  readonly candidate: unknown;
  readonly allocator: IdentityAllocator;
  readonly acceptedAt: Timestamp;
}

export interface ReplacePlanCommand {
  readonly plan: import('./types.js').PlanAggregate;
  readonly ownerId: InternalOwnerId;
  readonly expectedRevisionId?: import('./types.js').RevisionId;
  readonly candidate: unknown;
  readonly allocator: IdentityAllocator;
  readonly acceptedAt: Timestamp;
}

const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/u;

const parseUtcTimestamp = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const milliseconds = Date.parse(value);
  if (Number.isNaN(milliseconds)) {
    return undefined;
  }

  const canonical = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7] ?? '.000'}Z`;
  if (new Date(milliseconds).toISOString() !== canonical) {
    return undefined;
  }

  return milliseconds;
};

const invalidAllocator = (path: string) =>
  fail('malformed_input', [{ path, code: 'wrong_type' }]);

const allocatorIsUsable = (
  allocator: unknown,
): allocator is IdentityAllocator =>
  allocator !== null &&
  typeof allocator === 'object' &&
  typeof (allocator as { readonly allocate?: unknown }).allocate === 'function';

const invalidOwner = () =>
  fail('owner_unavailable', [{ code: 'owner_unavailable' }]);

export const validateOwnerId = (
  value: unknown,
): DomainResult<InternalOwnerId> => {
  if (typeof value !== 'string') {
    return invalidOwner();
  }

  const result = brandIdentifier('internal_owner', value);
  return result.ok ? result : invalidOwner();
};

export const validateAcceptedAt = (
  value: unknown,
): DomainResult<Timestamp> => {
  return validateTimestamp(value, 'acceptedAt');
};

export const validateTimestamp = (
  value: unknown,
  path: string,
): DomainResult<Timestamp> => {
  if (value === null) {
    return fail('malformed_input', [
      { path, code: 'null_not_allowed' },
    ]);
  }
  if (typeof value !== 'string') {
    return fail('malformed_input', [{ path, code: 'wrong_type' }]);
  }
  if (parseUtcTimestamp(value) === undefined) {
    return fail('malformed_input', [
      { path, code: 'invalid_syntax' },
    ]);
  }

  return succeed(value as Timestamp);
};

const allocatorFailure = (
  path: string,
  kind: IdentifierKind,
  result: ReturnType<typeof brandIdentifier<IdentifierKind>>,
) => {
  const firstDetail = result.ok ? undefined : result.details[0];
  return fail('invalid_identifier', [
    {
      path,
      code: firstDetail?.code ?? 'invalid_syntax',
      identifierKind: kind,
      ...(firstDetail?.limit === undefined ? {} : { limit: firstDetail.limit }),
    },
  ]);
};

export const allocateIdentifier = <K extends IdentifierKind>(
  allocator: IdentityAllocator,
  kind: K,
  path: string,
): DomainResult<IdentifierForKind<K>> => {
  if (!allocatorIsUsable(allocator)) {
    return invalidAllocator('allocator');
  }

  let allocated: unknown;
  try {
    allocated = allocator.allocate(kind);
  } catch {
    return fail('invalid_identifier', [
      { path, code: 'invalid_syntax', identifierKind: kind },
    ]);
  }

  if (typeof allocated !== 'string') {
    return fail('invalid_identifier', [
      { path, code: 'invalid_syntax', identifierKind: kind },
    ]);
  }

  const result = brandIdentifier(kind, allocated);
  if (!result.ok) {
    return allocatorFailure(path, kind, result);
  }

  return result;
};
