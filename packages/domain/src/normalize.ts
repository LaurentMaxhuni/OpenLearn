import { DOMAIN_LIMITS } from './limits.js';
import {
  fail,
  succeed,
  type DomainErrorCode,
  type DomainErrorDetail,
  type DomainFailure,
  type DomainResult,
} from './errors.js';
import {
  brandIdentifier,
  type IdentifierForKind,
  type IdentifierKind,
  type IdentityAllocator,
} from './identity.js';
import type {
  BoundedOpaqueText,
  CanonicalPlanContent,
  Context,
  ContextEntry,
  Goal,
  LongText,
  Milestone,
  NonEmptyReadonlyArray,
  PlanItem,
  Resource,
  SafeHttpsUrl,
  ShortText,
  Topic,
} from './types.js';

export interface NormalizedPlanContent extends CanonicalPlanContent {
  readonly missingOptionalPaths: readonly string[];
}

type InputRecord = Record<string, unknown>;
type TextKind = 'short' | 'long' | 'opaque' | 'url';

interface ParseState {
  readonly missingOptionalPaths: string[];
  readonly suppliedIdentifiers: Set<string>;
  canonicalTextLength: number;
  topicCount: number;
  itemCount: number;
}

interface PendingGoal {
  goalId?: string;
  title: string;
  description?: string;
}

interface PendingContextEntry {
  entryId?: string;
  label: string;
  value: string;
}

interface PendingContext {
  summary?: string;
  entries?: readonly PendingContextEntry[];
}

interface PendingResource {
  resourceId?: string;
  label: string;
  href?: string;
  opaqueReference?: string;
}

interface PendingPlanItem {
  itemId?: string;
  title: string;
  description?: string;
  resources?: readonly PendingResource[];
}

interface PendingTopic {
  topicId?: string;
  title: string;
  description?: string;
  items: readonly PendingPlanItem[];
}

interface PendingMilestone {
  milestoneId?: string;
  title: string;
  description?: string;
  topics: readonly PendingTopic[];
}

interface PendingPlanContent {
  title?: string;
  goal: PendingGoal;
  context?: PendingContext;
  milestones: readonly PendingMilestone[];
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const EXECUTABLE_TEXT_PATTERN =
  /<\s*\/?\s*(?:script|iframe|object|embed|style|link)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|vbscript):/iu;

const TEXT_LIMITS: Record<TextKind, number> = {
  short: DOMAIN_LIMITS.shortText.maxLength,
  long: DOMAIN_LIMITS.longText.maxLength,
  opaque: DOMAIN_LIMITS.boundedOpaqueText.maxLength,
  url: DOMAIN_LIMITS.safeHttpsUrl.maxLength,
};

const isRecord = (value: unknown): value is InputRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (record: InputRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const childPath = (parent: string, child: string): string =>
  parent.length === 0 ? child : `${parent}.${child}`;

const indexedPath = (parent: string, child: string, index: number): string =>
  `${parent}.${child}[${index}]`;

const detail = (
  path: string,
  code: DomainErrorCode,
  extra?: { readonly limit?: number },
) => ({ path, code, ...(extra ?? {}) });

const detailsWithPath = (
  path: string,
  entries: readonly DomainErrorDetail[],
): [DomainErrorDetail, ...DomainErrorDetail[]] => {
  const mapped = entries.map((entry) => ({ ...entry, path }));
  return mapped as [DomainErrorDetail, ...DomainErrorDetail[]];
};

const unknownFieldFailure = (
  record: InputRecord,
  allowedFields: readonly string[],
  path: string,
): DomainFailure | undefined => {
  const allowed = new Set(allowedFields);

  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      return fail('unknown_field', [
        detail(childPath(path, typeof key === 'string' ? key : '<symbol>'), 'unknown_field'),
      ]);
    }
  }

  return undefined;
};

const malformed = (path: string, code: 'wrong_type' | 'null_not_allowed') =>
  fail('malformed_input', [detail(path, code)]);

const requiredMissing = (path: string) =>
  fail('missing_required', [detail(path, 'missing_field')]);

const requiredEmpty = (path: string) =>
  fail('missing_required', [detail(path, 'empty')]);

const tooLarge = (path: string, code: 'too_long' | 'limit_exceeded', limit: number) =>
  fail('too_large', [detail(path, code, { limit })]);

const normalizeText = (
  value: unknown,
  path: string,
  kind: TextKind,
  required: boolean,
  state: ParseState,
  present = value !== undefined,
): DomainResult<string | undefined> => {
  if (value === undefined) {
    if (required) {
      return requiredMissing(path);
    }

    if (present) {
      state.missingOptionalPaths.push(path);
    }
    return succeed(undefined);
  }

  if (value === null) {
    return malformed(path, 'null_not_allowed');
  }

  if (typeof value !== 'string') {
    return malformed(path, 'wrong_type');
  }

  const normalized = value
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/\t/gu, ' ')
    .trim();

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return fail('unsafe_content', [detail(path, 'control_character')]);
  }

  if (EXECUTABLE_TEXT_PATTERN.test(normalized)) {
    return fail('unsafe_content', [detail(path, 'unsafe_value')]);
  }

  if (normalized.length === 0) {
    if (required) {
      return requiredEmpty(path);
    }

    if (present) {
      state.missingOptionalPaths.push(path);
    }
    return succeed(undefined);
  }

  const scalarLength = Array.from(normalized).length;

  if (
    state.canonicalTextLength + scalarLength >
    DOMAIN_LIMITS.canonicalText.maxLength
  ) {
    return tooLarge(
      path,
      'limit_exceeded',
      DOMAIN_LIMITS.canonicalText.maxLength,
    );
  }

  if (scalarLength > TEXT_LIMITS[kind]) {
    return tooLarge(path, 'too_long', TEXT_LIMITS[kind]);
  }

  state.canonicalTextLength += scalarLength;
  return succeed(normalized);
};

const normalizeUrl = (
  value: unknown,
  path: string,
  state: ParseState,
  present = value !== undefined,
): DomainResult<string | undefined> => {
  const normalizedResult = normalizeText(value, path, 'url', false, state, present);

  if (!normalizedResult.ok || normalizedResult.value === undefined) {
    return normalizedResult;
  }

  const normalized = normalizedResult.value;
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    return fail('unsafe_content', [detail(path, 'invalid_syntax')]);
  }

  if (parsed.protocol !== 'https:' || parsed.username.length > 0 || parsed.password.length > 0) {
    return fail('unsafe_content', [detail(path, 'unsafe_value')]);
  }

  return succeed(normalized);
};

const readIdentifier = <K extends IdentifierKind>(
  record: InputRecord,
  key: string,
  path: string,
  kind: K,
  state: ParseState,
): DomainResult<string | undefined> => {
  const value = record[key];

  if (value === undefined) {
    return succeed(undefined);
  }

  if (value === null) {
    return malformed(path, 'null_not_allowed');
  }

  if (typeof value !== 'string') {
    return malformed(path, 'wrong_type');
  }

  const result = brandIdentifier(kind, value);

  if (!result.ok) {
    return fail('invalid_identifier', detailsWithPath(path, result.details));
  }

  if (state.suppliedIdentifiers.has(value)) {
    return fail('duplicate_identifier', [detail(path, 'duplicate_value')]);
  }

  state.suppliedIdentifiers.add(value);
  return succeed(value);
};

const readObject = (
  value: unknown,
  path: string,
): DomainResult<InputRecord> => {
  if (value === null) {
    return malformed(path, 'null_not_allowed');
  }

  if (!isRecord(value)) {
    return malformed(path, 'wrong_type');
  }

  return succeed(value);
};

const readRequiredArray = (
  record: InputRecord,
  key: string,
  path: string,
): DomainResult<readonly unknown[]> => {
  if (!hasOwn(record, key) || record[key] === undefined) {
    return requiredMissing(path);
  }

  if (record[key] === null) {
    return malformed(path, 'null_not_allowed');
  }

  if (!Array.isArray(record[key])) {
    return malformed(path, 'wrong_type');
  }

  if (record[key].length === 0) {
    return requiredEmpty(path);
  }

  return succeed(record[key]);
};

const readOptionalArray = (
  record: InputRecord,
  key: string,
  path: string,
): DomainResult<readonly unknown[] | undefined> => {
  if (!hasOwn(record, key) || record[key] === undefined) {
    return succeed(undefined);
  }

  if (record[key] === null) {
    return malformed(path, 'null_not_allowed');
  }

  if (!Array.isArray(record[key])) {
    return malformed(path, 'wrong_type');
  }

  return succeed(record[key]);
};

const readOptionalContext = (
  record: InputRecord,
  state: ParseState,
): DomainResult<PendingContext | undefined> => {
  const path = 'context';

  if (!hasOwn(record, 'context') || record.context === undefined) {
    return succeed(undefined);
  }

  const contextResult = readObject(record.context, path);
  if (!contextResult.ok) {
    return contextResult;
  }

  const context = contextResult.value;
  const unknown = unknownFieldFailure(context, ['summary', 'entries'], path);
  if (unknown) {
    return unknown;
  }

  const summaryResult = normalizeText(
    context.summary,
    childPath(path, 'summary'),
    'long',
    false,
    state,
    hasOwn(context, 'summary'),
  );
  if (!summaryResult.ok) {
    return summaryResult;
  }

  const entriesResult = readOptionalArray(context, 'entries', childPath(path, 'entries'));
  if (!entriesResult.ok) {
    return entriesResult;
  }

  const entries = entriesResult.value;
  if (entries !== undefined && entries.length > DOMAIN_LIMITS.contextEntries.max) {
    return tooLarge(
      childPath(path, 'entries'),
      'limit_exceeded',
      DOMAIN_LIMITS.contextEntries.max,
    );
  }

  const pendingEntries: PendingContextEntry[] = [];
  if (entries !== undefined) {
    for (const [index, value] of entries.entries()) {
      const entryPath = indexedPath(path, 'entries', index);
      const entryResult = readObject(value, entryPath);
      if (!entryResult.ok) {
        return entryResult;
      }

      const entry = entryResult.value;
      const unknownEntry = unknownFieldFailure(entry, ['entryId', 'label', 'value'], entryPath);
      if (unknownEntry) {
        return unknownEntry;
      }

      const entryIdResult = readIdentifier(
        entry,
        'entryId',
        childPath(entryPath, 'entryId'),
        'context_entry',
        state,
      );
      if (!entryIdResult.ok) {
        return entryIdResult;
      }

      const labelResult = normalizeText(
        entry.label,
        childPath(entryPath, 'label'),
        'short',
        true,
        state,
      );
      if (!labelResult.ok || labelResult.value === undefined) {
        return labelResult.ok ? requiredEmpty(childPath(entryPath, 'label')) : labelResult;
      }

      const valueResult = normalizeText(
        entry.value,
        childPath(entryPath, 'value'),
        'long',
        true,
        state,
      );
      if (!valueResult.ok || valueResult.value === undefined) {
        return valueResult.ok ? requiredEmpty(childPath(entryPath, 'value')) : valueResult;
      }

      const pendingEntry: PendingContextEntry = {
        label: labelResult.value,
        value: valueResult.value,
      };
      if (entryIdResult.value !== undefined) {
        pendingEntry.entryId = entryIdResult.value;
      }
      pendingEntries.push(pendingEntry);
    }
  }

  const pendingContext: PendingContext = {};
  if (summaryResult.value !== undefined) {
    pendingContext.summary = summaryResult.value;
  }
  if (entries !== undefined) {
    pendingContext.entries = pendingEntries;
  }

  return succeed(pendingContext);
};

const readResource = (
  value: unknown,
  path: string,
  state: ParseState,
): DomainResult<PendingResource> => {
  const resourceResult = readObject(value, path);
  if (!resourceResult.ok) {
    return resourceResult;
  }

  const resource = resourceResult.value;
  const unknown = unknownFieldFailure(
    resource,
    ['resourceId', 'label', 'href', 'opaqueReference'],
    path,
  );
  if (unknown) {
    return unknown;
  }

  const resourceIdResult = readIdentifier(
    resource,
    'resourceId',
    childPath(path, 'resourceId'),
    'resource',
    state,
  );
  if (!resourceIdResult.ok) {
    return resourceIdResult;
  }

  const labelResult = normalizeText(
    resource.label,
    childPath(path, 'label'),
    'short',
    true,
    state,
  );
  if (!labelResult.ok || labelResult.value === undefined) {
    return labelResult.ok ? requiredEmpty(childPath(path, 'label')) : labelResult;
  }

  const hrefResult = normalizeUrl(
    resource.href,
    childPath(path, 'href'),
    state,
    hasOwn(resource, 'href'),
  );
  if (!hrefResult.ok) {
    return hrefResult;
  }

  const opaqueResult = normalizeText(
    resource.opaqueReference,
    childPath(path, 'opaqueReference'),
    'opaque',
    false,
    state,
    hasOwn(resource, 'opaqueReference'),
  );
  if (!opaqueResult.ok) {
    return opaqueResult;
  }

  if (hrefResult.value === undefined && opaqueResult.value === undefined) {
    // A label is the valid displayable destination for a resource, so no
    // additional required-field error is needed here.
  }

  const pendingResource: PendingResource = { label: labelResult.value };
  if (resourceIdResult.value !== undefined) {
    pendingResource.resourceId = resourceIdResult.value;
  }
  if (hrefResult.value !== undefined) {
    pendingResource.href = hrefResult.value;
  }
  if (opaqueResult.value !== undefined) {
    pendingResource.opaqueReference = opaqueResult.value;
  }

  return succeed(pendingResource);
};

const readPlanItem = (
  value: unknown,
  path: string,
  state: ParseState,
): DomainResult<PendingPlanItem> => {
  const itemResult = readObject(value, path);
  if (!itemResult.ok) {
    return itemResult;
  }

  const item = itemResult.value;
  const unknown = unknownFieldFailure(
    item,
    ['itemId', 'title', 'description', 'resources'],
    path,
  );
  if (unknown) {
    return unknown;
  }

  const itemIdResult = readIdentifier(item, 'itemId', childPath(path, 'itemId'), 'plan_item', state);
  if (!itemIdResult.ok) {
    return itemIdResult;
  }

  const titleResult = normalizeText(
    item.title,
    childPath(path, 'title'),
    'short',
    true,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? requiredEmpty(childPath(path, 'title')) : titleResult;
  }

  const descriptionResult = normalizeText(
    item.description,
    childPath(path, 'description'),
    'long',
    false,
    state,
    hasOwn(item, 'description'),
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const resourcesResult = readOptionalArray(item, 'resources', childPath(path, 'resources'));
  if (!resourcesResult.ok) {
    return resourcesResult;
  }

  const resources = resourcesResult.value;
  if (resources !== undefined && resources.length > DOMAIN_LIMITS.resourcesPerItem.max) {
    return tooLarge(
      childPath(path, 'resources'),
      'limit_exceeded',
      DOMAIN_LIMITS.resourcesPerItem.max,
    );
  }

  const pendingResources: PendingResource[] = [];
  if (resources !== undefined) {
    for (const [index, value] of resources.entries()) {
      const resourceResult = readResource(
        value,
        indexedPath(path, 'resources', index),
        state,
      );
      if (!resourceResult.ok) {
        return resourceResult;
      }
      pendingResources.push(resourceResult.value);
    }
  }

  const pendingItem: PendingPlanItem = { title: titleResult.value };
  if (itemIdResult.value !== undefined) {
    pendingItem.itemId = itemIdResult.value;
  }
  if (descriptionResult.value !== undefined) {
    pendingItem.description = descriptionResult.value;
  }
  if (resources !== undefined) {
    pendingItem.resources = pendingResources;
  }

  return succeed(pendingItem);
};

const readTopic = (
  value: unknown,
  path: string,
  state: ParseState,
): DomainResult<PendingTopic> => {
  const topicResult = readObject(value, path);
  if (!topicResult.ok) {
    return topicResult;
  }

  const topic = topicResult.value;
  const unknown = unknownFieldFailure(topic, ['topicId', 'title', 'description', 'items'], path);
  if (unknown) {
    return unknown;
  }

  const topicIdResult = readIdentifier(topic, 'topicId', childPath(path, 'topicId'), 'topic', state);
  if (!topicIdResult.ok) {
    return topicIdResult;
  }

  const titleResult = normalizeText(
    topic.title,
    childPath(path, 'title'),
    'short',
    true,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? requiredEmpty(childPath(path, 'title')) : titleResult;
  }

  const descriptionResult = normalizeText(
    topic.description,
    childPath(path, 'description'),
    'long',
    false,
    state,
    hasOwn(topic, 'description'),
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const itemsResult = readRequiredArray(topic, 'items', childPath(path, 'items'));
  if (!itemsResult.ok) {
    return itemsResult;
  }

  const itemsPath = childPath(path, 'items');
  if (
    state.itemCount + itemsResult.value.length >
    DOMAIN_LIMITS.planItemsPerPlan.max
  ) {
    return tooLarge(
      itemsPath,
      'limit_exceeded',
      DOMAIN_LIMITS.planItemsPerPlan.max,
    );
  }
  state.itemCount += itemsResult.value.length;

  const pendingItems: PendingPlanItem[] = [];
  for (const [index, value] of itemsResult.value.entries()) {
    const itemResult = readPlanItem(value, indexedPath(path, 'items', index), state);
    if (!itemResult.ok) {
      return itemResult;
    }
    pendingItems.push(itemResult.value);
  }

  const pendingTopic: PendingTopic = {
    title: titleResult.value,
    items: pendingItems,
  };
  if (topicIdResult.value !== undefined) {
    pendingTopic.topicId = topicIdResult.value;
  }
  if (descriptionResult.value !== undefined) {
    pendingTopic.description = descriptionResult.value;
  }

  return succeed(pendingTopic);
};

const readMilestone = (
  value: unknown,
  path: string,
  state: ParseState,
): DomainResult<PendingMilestone> => {
  const milestoneResult = readObject(value, path);
  if (!milestoneResult.ok) {
    return milestoneResult;
  }

  const milestone = milestoneResult.value;
  const unknown = unknownFieldFailure(
    milestone,
    ['milestoneId', 'title', 'description', 'topics'],
    path,
  );
  if (unknown) {
    return unknown;
  }

  const milestoneIdResult = readIdentifier(
    milestone,
    'milestoneId',
    childPath(path, 'milestoneId'),
    'milestone',
    state,
  );
  if (!milestoneIdResult.ok) {
    return milestoneIdResult;
  }

  const titleResult = normalizeText(
    milestone.title,
    childPath(path, 'title'),
    'short',
    true,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? requiredEmpty(childPath(path, 'title')) : titleResult;
  }

  const descriptionResult = normalizeText(
    milestone.description,
    childPath(path, 'description'),
    'long',
    false,
    state,
    hasOwn(milestone, 'description'),
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const topicsResult = readRequiredArray(milestone, 'topics', childPath(path, 'topics'));
  if (!topicsResult.ok) {
    return topicsResult;
  }

  const topicsPath = childPath(path, 'topics');
  if (
    state.topicCount + topicsResult.value.length >
    DOMAIN_LIMITS.topicsPerPlan.max
  ) {
    return tooLarge(
      topicsPath,
      'limit_exceeded',
      DOMAIN_LIMITS.topicsPerPlan.max,
    );
  }
  state.topicCount += topicsResult.value.length;

  const pendingTopics: PendingTopic[] = [];
  for (const [index, value] of topicsResult.value.entries()) {
    const topicResult = readTopic(value, indexedPath(path, 'topics', index), state);
    if (!topicResult.ok) {
      return topicResult;
    }
    pendingTopics.push(topicResult.value);
  }

  const pendingMilestone: PendingMilestone = {
    title: titleResult.value,
    topics: pendingTopics,
  };
  if (milestoneIdResult.value !== undefined) {
    pendingMilestone.milestoneId = milestoneIdResult.value;
  }
  if (descriptionResult.value !== undefined) {
    pendingMilestone.description = descriptionResult.value;
  }

  return succeed(pendingMilestone);
};

const readCandidate = (
  input: unknown,
  state: ParseState,
): DomainResult<PendingPlanContent> => {
  const rootResult = readObject(input, '');
  if (!rootResult.ok) {
    return rootResult;
  }

  const root = rootResult.value;
  const unknown = unknownFieldFailure(root, ['title', 'goal', 'context', 'milestones'], '');
  if (unknown) {
    return unknown;
  }

  const titleResult = normalizeText(
    root.title,
    'title',
    'short',
    false,
    state,
    hasOwn(root, 'title'),
  );
  if (!titleResult.ok) {
    return titleResult;
  }

  if (!hasOwn(root, 'goal') || root.goal === undefined) {
    return requiredMissing('goal');
  }
  const goalResult = readObject(root.goal, 'goal');
  if (!goalResult.ok) {
    return goalResult;
  }

  const goal = goalResult.value;
  const unknownGoal = unknownFieldFailure(goal, ['goalId', 'title', 'description'], 'goal');
  if (unknownGoal) {
    return unknownGoal;
  }

  const goalIdResult = readIdentifier(goal, 'goalId', 'goal.goalId', 'goal', state);
  if (!goalIdResult.ok) {
    return goalIdResult;
  }
  const goalTitleResult = normalizeText(goal.title, 'goal.title', 'short', true, state);
  if (!goalTitleResult.ok || goalTitleResult.value === undefined) {
    return goalTitleResult.ok ? requiredEmpty('goal.title') : goalTitleResult;
  }
  const goalDescriptionResult = normalizeText(
    goal.description,
    'goal.description',
    'long',
    false,
    state,
    hasOwn(goal, 'description'),
  );
  if (!goalDescriptionResult.ok) {
    return goalDescriptionResult;
  }

  const contextResult = readOptionalContext(root, state);
  if (!contextResult.ok) {
    return contextResult;
  }

  const milestonesResult = readRequiredArray(root, 'milestones', 'milestones');
  if (!milestonesResult.ok) {
    return milestonesResult;
  }
  if (milestonesResult.value.length > DOMAIN_LIMITS.milestones.max) {
    return tooLarge('milestones', 'limit_exceeded', DOMAIN_LIMITS.milestones.max);
  }

  const pendingMilestones: PendingMilestone[] = [];
  for (const [index, value] of milestonesResult.value.entries()) {
    const milestoneResult = readMilestone(value, `milestones[${index}]`, state);
    if (!milestoneResult.ok) {
      return milestoneResult;
    }
    pendingMilestones.push(milestoneResult.value);
  }

  const pendingGoal: PendingGoal = { title: goalTitleResult.value };
  if (goalIdResult.value !== undefined) {
    pendingGoal.goalId = goalIdResult.value;
  }
  if (goalDescriptionResult.value !== undefined) {
    pendingGoal.description = goalDescriptionResult.value;
  }

  const pendingCandidate: PendingPlanContent = {
    goal: pendingGoal,
    milestones: pendingMilestones,
  };
  if (titleResult.value !== undefined) {
    pendingCandidate.title = titleResult.value;
  }
  if (contextResult.value !== undefined) {
    pendingCandidate.context = contextResult.value;
  }

  return succeed(pendingCandidate);
};

const allocateIdentifier = <K extends IdentifierKind>(
  value: string | undefined,
  kind: K,
  path: string,
  allocator: IdentityAllocator,
  usedIdentifiers: Set<string>,
): DomainResult<IdentifierForKind<K>> => {
  let candidate = value;

  if (candidate === undefined) {
    try {
      candidate = allocator.allocate(kind);
    } catch {
      return fail('malformed_input', [detail(path, 'invalid_shape')]);
    }
  }

  if (typeof candidate !== 'string') {
    return fail('malformed_input', [detail(path, 'wrong_type')]);
  }

  const branded = brandIdentifier(kind, candidate);
  if (!branded.ok) {
    return fail('invalid_identifier', detailsWithPath(path, branded.details));
  }

  if (usedIdentifiers.has(candidate)) {
    return fail('duplicate_identifier', [detail(path, 'duplicate_value')]);
  }

  usedIdentifiers.add(candidate);
  return succeed(branded.value);
};

const asNonEmpty = <T>(values: readonly T[]): NonEmptyReadonlyArray<T> => {
  if (values.length === 0) {
    throw new Error('internal invariant: expected a non-empty array');
  }

  return values as NonEmptyReadonlyArray<T>;
};

const materializeCandidate = (
  pending: PendingPlanContent,
  allocator: IdentityAllocator,
  missingOptionalPaths: readonly string[],
): DomainResult<NormalizedPlanContent> => {
  const usedIdentifiers = new Set<string>();

  const goalIdResult = allocateIdentifier(
    pending.goal.goalId,
    'goal',
    'goal.goalId',
    allocator,
    usedIdentifiers,
  );
  if (!goalIdResult.ok) {
    return goalIdResult;
  }

  const goal: Goal = {
    goalId: goalIdResult.value,
    title: pending.goal.title as ShortText,
    ...(pending.goal.description === undefined
      ? {}
      : { description: pending.goal.description as LongText }),
  };

  let context: Context | undefined;
  if (pending.context !== undefined) {
    const pendingEntries = pending.context.entries;
    const entries: ContextEntry[] = [];

    if (pendingEntries !== undefined) {
      for (const [index, entry] of pendingEntries.entries()) {
        const entryIdResult = allocateIdentifier(
          entry.entryId,
          'context_entry',
          `context.entries[${index}].entryId`,
          allocator,
          usedIdentifiers,
        );
        if (!entryIdResult.ok) {
          return entryIdResult;
        }

        entries.push({
          entryId: entryIdResult.value,
          label: entry.label as ShortText,
          value: entry.value as LongText,
        });
      }
    }

    context = {
      ...(pending.context.summary === undefined
        ? {}
        : { summary: pending.context.summary as LongText }),
      ...(pendingEntries === undefined ? {} : { entries }),
    };
  }

  const milestones: Milestone[] = [];
  for (const [milestoneIndex, pendingMilestone] of pending.milestones.entries()) {
    const milestoneIdResult = allocateIdentifier(
      pendingMilestone.milestoneId,
      'milestone',
      `milestones[${milestoneIndex}].milestoneId`,
      allocator,
      usedIdentifiers,
    );
    if (!milestoneIdResult.ok) {
      return milestoneIdResult;
    }

    const topics: Topic[] = [];
    for (const [topicIndex, pendingTopic] of pendingMilestone.topics.entries()) {
      const topicIdResult = allocateIdentifier(
        pendingTopic.topicId,
        'topic',
        `milestones[${milestoneIndex}].topics[${topicIndex}].topicId`,
        allocator,
        usedIdentifiers,
      );
      if (!topicIdResult.ok) {
        return topicIdResult;
      }

      const items: PlanItem[] = [];
      for (const [itemIndex, pendingItem] of pendingTopic.items.entries()) {
        const itemIdResult = allocateIdentifier(
          pendingItem.itemId,
          'plan_item',
          `milestones[${milestoneIndex}].topics[${topicIndex}].items[${itemIndex}].itemId`,
          allocator,
          usedIdentifiers,
        );
        if (!itemIdResult.ok) {
          return itemIdResult;
        }

        let resources: Resource[] | undefined;
        if (pendingItem.resources !== undefined) {
          resources = [];
          for (const [resourceIndex, pendingResource] of pendingItem.resources.entries()) {
            const resourceIdResult = allocateIdentifier(
              pendingResource.resourceId,
              'resource',
              `milestones[${milestoneIndex}].topics[${topicIndex}].items[${itemIndex}].resources[${resourceIndex}].resourceId`,
              allocator,
              usedIdentifiers,
            );
            if (!resourceIdResult.ok) {
              return resourceIdResult;
            }

            const resource: Resource = {
              resourceId: resourceIdResult.value,
              label: pendingResource.label as ShortText,
              ...(pendingResource.href === undefined
                ? {}
                : { href: pendingResource.href as SafeHttpsUrl }),
              ...(pendingResource.opaqueReference === undefined
                ? {}
                : {
                    opaqueReference: pendingResource.opaqueReference as BoundedOpaqueText,
                  }),
            };
            resources.push(resource);
          }
        }

        items.push({
          itemId: itemIdResult.value,
          title: pendingItem.title as ShortText,
          ...(pendingItem.description === undefined
            ? {}
            : { description: pendingItem.description as LongText }),
          ...(resources === undefined ? {} : { resources }),
        });
      }

      const topic: Topic = {
        topicId: topicIdResult.value,
        title: pendingTopic.title as ShortText,
        items: asNonEmpty(items),
        ...(pendingTopic.description === undefined
          ? {}
          : { description: pendingTopic.description as LongText }),
      };
      topics.push(topic);
    }

    const milestone: Milestone = {
      milestoneId: milestoneIdResult.value,
      title: pendingMilestone.title as ShortText,
      topics: asNonEmpty(topics),
      ...(pendingMilestone.description === undefined
        ? {}
        : { description: pendingMilestone.description as LongText }),
    };
    milestones.push(milestone);
  }

  const normalized: NormalizedPlanContent = {
    ...(pending.title === undefined ? {} : { title: pending.title as ShortText }),
    goal,
    ...(context === undefined ? {} : { context }),
    milestones: asNonEmpty(milestones),
    missingOptionalPaths,
  };

  return succeed(normalized);
};

export const normalizePlanContent = (
  input: unknown,
  allocator: IdentityAllocator,
): DomainResult<NormalizedPlanContent> => {
  const state: ParseState = {
    missingOptionalPaths: [],
    suppliedIdentifiers: new Set<string>(),
    canonicalTextLength: 0,
    topicCount: 0,
    itemCount: 0,
  };

  const candidateResult = readCandidate(input, state);
  if (!candidateResult.ok) {
    return candidateResult;
  }

  const normalizedResult = materializeCandidate(
    candidateResult.value,
    allocator,
    state.missingOptionalPaths,
  );
  if (!normalizedResult.ok) {
    return normalizedResult;
  }

  return normalizedResult;
};
