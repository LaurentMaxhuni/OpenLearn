import { DOMAIN_LIMITS } from './limits.js';
import { fail, succeed, type DomainResult } from './errors.js';
import type {
  ContextEntryId,
  GoalId,
  InternalOwnerId,
  MilestoneId,
  PlanId,
  PlanItemId,
  ResourceId,
  RevisionId,
  TopicId,
} from './types.js';

export const IDENTIFIER_KINDS = [
  'plan',
  'revision',
  'goal',
  'context_entry',
  'milestone',
  'topic',
  'plan_item',
  'resource',
  'internal_owner',
  'feedback',
  'proposal',
] as const;

export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];

export interface IdentityAllocator {
  allocate(kind: IdentifierKind): string;
}

export const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u;

type IdentifierByKind = {
  plan: PlanId;
  revision: RevisionId;
  goal: GoalId;
  context_entry: ContextEntryId;
  milestone: MilestoneId;
  topic: TopicId;
  plan_item: PlanItemId;
  resource: ResourceId;
  internal_owner: InternalOwnerId;
  feedback: import('./types.js').FeedbackId;
  proposal: import('./types.js').ProposalId;
};

export type IdentifierForKind<K extends IdentifierKind> = IdentifierByKind[K];

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

export const brandIdentifier = <K extends IdentifierKind>(
  kind: K,
  value: string,
): DomainResult<IdentifierForKind<K>> => {
  if (value.length < DOMAIN_LIMITS.identifier.minLength) {
    return fail('invalid_identifier', [
      {
        code: 'empty',
        identifierKind: kind,
      },
    ]);
  }

  if (value.length > DOMAIN_LIMITS.identifier.maxLength) {
    return fail('invalid_identifier', [
      {
        code: 'too_long',
        identifierKind: kind,
        limit: DOMAIN_LIMITS.identifier.maxLength,
      },
    ]);
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return fail('invalid_identifier', [
      {
        code: 'control_character',
        identifierKind: kind,
      },
    ]);
  }

  if (!IDENTIFIER_PATTERN.test(value)) {
    return fail('invalid_identifier', [
      {
        code: 'invalid_syntax',
        identifierKind: kind,
      },
    ]);
  }

  return succeed(value as IdentifierForKind<K>);
};
