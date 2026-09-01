import { brandIdentifier, type ActivePlanAggregate, type LearnerProgressRecord } from '@openlearn/domain';

export const PROGRESS_STORAGE_KEY = 'openlearn.dashboard.progress.v1';

export interface DashboardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressStore {
  hydrate(plan: ActivePlanAggregate): ActivePlanAggregate;
  save(
    plan: ActivePlanAggregate,
    expectedPlan?: ActivePlanAggregate,
  ): ProgressStoreSaveResult;
}

export type ProgressStoreSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind?: 'conflict' };

interface StoredDocument {
  readonly version: 1;
  readonly plans: Readonly<Record<string, unknown>>;
}

type ReadDocumentResult =
  | { readonly ok: true; readonly document: StoredDocument }
  | { readonly ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/u.exec(
    value,
  );
  if (match === null) {
    return false;
  }

  const milliseconds = Date.parse(value);
  if (Number.isNaN(milliseconds)) {
    return false;
  }

  const canonical = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7] ?? '.000'}Z`;
  return new Date(milliseconds).toISOString() === canonical;
};

const readDocument = (storage: DashboardStorage | undefined): ReadDocumentResult => {
  if (storage === undefined) {
    return { ok: false };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    return { ok: false };
  }

  if (raw === null) {
    return { ok: true, document: { version: 1, plans: {} } };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.plans)) {
      return { ok: false };
    }
    return {
      ok: true,
      document: {
        version: 1,
        plans: parsed.plans,
      },
    };
  } catch {
    return { ok: false };
  }
};

const currentItemIds = (plan: ActivePlanAggregate): ReadonlySet<string> =>
  new Set(
    plan.content.milestones.flatMap((milestone) =>
      milestone.topics.flatMap((topic) => topic.items.map((item) => item.itemId)),
    ),
  );

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const parseProgressRecord = (
  value: unknown,
  expectedPlanId?: string,
): LearnerProgressRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const ownerId =
    typeof value.ownerId === 'string'
      ? brandIdentifier('internal_owner', value.ownerId)
      : undefined;
  const planId =
    typeof value.planId === 'string'
      ? brandIdentifier('plan', value.planId)
      : undefined;
  const itemId =
    typeof value.itemId === 'string'
      ? brandIdentifier('plan_item', value.itemId)
      : undefined;
  if (
    !hasOnlyKeys(value, [
      'ownerId',
      'planId',
      'itemId',
      'state',
      'progressVersion',
      'lastConfirmedAt',
      'lastNonCompleteState',
    ]) ||
    ownerId === undefined ||
    !ownerId.ok ||
    planId === undefined ||
    !planId.ok ||
    (expectedPlanId !== undefined && planId.value !== expectedPlanId) ||
    itemId === undefined ||
    !itemId.ok ||
    (value.state !== 'not_started' &&
      value.state !== 'in_progress' &&
      value.state !== 'completed_by_learner') ||
    typeof value.progressVersion !== 'number' ||
    !Number.isSafeInteger(value.progressVersion) ||
    value.progressVersion < 0 ||
    !isUtcTimestamp(value.lastConfirmedAt)
  ) {
    return undefined;
  }

  if (value.state === 'completed_by_learner') {
    if (
      value.lastNonCompleteState !== undefined &&
      value.lastNonCompleteState !== 'not_started' &&
      value.lastNonCompleteState !== 'in_progress'
    ) {
      return undefined;
    }
    return {
      ownerId: ownerId.value,
      planId: planId.value,
      itemId: itemId.value,
      state: value.state,
      progressVersion: value.progressVersion,
      lastConfirmedAt: value.lastConfirmedAt as LearnerProgressRecord['lastConfirmedAt'],
      ...(value.lastNonCompleteState === undefined
        ? {}
        : { lastNonCompleteState: value.lastNonCompleteState }),
    };
  }

  if (Object.prototype.hasOwnProperty.call(value, 'lastNonCompleteState')) {
    return undefined;
  }
  return {
    ownerId: ownerId.value,
    planId: planId.value,
    itemId: itemId.value,
    state: value.state,
    progressVersion: value.progressVersion,
    lastConfirmedAt: value.lastConfirmedAt as LearnerProgressRecord['lastConfirmedAt'],
  };
};

const progressRecord = (
  value: unknown,
  plan: ActivePlanAggregate,
  itemIds: ReadonlySet<string>,
): LearnerProgressRecord | undefined => {
  const record = parseProgressRecord(value, plan.planId);
  return record === undefined || record.ownerId !== plan.ownerId || !itemIds.has(record.itemId)
    ? undefined
    : record;
};

const progressRecords = (
  value: unknown,
  plan: ActivePlanAggregate,
): readonly LearnerProgressRecord[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const itemIds = currentItemIds(plan);
  const records: LearnerProgressRecord[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const record = progressRecord(entry, plan, itemIds);
    if (record === undefined || seen.has(record.itemId)) {
      return undefined;
    }
    seen.add(record.itemId);
    records.push(record);
  }
  return records;
};

const storedProgressRecords = (
  value: unknown,
  planId: string,
): readonly LearnerProgressRecord[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const records: LearnerProgressRecord[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const record = parseProgressRecord(entry, planId);
    if (record === undefined || seen.has(record.itemId)) {
      continue;
    }
    seen.add(record.itemId);
    records.push(record);
  }
  return records;
};

const sanitizedStoredPlans = (
  plans: Readonly<Record<string, unknown>>,
): Record<string, readonly LearnerProgressRecord[]> => {
  const sanitized: Record<string, readonly LearnerProgressRecord[]> = {};
  for (const [planId, value] of Object.entries(plans)) {
    if (!brandIdentifier('plan', planId).ok) {
      continue;
    }
    const records = storedProgressRecords(value, planId);
    if (records !== undefined) {
      sanitized[planId] = records;
    }
  }
  return sanitized;
};

const progressFingerprint = (
  records: readonly LearnerProgressRecord[],
): string =>
  JSON.stringify(
    [...records]
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
      .map((record) => [
        record.ownerId,
        record.planId,
        record.itemId,
        record.state,
        record.progressVersion,
        record.lastConfirmedAt,
        record.lastNonCompleteState ?? null,
      ]),
  );

export const createProgressStore = (
  storage?: DashboardStorage,
): ProgressStore => ({
  hydrate(plan) {
    const result = readDocument(storage);
    if (!result.ok) {
      return plan;
    }

    const stored = result.document.plans[plan.planId];
    if (stored === undefined) {
      return plan;
    }
    const progress = progressRecords(stored, plan);
    return progress === undefined ? plan : { ...plan, progress };
  },

  save(plan, expectedPlan) {
    const result = readDocument(storage);
    if (!result.ok || storage === undefined) {
      return { ok: false };
    }

    if (
      expectedPlan !== undefined &&
      (expectedPlan.ownerId !== plan.ownerId || expectedPlan.planId !== plan.planId)
    ) {
      return { ok: false };
    }

    const nextProgress = progressRecords(plan.progress, plan);
    if (nextProgress === undefined) {
      return { ok: false };
    }

    const latest = readDocument(storage);
    if (!latest.ok) {
      return { ok: false };
    }

    if (expectedPlan !== undefined) {
      const expectedProgress = progressRecords(expectedPlan.progress, expectedPlan);
      if (expectedProgress === undefined) {
        return { ok: false };
      }
      const persistedProgress =
        storedProgressRecords(latest.document.plans[plan.planId], plan.planId) ?? [];
      if (progressFingerprint(persistedProgress) !== progressFingerprint(expectedProgress)) {
        return { ok: false, kind: 'conflict' };
      }
    }

    try {
      const plans = sanitizedStoredPlans(latest.document.plans);
      plans[plan.planId] = nextProgress;
      storage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ version: 1, plans }),
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
});
