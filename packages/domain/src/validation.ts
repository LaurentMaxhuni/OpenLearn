import { DOMAIN_LIMITS } from './limits.js';
import {
  fail,
  succeed,
  type DomainErrorCode,
  type DomainErrorDetail,
  type DomainFailure,
  type DomainResult,
} from './errors.js';
import { brandIdentifier } from './identity.js';
import type {
  CanonicalPlanContent,
  ContextEntry,
  Goal,
  Milestone,
  PlanItem,
  Resource,
  Topic,
} from './types.js';

type RuntimeRecord = Record<string, unknown>;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const EXECUTABLE_TEXT_PATTERN =
  /<\s*\/?\s*(?:script|iframe|object|embed|style|link)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|vbscript):/iu;

const isRecord = (value: unknown): value is RuntimeRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (record: RuntimeRecord, key: string): boolean =>
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

const invalidType = (path: string) => fail('malformed_input', [detail(path, 'wrong_type')]);

const invalidNull = (path: string) =>
  fail('malformed_input', [detail(path, 'null_not_allowed')]);

const unknownFieldFailure = (
  record: RuntimeRecord,
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

const validateText = (
  value: unknown,
  path: string,
  maxLength: number,
  optional: boolean,
): DomainResult<string | undefined> => {
  if (value === undefined) {
    return optional
      ? succeed(undefined)
      : fail('missing_required', [detail(path, 'missing_field')]);
  }
  if (value === null) {
    return invalidNull(path);
  }
  if (typeof value !== 'string') {
    return invalidType(path);
  }
  if (value.length === 0) {
    return optional
      ? succeed(undefined)
      : fail('missing_required', [detail(path, 'empty')]);
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return fail('unsafe_content', [detail(path, 'control_character')]);
  }
  if (EXECUTABLE_TEXT_PATTERN.test(value)) {
    return fail('unsafe_content', [detail(path, 'unsafe_value')]);
  }
  if (Array.from(value).length > maxLength) {
    return fail('too_large', [detail(path, 'too_long', { limit: maxLength })]);
  }
  return succeed(value);
};

const validateIdentifier = (
  value: unknown,
  path: string,
  kind: Parameters<typeof brandIdentifier>[0],
): DomainResult<string> => {
  if (value === undefined) {
    return fail('missing_required', [detail(path, 'missing_field')]);
  }
  if (value === null) {
    return invalidNull(path);
  }
  if (typeof value !== 'string') {
    return invalidType(path);
  }

  const result = brandIdentifier(kind, value);
  if (!result.ok) {
    return fail('invalid_identifier', detailsWithPath(path, result.details));
  }
  return succeed(value);
};

const validateUrl = (value: unknown, path: string): DomainResult<string | undefined> => {
  const textResult = validateText(
    value,
    path,
    DOMAIN_LIMITS.safeHttpsUrl.maxLength,
    true,
  );
  if (!textResult.ok || textResult.value === undefined) {
    return textResult;
  }

  let parsed: URL;
  try {
    parsed = new URL(textResult.value);
  } catch {
    return fail('unsafe_content', [detail(path, 'invalid_syntax')]);
  }

  if (parsed.protocol !== 'https:' || parsed.username.length > 0 || parsed.password.length > 0) {
    return fail('unsafe_content', [detail(path, 'unsafe_value')]);
  }

  return succeed(textResult.value);
};

const validateRecord = (value: unknown, path: string): DomainResult<RuntimeRecord> => {
  if (value === null) {
    return invalidNull(path);
  }
  if (!isRecord(value)) {
    return invalidType(path);
  }
  return succeed(value);
};

interface ValidationState {
  readonly identifiers: Set<string>;
  readonly nodes: WeakSet<object>;
  canonicalTextLength: number;
  topicCount: number;
  itemCount: number;
}

const registerNode = (value: RuntimeRecord, path: string, state: ValidationState): DomainResult<void> => {
  if (state.nodes.has(value)) {
    return fail('invalid_relationship', [detail(path, 'relationship_mismatch')]);
  }
  state.nodes.add(value);
  return succeed(undefined);
};

const validateTextWithTotal = (
  value: unknown,
  path: string,
  maxLength: number,
  optional: boolean,
  state: ValidationState,
): DomainResult<string | undefined> => {
  const result = validateText(value, path, maxLength, optional);
  if (!result.ok || result.value === undefined) {
    return result;
  }

  const scalarLength = Array.from(result.value).length;
  if (
    state.canonicalTextLength + scalarLength >
    DOMAIN_LIMITS.canonicalText.maxLength
  ) {
    return fail('too_large', [
      detail(path, 'limit_exceeded', { limit: DOMAIN_LIMITS.canonicalText.maxLength }),
    ]);
  }
  state.canonicalTextLength += scalarLength;
  return result;
};

const validateResource = (
  value: unknown,
  path: string,
  state: ValidationState,
): DomainResult<Resource> => {
  const recordResult = validateRecord(value, path);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const nodeResult = registerNode(record, path, state);
  if (!nodeResult.ok) {
    return nodeResult;
  }

  const unknown = unknownFieldFailure(
    record,
    ['resourceId', 'label', 'href', 'opaqueReference'],
    path,
  );
  if (unknown) {
    return unknown;
  }

  const idResult = validateIdentifier(record.resourceId, childPath(path, 'resourceId'), 'resource');
  if (!idResult.ok) {
    return idResult;
  }
  if (state.identifiers.has(idResult.value)) {
    return fail('duplicate_identifier', [detail(childPath(path, 'resourceId'), 'duplicate_value')]);
  }
  state.identifiers.add(idResult.value);

  const labelResult = validateTextWithTotal(
    record.label,
    childPath(path, 'label'),
    DOMAIN_LIMITS.shortText.maxLength,
    false,
    state,
  );
  if (!labelResult.ok || labelResult.value === undefined) {
    return labelResult.ok ? fail('missing_required', [detail(childPath(path, 'label'), 'empty')]) : labelResult;
  }

  const hrefResult = validateUrl(record.href, childPath(path, 'href'));
  if (!hrefResult.ok) {
    return hrefResult;
  }
  const opaqueResult = validateTextWithTotal(
    record.opaqueReference,
    childPath(path, 'opaqueReference'),
    DOMAIN_LIMITS.boundedOpaqueText.maxLength,
    true,
    state,
  );
  if (!opaqueResult.ok) {
    return opaqueResult;
  }

  const resource: Resource = {
    resourceId: idResult.value as Resource['resourceId'],
    label: labelResult.value as Resource['label'],
    ...(hrefResult.value === undefined
      ? {}
      : { href: hrefResult.value as NonNullable<Resource['href']> }),
    ...(opaqueResult.value === undefined
      ? {}
      : {
          opaqueReference: opaqueResult.value as NonNullable<Resource['opaqueReference']>,
        }),
  };
  return succeed(resource);
};

const validatePlanItem = (
  value: unknown,
  path: string,
  state: ValidationState,
): DomainResult<PlanItem> => {
  const recordResult = validateRecord(value, path);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const nodeResult = registerNode(record, path, state);
  if (!nodeResult.ok) {
    return nodeResult;
  }
  const unknown = unknownFieldFailure(record, ['itemId', 'title', 'description', 'resources'], path);
  if (unknown) {
    return unknown;
  }

  const idResult = validateIdentifier(record.itemId, childPath(path, 'itemId'), 'plan_item');
  if (!idResult.ok) {
    return idResult;
  }
  if (state.identifiers.has(idResult.value)) {
    return fail('duplicate_identifier', [detail(childPath(path, 'itemId'), 'duplicate_value')]);
  }
  state.identifiers.add(idResult.value);

  const titleResult = validateTextWithTotal(
    record.title,
    childPath(path, 'title'),
    DOMAIN_LIMITS.shortText.maxLength,
    false,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? fail('missing_required', [detail(childPath(path, 'title'), 'empty')]) : titleResult;
  }
  const descriptionResult = validateTextWithTotal(
    record.description,
    childPath(path, 'description'),
    DOMAIN_LIMITS.longText.maxLength,
    true,
    state,
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const resourcesValue = record.resources;
  if (resourcesValue !== undefined && resourcesValue === null) {
    return invalidNull(childPath(path, 'resources'));
  }
  if (resourcesValue !== undefined && !Array.isArray(resourcesValue)) {
    return invalidType(childPath(path, 'resources'));
  }
  if (Array.isArray(resourcesValue) && resourcesValue.length > DOMAIN_LIMITS.resourcesPerItem.max) {
    return fail('too_large', [
      detail(childPath(path, 'resources'), 'limit_exceeded', {
        limit: DOMAIN_LIMITS.resourcesPerItem.max,
      }),
    ]);
  }

  const resources: Resource[] = [];
  if (Array.isArray(resourcesValue)) {
    for (const [index, resource] of resourcesValue.entries()) {
      const resourceResult = validateResource(
        resource,
        indexedPath(path, 'resources', index),
        state,
      );
      if (!resourceResult.ok) {
        return resourceResult;
      }
      resources.push(resourceResult.value);
    }
  }

  const item: PlanItem = {
    itemId: idResult.value as PlanItem['itemId'],
    title: titleResult.value as PlanItem['title'],
    ...(descriptionResult.value === undefined
      ? {}
      : {
          description: descriptionResult.value as NonNullable<PlanItem['description']>,
        }),
    ...(resourcesValue === undefined ? {} : { resources }),
  };

  return succeed(item);
};

const validateTopic = (
  value: unknown,
  path: string,
  state: ValidationState,
): DomainResult<Topic> => {
  const recordResult = validateRecord(value, path);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const nodeResult = registerNode(record, path, state);
  if (!nodeResult.ok) {
    return nodeResult;
  }
  const unknown = unknownFieldFailure(record, ['topicId', 'title', 'description', 'items'], path);
  if (unknown) {
    return unknown;
  }

  const idResult = validateIdentifier(record.topicId, childPath(path, 'topicId'), 'topic');
  if (!idResult.ok) {
    return idResult;
  }
  if (state.identifiers.has(idResult.value)) {
    return fail('duplicate_identifier', [detail(childPath(path, 'topicId'), 'duplicate_value')]);
  }
  state.identifiers.add(idResult.value);

  const titleResult = validateTextWithTotal(
    record.title,
    childPath(path, 'title'),
    DOMAIN_LIMITS.shortText.maxLength,
    false,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? fail('missing_required', [detail(childPath(path, 'title'), 'empty')]) : titleResult;
  }
  const descriptionResult = validateTextWithTotal(
    record.description,
    childPath(path, 'description'),
    DOMAIN_LIMITS.longText.maxLength,
    true,
    state,
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const itemsValue = record.items;
  if (!Array.isArray(itemsValue)) {
    return itemsValue === null
      ? invalidNull(childPath(path, 'items'))
      : invalidType(childPath(path, 'items'));
  }
  if (itemsValue.length === 0) {
    return fail('invalid_relationship', [
      detail(childPath(path, 'items'), 'relationship_mismatch'),
    ]);
  }
  if (
    state.itemCount + itemsValue.length >
    DOMAIN_LIMITS.planItemsPerPlan.max
  ) {
    return fail('too_large', [
      detail(childPath(path, 'items'), 'limit_exceeded', {
        limit: DOMAIN_LIMITS.planItemsPerPlan.max,
      }),
    ]);
  }
  state.itemCount += itemsValue.length;

  const items: PlanItem[] = [];
  for (const [index, item] of itemsValue.entries()) {
    const itemResult = validatePlanItem(item, indexedPath(path, 'items', index), state);
    if (!itemResult.ok) {
      return itemResult;
    }
    items.push(itemResult.value);
  }

  state.topicCount += 1;
  if (state.topicCount > DOMAIN_LIMITS.topicsPerPlan.max) {
    return fail('too_large', [
      detail(path, 'limit_exceeded', { limit: DOMAIN_LIMITS.topicsPerPlan.max }),
    ]);
  }

  const topic: Topic = {
    topicId: idResult.value as Topic['topicId'],
    title: titleResult.value as Topic['title'],
    items: items as unknown as Topic['items'],
    ...(descriptionResult.value === undefined
      ? {}
      : {
          description: descriptionResult.value as NonNullable<Topic['description']>,
        }),
  };
  return succeed(topic);
};

const validateMilestone = (
  value: unknown,
  path: string,
  state: ValidationState,
): DomainResult<Milestone> => {
  const recordResult = validateRecord(value, path);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const nodeResult = registerNode(record, path, state);
  if (!nodeResult.ok) {
    return nodeResult;
  }
  const unknown = unknownFieldFailure(record, ['milestoneId', 'title', 'description', 'topics'], path);
  if (unknown) {
    return unknown;
  }

  const idResult = validateIdentifier(record.milestoneId, childPath(path, 'milestoneId'), 'milestone');
  if (!idResult.ok) {
    return idResult;
  }
  if (state.identifiers.has(idResult.value)) {
    return fail('duplicate_identifier', [detail(childPath(path, 'milestoneId'), 'duplicate_value')]);
  }
  state.identifiers.add(idResult.value);

  const titleResult = validateTextWithTotal(
    record.title,
    childPath(path, 'title'),
    DOMAIN_LIMITS.shortText.maxLength,
    false,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? fail('missing_required', [detail(childPath(path, 'title'), 'empty')]) : titleResult;
  }
  const descriptionResult = validateTextWithTotal(
    record.description,
    childPath(path, 'description'),
    DOMAIN_LIMITS.longText.maxLength,
    true,
    state,
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const topicsValue = record.topics;
  if (!Array.isArray(topicsValue)) {
    return topicsValue === null
      ? invalidNull(childPath(path, 'topics'))
      : invalidType(childPath(path, 'topics'));
  }
  if (topicsValue.length === 0) {
    return fail('invalid_relationship', [
      detail(childPath(path, 'topics'), 'relationship_mismatch'),
    ]);
  }
  if (
    state.topicCount + topicsValue.length >
    DOMAIN_LIMITS.topicsPerPlan.max
  ) {
    return fail('too_large', [
      detail(childPath(path, 'topics'), 'limit_exceeded', {
        limit: DOMAIN_LIMITS.topicsPerPlan.max,
      }),
    ]);
  }
  state.topicCount += topicsValue.length;

  const topics: Topic[] = [];
  for (const [index, topic] of topicsValue.entries()) {
    const topicResult = validateTopic(topic, indexedPath(path, 'topics', index), state);
    if (!topicResult.ok) {
      return topicResult;
    }
    topics.push(topicResult.value);
  }

  const milestone: Milestone = {
    milestoneId: idResult.value as Milestone['milestoneId'],
    title: titleResult.value as Milestone['title'],
    topics: topics as unknown as Milestone['topics'],
    ...(descriptionResult.value === undefined
      ? {}
      : {
          description: descriptionResult.value as NonNullable<Milestone['description']>,
        }),
  };
  return succeed(milestone);
};

const validateGoal = (
  value: unknown,
  path: string,
  state: ValidationState,
): DomainResult<Goal> => {
  const recordResult = validateRecord(value, path);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const nodeResult = registerNode(record, path, state);
  if (!nodeResult.ok) {
    return nodeResult;
  }
  const unknown = unknownFieldFailure(record, ['goalId', 'title', 'description'], path);
  if (unknown) {
    return unknown;
  }

  const idResult = validateIdentifier(record.goalId, childPath(path, 'goalId'), 'goal');
  if (!idResult.ok) {
    return idResult;
  }
  if (state.identifiers.has(idResult.value)) {
    return fail('duplicate_identifier', [detail(childPath(path, 'goalId'), 'duplicate_value')]);
  }
  state.identifiers.add(idResult.value);

  const titleResult = validateTextWithTotal(
    record.title,
    childPath(path, 'title'),
    DOMAIN_LIMITS.shortText.maxLength,
    false,
    state,
  );
  if (!titleResult.ok || titleResult.value === undefined) {
    return titleResult.ok ? fail('missing_required', [detail(childPath(path, 'title'), 'empty')]) : titleResult;
  }
  const descriptionResult = validateTextWithTotal(
    record.description,
    childPath(path, 'description'),
    DOMAIN_LIMITS.longText.maxLength,
    true,
    state,
  );
  if (!descriptionResult.ok) {
    return descriptionResult;
  }

  const goal: Goal = {
    goalId: idResult.value as Goal['goalId'],
    title: titleResult.value as Goal['title'],
    ...(descriptionResult.value === undefined
      ? {}
      : {
          description: descriptionResult.value as NonNullable<Goal['description']>,
        }),
  };
  return succeed(goal);
};

export const validatePlanCandidate = (
  candidate: unknown,
): DomainResult<CanonicalPlanContent> => {
  const rootResult = validateRecord(candidate, '');
  if (!rootResult.ok) {
    return rootResult;
  }
  const root = rootResult.value;
  const unknown = unknownFieldFailure(
    root,
    ['title', 'goal', 'context', 'milestones', 'missingOptionalPaths'],
    '',
  );
  if (unknown) {
    return unknown;
  }

  const state: ValidationState = {
    identifiers: new Set<string>(),
    nodes: new WeakSet<object>(),
    canonicalTextLength: 0,
    topicCount: 0,
    itemCount: 0,
  };

  const titleResult = validateTextWithTotal(
    root.title,
    'title',
    DOMAIN_LIMITS.shortText.maxLength,
    true,
    state,
  );
  if (!titleResult.ok) {
    return titleResult;
  }

  const goalResult = validateGoal(root.goal, 'goal', state);
  if (!goalResult.ok) {
    return goalResult;
  }

  if (root.context !== undefined && root.context !== null && !isRecord(root.context)) {
    return invalidType('context');
  }
  if (root.context === null) {
    return invalidNull('context');
  }
  if (root.context !== undefined) {
    const context = root.context as RuntimeRecord;
    const nodeResult = registerNode(context, 'context', state);
    if (!nodeResult.ok) {
      return nodeResult;
    }
    const unknownContext = unknownFieldFailure(context, ['summary', 'entries'], 'context');
    if (unknownContext) {
      return unknownContext;
    }
    const summaryResult = validateTextWithTotal(
      context.summary,
      'context.summary',
      DOMAIN_LIMITS.longText.maxLength,
      true,
      state,
    );
    if (!summaryResult.ok) {
      return summaryResult;
    }
    const entriesValue = context.entries;
    if (entriesValue !== undefined && entriesValue !== null && !Array.isArray(entriesValue)) {
      return invalidType('context.entries');
    }
    if (entriesValue === null) {
      return invalidNull('context.entries');
    }
    if (Array.isArray(entriesValue) && entriesValue.length > DOMAIN_LIMITS.contextEntries.max) {
      return fail('too_large', [
        detail('context.entries', 'limit_exceeded', {
          limit: DOMAIN_LIMITS.contextEntries.max,
        }),
      ]);
    }
    if (Array.isArray(entriesValue)) {
      for (const [index, entry] of entriesValue.entries()) {
        const entryResult = validateRecord(entry, indexedPath('context', 'entries', index));
        if (!entryResult.ok) {
          return entryResult;
        }
        const entryRecord = entryResult.value;
        const entryPath = indexedPath('context', 'entries', index);
        const entryNodeResult = registerNode(entryRecord, entryPath, state);
        if (!entryNodeResult.ok) {
          return entryNodeResult;
        }
        const unknownEntry = unknownFieldFailure(entryRecord, ['entryId', 'label', 'value'], entryPath);
        if (unknownEntry) {
          return unknownEntry;
        }
        const entryIdResult = validateIdentifier(
          entryRecord.entryId,
          childPath(entryPath, 'entryId'),
          'context_entry',
        );
        if (!entryIdResult.ok) {
          return entryIdResult;
        }
        if (state.identifiers.has(entryIdResult.value)) {
          return fail('duplicate_identifier', [detail(childPath(entryPath, 'entryId'), 'duplicate_value')]);
        }
        state.identifiers.add(entryIdResult.value);
        const labelResult = validateTextWithTotal(
          entryRecord.label,
          childPath(entryPath, 'label'),
          DOMAIN_LIMITS.shortText.maxLength,
          false,
          state,
        );
        if (!labelResult.ok) {
          return labelResult;
        }
        const valueResult = validateTextWithTotal(
          entryRecord.value,
          childPath(entryPath, 'value'),
          DOMAIN_LIMITS.longText.maxLength,
          false,
          state,
        );
        if (!valueResult.ok) {
          return valueResult;
        }
      }
    }
  }

  const milestonesValue = root.milestones;
  if (!Array.isArray(milestonesValue)) {
    return milestonesValue === null
      ? invalidNull('milestones')
      : invalidType('milestones');
  }
  if (milestonesValue.length === 0) {
    return fail('invalid_relationship', [detail('milestones', 'relationship_mismatch')]);
  }
  if (milestonesValue.length > DOMAIN_LIMITS.milestones.max) {
    return fail('too_large', [
      detail('milestones', 'limit_exceeded', { limit: DOMAIN_LIMITS.milestones.max }),
    ]);
  }

  const milestones: Milestone[] = [];
  for (const [index, milestone] of milestonesValue.entries()) {
    const milestoneResult = validateMilestone(milestone, `milestones[${index}]`, state);
    if (!milestoneResult.ok) {
      return milestoneResult;
    }
    milestones.push(milestoneResult.value);
  }

  if (root.missingOptionalPaths !== undefined) {
    if (!Array.isArray(root.missingOptionalPaths)) {
      return invalidType('missingOptionalPaths');
    }
    for (const [index, path] of root.missingOptionalPaths.entries()) {
      if (typeof path !== 'string') {
        return invalidType(`missingOptionalPaths[${index}]`);
      }
    }
  }

  return succeed(candidate as CanonicalPlanContent);
};
