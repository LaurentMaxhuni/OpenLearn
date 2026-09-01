import {
  brandIdentifier,
  createPersonalizationState,
  PERSONALIZATION_FEEDBACK_VALUES,
  validatePersonalizationState,
  type ActivePlanAggregate,
  type LearnerFeedback,
  type PersonalizationConsent,
  type PersonalizationProposal,
  type PersonalizationProposalParameters,
  type PersonalizationState,
  type Timestamp,
} from '@openlearn/domain';

export const PERSONALIZATION_STORAGE_KEY =
  'openlearn.dashboard.personalization.v1';

export interface PersonalizationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PersonalizationStoreSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind?: 'conflict' };

export interface PersonalizationStore {
  hydrate(plan: ActivePlanAggregate, now: string): PersonalizationState;
  save(
    state: PersonalizationState,
    expectedStateVersion?: number,
  ): PersonalizationStoreSaveResult;
  purge(
    ownerId: string,
    planId: string,
    expectedStateVersion?: number,
  ): PersonalizationStoreSaveResult;
}

interface StoredDocument {
  readonly version: 1;
  readonly plans: Readonly<Record<string, unknown>>;
}

type ReadDocumentResult =
  | { readonly ok: true; readonly document: StoredDocument }
  | { readonly ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const isUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/u.exec(
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

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  isNonNegativeInteger(value) && value > 0;

const isConsentState = (
  value: unknown,
): PersonalizationConsent['state'] | undefined =>
  value === 'disabled' ||
  value === 'enabled' ||
  value === 'paused' ||
  value === 'revoked'
    ? value
    : undefined;

const isFeedbackArea = (
  value: unknown,
): LearnerFeedback['area'] | undefined =>
  value === 'difficulty' || value === 'pace' || value === 'relevance'
    ? value
    : undefined;

const isFeedbackStatus = (
  value: unknown,
): LearnerFeedback['status'] | undefined =>
  value === 'active' || value === 'corrected' || value === 'deleted'
    ? value
    : undefined;

const isProposalBasis = (
  value: unknown,
): PersonalizationProposal['basis'][number] | undefined =>
  value === 'confirmed_progress' ||
  value === 'difficulty_feedback' ||
  value === 'pace_feedback' ||
  value === 'relevance_feedback'
    ? value
    : undefined;

const isProposalStatus = (
  value: unknown,
): PersonalizationProposal['status'] | undefined =>
  value === 'proposed' ||
  value === 'accepted' ||
  value === 'rejected' ||
  value === 'withdrawn' ||
  value === 'expired'
    ? value
    : undefined;

const isPacingPreference = (
  value: unknown,
): Extract<PersonalizationProposalParameters, { readonly kind: 'suggest_pacing_preference' }>['preference'] | undefined =>
  value === 'slower' || value === 'steady' || value === 'faster'
    ? value
    : undefined;

const isRevisionReason = (
  value: unknown,
): Extract<PersonalizationProposalParameters, { readonly kind: 'request_plan_revision' }>['reason'] | undefined =>
  value === 'difficulty' || value === 'pace' || value === 'relevance'
    ? value
    : undefined;

const readDocument = (
  storage: PersonalizationStorage | undefined,
): ReadDocumentResult => {
  if (storage === undefined) {
    return { ok: false };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(PERSONALIZATION_STORAGE_KEY);
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
      document: { version: 1, plans: parsed.plans },
    };
  } catch {
    return { ok: false };
  }
};

const parseFeedback = (
  value: unknown,
  expectedOwnerId: string,
  expectedPlanId: string,
): LearnerFeedback | undefined => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'feedbackId',
      'ownerId',
      'planId',
      'itemId',
      'area',
      'value',
      'recordedAt',
      'consentVersion',
      'status',
      'supersedesFeedbackId',
    ])
  ) {
    return undefined;
  }
  const feedbackId =
    typeof value.feedbackId === 'string'
      ? brandIdentifier('feedback', value.feedbackId)
      : undefined;
  const ownerId =
    typeof value.ownerId === 'string'
      ? brandIdentifier('internal_owner', value.ownerId)
      : undefined;
  const planId =
    typeof value.planId === 'string'
      ? brandIdentifier('plan', value.planId)
      : undefined;
  const itemId =
    value.itemId === undefined
      ? undefined
      : typeof value.itemId === 'string'
        ? brandIdentifier('plan_item', value.itemId)
        : undefined;
  const supersedesFeedbackId =
    value.supersedesFeedbackId === undefined
      ? undefined
      : typeof value.supersedesFeedbackId === 'string'
        ? brandIdentifier('feedback', value.supersedesFeedbackId)
        : undefined;
  const area = isFeedbackArea(value.area);
  const validValue =
    area === undefined
      ? false
      : (PERSONALIZATION_FEEDBACK_VALUES[area] as readonly unknown[]).includes(
          value.value,
        );
  const status = isFeedbackStatus(value.status);
  if (
    feedbackId === undefined ||
    !feedbackId.ok ||
    ownerId === undefined ||
    !ownerId.ok ||
    ownerId.value !== expectedOwnerId ||
    planId === undefined ||
    !planId.ok ||
    planId.value !== expectedPlanId ||
    (value.itemId !== undefined && (itemId === undefined || !itemId.ok)) ||
    area === undefined ||
    !validValue ||
    typeof value.recordedAt !== 'string' ||
    !isUtcTimestamp(value.recordedAt) ||
    !isPositiveInteger(value.consentVersion) ||
    status === undefined ||
    (value.supersedesFeedbackId !== undefined &&
      (supersedesFeedbackId === undefined || !supersedesFeedbackId.ok))
  ) {
    return undefined;
  }
  const itemIdValue =
    itemId !== undefined && itemId.ok ? itemId.value : undefined;
  const supersedesFeedbackIdValue =
    supersedesFeedbackId !== undefined && supersedesFeedbackId.ok
      ? supersedesFeedbackId.value
      : undefined;
  return {
    feedbackId: feedbackId.value,
    ownerId: ownerId.value,
    planId: planId.value,
    ...(itemIdValue === undefined ? {} : { itemId: itemIdValue }),
    area,
    value: value.value as LearnerFeedback['value'],
    recordedAt: value.recordedAt as Timestamp,
    consentVersion: value.consentVersion,
    status,
    ...(supersedesFeedbackIdValue === undefined
      ? {}
      : { supersedesFeedbackId: supersedesFeedbackIdValue }),
  };
};

const parseProposalParameters = (
  value: unknown,
): PersonalizationProposalParameters | undefined => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return undefined;
  }
  if (value.kind === 'recommend_existing_next_step') {
    if (
      !hasOnlyKeys(value, ['kind', 'itemId']) ||
      typeof value.itemId !== 'string'
    ) {
      return undefined;
    }
    const itemId = brandIdentifier('plan_item', value.itemId);
    return itemId.ok ? { kind: value.kind, itemId: itemId.value } : undefined;
  }
  if (value.kind === 'suggest_pacing_preference') {
    const preference = isPacingPreference(value.preference);
    return !hasOnlyKeys(value, ['kind', 'preference']) || preference === undefined
      ? undefined
      : { kind: value.kind, preference };
  }
  if (value.kind === 'request_plan_revision') {
    if (
      !hasOnlyKeys(value, ['kind', 'reason', 'itemId']) ||
      (value.itemId !== undefined && typeof value.itemId !== 'string')
    ) {
      return undefined;
    }
    const reason = isRevisionReason(value.reason);
    if (reason === undefined) {
      return undefined;
    }
    const itemId =
      value.itemId === undefined
        ? undefined
        : brandIdentifier('plan_item', value.itemId);
    if (value.itemId !== undefined && (itemId === undefined || !itemId.ok)) {
      return undefined;
    }
    const itemIdValue = itemId !== undefined && itemId.ok ? itemId.value : undefined;
    return {
      kind: value.kind,
      reason,
      ...(itemIdValue === undefined ? {} : { itemId: itemIdValue }),
    };
  }
  return undefined;
};

const parseProposal = (
  value: unknown,
  expectedOwnerId: string,
  expectedPlanId: string,
): PersonalizationProposal | undefined => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'proposalId',
      'ownerId',
      'planId',
      'sourceRevisionId',
      'consentVersion',
      'parameters',
      'explanation',
      'basis',
      'createdAt',
      'expiresAt',
      'status',
      'proposalVersion',
      'decidedAt',
    ])
  ) {
    return undefined;
  }
  const proposalId =
    typeof value.proposalId === 'string'
      ? brandIdentifier('proposal', value.proposalId)
      : undefined;
  const ownerId =
    typeof value.ownerId === 'string'
      ? brandIdentifier('internal_owner', value.ownerId)
      : undefined;
  const planId =
    typeof value.planId === 'string'
      ? brandIdentifier('plan', value.planId)
      : undefined;
  const sourceRevisionId =
    typeof value.sourceRevisionId === 'string'
      ? brandIdentifier('revision', value.sourceRevisionId)
      : undefined;
  const parameters = parseProposalParameters(value.parameters);
  const basis = Array.isArray(value.basis)
    ? value.basis.map(isProposalBasis)
    : undefined;
  const status = isProposalStatus(value.status);
  const parsedBasis = basis?.filter(
    (entry): entry is PersonalizationProposal['basis'][number] =>
      entry !== undefined,
  );
  const explanationValid =
    typeof value.explanation === 'string' &&
    value.explanation.length > 0 &&
    value.explanation.length <= 4_000 &&
    !/[\u0000-\u001F\u007F]/u.test(value.explanation);
  if (
    proposalId === undefined ||
    !proposalId.ok ||
    ownerId === undefined ||
    !ownerId.ok ||
    ownerId.value !== expectedOwnerId ||
    planId === undefined ||
    !planId.ok ||
    planId.value !== expectedPlanId ||
    sourceRevisionId === undefined ||
    !sourceRevisionId.ok ||
    !isPositiveInteger(value.consentVersion) ||
    parameters === undefined ||
    parsedBasis === undefined ||
    parsedBasis.length === 0 ||
    parsedBasis.length !== basis?.length ||
    !explanationValid ||
    typeof value.createdAt !== 'string' ||
    !isUtcTimestamp(value.createdAt) ||
    typeof value.expiresAt !== 'string' ||
    !isUtcTimestamp(value.expiresAt) ||
    status === undefined ||
    !isPositiveInteger(value.proposalVersion) ||
    (value.decidedAt !== undefined &&
      (typeof value.decidedAt !== 'string' || !isUtcTimestamp(value.decidedAt)))
  ) {
    return undefined;
  }
  return {
    proposalId: proposalId.value,
    ownerId: ownerId.value,
    planId: planId.value,
    sourceRevisionId: sourceRevisionId.value,
    consentVersion: value.consentVersion,
    parameters,
    explanation: value.explanation as PersonalizationProposal['explanation'],
    basis: parsedBasis as unknown as PersonalizationProposal['basis'],
    createdAt: value.createdAt as Timestamp,
    expiresAt: value.expiresAt as Timestamp,
    status,
    proposalVersion: value.proposalVersion,
    ...(value.decidedAt === undefined
      ? {}
      : { decidedAt: value.decidedAt as Timestamp }),
  };
};

const parseState = (
  value: unknown,
  expectedOwnerId: string,
  expectedPlanId: string,
): PersonalizationState | undefined => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'ownerId',
      'planId',
      'stateVersion',
      'consent',
      'feedback',
      'proposals',
    ])
  ) {
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
  if (
    ownerId === undefined ||
    !ownerId.ok ||
    ownerId.value !== expectedOwnerId ||
    planId === undefined ||
    !planId.ok ||
    planId.value !== expectedPlanId ||
    !isNonNegativeInteger(value.stateVersion) ||
    !isRecord(value.consent) ||
    !Array.isArray(value.feedback) ||
    !Array.isArray(value.proposals)
  ) {
    return undefined;
  }
  if (
    !hasOnlyKeys(value.consent, [
      'ownerId',
      'planId',
      'state',
      'consentVersion',
      'enabledAt',
      'updatedAt',
    ])
  ) {
    return undefined;
  }
  const consentOwner =
    typeof value.consent.ownerId === 'string'
      ? brandIdentifier('internal_owner', value.consent.ownerId)
      : undefined;
  const consentPlan =
    typeof value.consent.planId === 'string'
      ? brandIdentifier('plan', value.consent.planId)
      : undefined;
  const consentState = isConsentState(value.consent.state);
  if (
    consentOwner === undefined ||
    !consentOwner.ok ||
    consentOwner.value !== expectedOwnerId ||
    consentPlan === undefined ||
    !consentPlan.ok ||
    consentPlan.value !== expectedPlanId ||
    consentState === undefined ||
    !isNonNegativeInteger(value.consent.consentVersion) ||
    typeof value.consent.updatedAt !== 'string' ||
    !isUtcTimestamp(value.consent.updatedAt) ||
    (value.consent.enabledAt !== undefined &&
      (typeof value.consent.enabledAt !== 'string' ||
        !isUtcTimestamp(value.consent.enabledAt)))
  ) {
    return undefined;
  }
  if (
    (consentState === 'disabled' &&
      (value.consent.consentVersion !== 0 ||
        value.consent.enabledAt !== undefined)) ||
    (consentState !== 'disabled' &&
      (!isPositiveInteger(value.consent.consentVersion) ||
        value.consent.enabledAt === undefined))
  ) {
    return undefined;
  }
  const feedback: LearnerFeedback[] = [];
  const feedbackIds = new Set<string>();
  for (const entry of value.feedback) {
    const parsed = parseFeedback(entry, expectedOwnerId, expectedPlanId);
    if (parsed === undefined || feedbackIds.has(parsed.feedbackId)) {
      return undefined;
    }
    if (
      parsed.status === 'active' &&
      parsed.consentVersion !== value.consent.consentVersion
    ) {
      return undefined;
    }
    feedbackIds.add(parsed.feedbackId);
    feedback.push(parsed);
  }
  const proposals: PersonalizationProposal[] = [];
  const proposalIds = new Set<string>();
  for (const entry of value.proposals) {
    const parsed = parseProposal(entry, expectedOwnerId, expectedPlanId);
    if (parsed === undefined || proposalIds.has(parsed.proposalId)) {
      return undefined;
    }
    proposalIds.add(parsed.proposalId);
    proposals.push(parsed);
  }
  const consent: PersonalizationConsent = {
    ownerId: ownerId.value,
    planId: planId.value,
    state: consentState,
    consentVersion: value.consent.consentVersion,
    ...(value.consent.enabledAt === undefined
      ? {}
      : { enabledAt: value.consent.enabledAt as Timestamp }),
    updatedAt: value.consent.updatedAt as Timestamp,
  };
  const candidate: PersonalizationState = {
    ownerId: ownerId.value,
    planId: planId.value,
    stateVersion: value.stateVersion,
    consent,
    feedback,
    proposals,
  };
  const validated = validatePersonalizationState(candidate);
  return validated.ok ? validated.value : undefined;
};

const currentItemIds = (plan: ActivePlanAggregate): ReadonlySet<string> =>
  new Set(
    plan.content.milestones.flatMap((milestone) =>
      milestone.topics.flatMap((topic) => topic.items.map((item) => item.itemId)),
    ),
  );

const sanitizeForPlan = (
  state: PersonalizationState,
  plan: ActivePlanAggregate,
): PersonalizationState => {
  const itemIds = currentItemIds(plan);
  return {
    ...state,
    feedback: state.feedback.filter(
      (entry) => entry.itemId === undefined || itemIds.has(entry.itemId),
    ),
    proposals: state.proposals.filter((proposal) => {
      if (proposal.sourceRevisionId !== plan.currentRevision.revisionId) {
        return false;
      }
      const itemId =
        proposal.parameters.kind === 'recommend_existing_next_step' ||
        proposal.parameters.kind === 'request_plan_revision'
          ? proposal.parameters.itemId
          : undefined;
      return itemId === undefined || itemIds.has(itemId);
    }),
  };
};

const fallbackState = (
  plan: ActivePlanAggregate,
  now: string,
): PersonalizationState => {
  const created = createPersonalizationState({
    ownerId: plan.ownerId,
    planId: plan.planId,
    now: isUtcTimestamp(now) ? now : plan.currentRevision.acceptedAt,
  });
  if (!created.ok) {
    throw new Error('could not create a disabled personalization state');
  }
  return created.value;
};

const sanitizedStoredPlans = (
  plans: Readonly<Record<string, unknown>>,
): Record<string, PersonalizationState> => {
  const sanitized: Record<string, PersonalizationState> = {};
  for (const [planId, value] of Object.entries(plans)) {
    if (!brandIdentifier('plan', planId).ok) {
      continue;
    }
    const expectedOwnerId =
      isRecord(value) && typeof value.ownerId === 'string' ? value.ownerId : '';
    const state = parseState(value, expectedOwnerId, planId);
    if (state !== undefined) {
      sanitized[planId] = state;
    }
  }
  return sanitized;
};

export const createPersonalizationStore = (
  storage?: PersonalizationStorage,
): PersonalizationStore => ({
  hydrate(plan, now) {
    const fallback = fallbackState(plan, now);
    const result = readDocument(storage);
    if (!result.ok) {
      return fallback;
    }
    const stored = result.document.plans[plan.planId];
    const parsed = parseState(stored, plan.ownerId, plan.planId);
    return parsed === undefined ? fallback : sanitizeForPlan(parsed, plan);
  },

  save(state, expectedStateVersion) {
    if (storage === undefined) {
      return { ok: false };
    }
    const parsedState = parseState(state, state.ownerId, state.planId);
    if (parsedState === undefined) {
      return { ok: false };
    }
    const latest = readDocument(storage);
    if (!latest.ok) {
      return { ok: false };
    }
    const current = parseState(
      latest.document.plans[state.planId],
      state.ownerId,
      state.planId,
    );
    const currentVersion = current?.stateVersion ?? 0;
    if (
      expectedStateVersion !== undefined &&
      currentVersion !== expectedStateVersion
    ) {
      return { ok: false, kind: 'conflict' };
    }
    try {
      const plans = sanitizedStoredPlans(latest.document.plans);
      plans[state.planId] = parsedState;
      storage.setItem(
        PERSONALIZATION_STORAGE_KEY,
        JSON.stringify({ version: 1, plans }),
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  purge(ownerId, planId, expectedStateVersion) {
    if (storage === undefined) {
      return { ok: false };
    }
    const owner = brandIdentifier('internal_owner', ownerId);
    const plan = brandIdentifier('plan', planId);
    if (!owner.ok || !plan.ok) {
      return { ok: false };
    }
    const document = readDocument(storage);
    if (!document.ok) {
      return { ok: false };
    }
    const current = parseState(document.document.plans[plan.value], owner.value, plan.value);
    const currentVersion = current?.stateVersion ?? 0;
    if (
      expectedStateVersion !== undefined &&
      currentVersion !== expectedStateVersion
    ) {
      return { ok: false, kind: 'conflict' };
    }
    try {
      const plans = sanitizedStoredPlans(document.document.plans);
      delete plans[plan.value];
      storage.setItem(
        PERSONALIZATION_STORAGE_KEY,
        JSON.stringify({ version: 1, plans }),
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
});
