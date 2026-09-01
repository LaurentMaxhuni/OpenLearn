import { fail, succeed, type DomainResult } from './errors.js';
import { brandIdentifier, type IdentityAllocator } from './identity.js';
import { allocateIdentifier, validateOwnerId, validateTimestamp } from './revisions.js';
import type {
  ActivePlanAggregate,
  DifficultyFeedbackValue,
  FeedbackId,
  LearnerFeedback,
  LongText,
  PersonalizationConsent,
  PersonalizationConsentState,
  PersonalizationFeedbackArea,
  PersonalizationFeedbackValue,
  PersonalizationHandoffIntent,
  PersonalizationProposal,
  PersonalizationProposalBasis,
  PersonalizationProposalParameters,
  PersonalizationProposalStatus,
  PersonalizationRevisionHandoff,
  PersonalizationState,
  PaceFeedbackValue,
  PacingPreference,
  PlanId,
  PlanRevisionReason,
  ProposalId,
  RelevanceFeedbackValue,
  Timestamp,
} from './types.js';

export const PERSONALIZATION_PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const PERSONALIZATION_FEEDBACK_VALUES: Readonly<{
  readonly difficulty: readonly DifficultyFeedbackValue[];
  readonly pace: readonly PaceFeedbackValue[];
  readonly relevance: readonly RelevanceFeedbackValue[];
}> = {
  difficulty: ['too_easy', 'about_right', 'too_hard'],
  pace: ['too_slow', 'about_right', 'too_fast'],
  relevance: ['relevant', 'not_relevant'],
};

export type ConsentAction = 'enable' | 'pause' | 'resume' | 'revoke';

export interface CreatePersonalizationStateCommand {
  readonly ownerId: unknown;
  readonly planId: unknown;
  readonly now: unknown;
}

export interface ChangePersonalizationConsentCommand {
  readonly state: PersonalizationState;
  readonly action: unknown;
  readonly now: unknown;
}

export interface RecordLearnerFeedbackCommand {
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
  readonly ownerId: unknown;
  readonly itemId?: unknown;
  readonly area: unknown;
  readonly value: unknown;
  readonly recordedAt: unknown;
  readonly allocator: IdentityAllocator;
}

export interface CorrectLearnerFeedbackCommand
  extends Omit<RecordLearnerFeedbackCommand, 'itemId'> {
  readonly feedbackId: unknown;
}

export interface DeleteLearnerFeedbackCommand {
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
  readonly ownerId: unknown;
  readonly feedbackId: unknown;
  readonly now?: unknown;
}

export interface EvaluatePersonalizationCommand {
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
  readonly ownerId: unknown;
  readonly now: unknown;
  readonly allocator: IdentityAllocator;
}

export type ProposalDecision = 'accept' | 'reject';

export interface DecidePersonalizationProposalCommand {
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
  readonly ownerId: unknown;
  readonly proposalId: unknown;
  readonly decision: unknown;
  readonly expectedProposalVersion: unknown;
  readonly now: unknown;
}

export interface FeedbackMutation {
  readonly state: PersonalizationState;
  readonly feedback: LearnerFeedback;
}

export interface PersonalizationEvaluation {
  readonly state: PersonalizationState;
  readonly proposals: readonly PersonalizationProposal[];
  readonly createdProposal?: PersonalizationProposal;
}

export interface PersonalizationDecision {
  readonly state: PersonalizationState;
  readonly proposal: PersonalizationProposal;
  readonly handoff?: PersonalizationRevisionHandoff;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const malformed = (path: string) =>
  fail('malformed_input', [{ path, code: 'invalid_shape' }]);

const unknownField = (path: string) =>
  fail('unknown_field', [{ path, code: 'unknown_field' }]);

const invalidRelationship = (path: string) =>
  fail('invalid_relationship', [
    { path, code: 'relationship_mismatch' },
  ]);

const invalidTransition = () =>
  fail('invalid_transition', [{ code: 'transition_not_allowed' }]);

const stalePersonalization = (
  path: string,
  expectedVersion: number,
  actualVersion: number,
) =>
  fail('stale_personalization', [
    {
      path,
      code: 'stale_personalization',
      expectedVersion,
      actualVersion,
    },
  ]);

const staleRevision = () =>
  fail('stale_revision', [{ code: 'stale_revision' }]);

const deletedPlan = () => fail('plan_deleted', [{ code: 'plan_deleted' }]);

const isConsentState = (value: unknown): value is PersonalizationConsentState =>
  value === 'disabled' ||
  value === 'enabled' ||
  value === 'paused' ||
  value === 'revoked';

const isConsentAction = (value: unknown): value is ConsentAction =>
  value === 'enable' ||
  value === 'pause' ||
  value === 'resume' ||
  value === 'revoke';

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  isNonNegativeInteger(value) && value > 0;

const isFeedbackArea = (
  value: unknown,
): value is PersonalizationFeedbackArea =>
  value === 'difficulty' || value === 'pace' || value === 'relevance';

const isFeedbackValue = (
  area: PersonalizationFeedbackArea,
  value: unknown,
): value is PersonalizationFeedbackValue =>
  (PERSONALIZATION_FEEDBACK_VALUES[area] as readonly unknown[]).includes(value);

const isProposalBasis = (
  value: unknown,
): value is PersonalizationProposalBasis =>
  value === 'confirmed_progress' ||
  value === 'difficulty_feedback' ||
  value === 'pace_feedback' ||
  value === 'relevance_feedback';

const isProposalStatus = (
  value: unknown,
): value is PersonalizationProposalStatus =>
  value === 'proposed' ||
  value === 'accepted' ||
  value === 'rejected' ||
  value === 'withdrawn' ||
  value === 'expired';

const isFeedbackStatus = (
  value: unknown,
): value is LearnerFeedback['status'] =>
  value === 'active' || value === 'corrected' || value === 'deleted';

const isPacingPreference = (value: unknown): value is PacingPreference =>
  value === 'slower' || value === 'steady' || value === 'faster';

const isPlanRevisionReason = (value: unknown): value is PlanRevisionReason =>
  value === 'difficulty' || value === 'pace' || value === 'relevance';

const validatePlanId = (value: unknown): DomainResult<PlanId> => {
  if (typeof value !== 'string') {
    return malformed('planId');
  }
  return brandIdentifier('plan', value);
};

const validateFeedbackId = (value: unknown): DomainResult<FeedbackId> => {
  if (typeof value !== 'string') {
    return malformed('feedbackId');
  }
  return brandIdentifier('feedback', value);
};

const validateProposalId = (value: unknown): DomainResult<ProposalId> => {
  if (typeof value !== 'string') {
    return malformed('proposalId');
  }
  return brandIdentifier('proposal', value);
};

const validateFeedbackRecord = (
  value: unknown,
  ownerId: string,
  planId: string,
  path: string,
): DomainResult<undefined> => {
  if (!isRecord(value)) {
    return malformed(path);
  }
  if (
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
    return unknownField(path);
  }
  const feedbackId = validateFeedbackId(value.feedbackId);
  if (!feedbackId.ok) return feedbackId;
  const recordOwner = validateOwnerId(value.ownerId);
  if (!recordOwner.ok) return recordOwner;
  const recordPlan = validatePlanId(value.planId);
  if (!recordPlan.ok) return recordPlan;
  if (recordOwner.value !== ownerId || recordPlan.value !== planId) {
    return invalidRelationship(`${path}.ownerId`);
  }
  if (value.itemId !== undefined) {
    if (typeof value.itemId !== 'string') return malformed(`${path}.itemId`);
    const item = brandIdentifier('plan_item', value.itemId);
    if (!item.ok) return item;
  }
  if (!isFeedbackArea(value.area) || !isFeedbackValue(value.area, value.value)) {
    return malformed(`${path}.value`);
  }
  const recordedAt = validateTimestamp(value.recordedAt, `${path}.recordedAt`);
  if (!recordedAt.ok) return recordedAt;
  if (!isPositiveInteger(value.consentVersion)) {
    return malformed(`${path}.consentVersion`);
  }
  if (!isFeedbackStatus(value.status)) {
    return malformed(`${path}.status`);
  }
  if (value.supersedesFeedbackId !== undefined) {
    const superseded = validateFeedbackId(value.supersedesFeedbackId);
    if (!superseded.ok) return superseded;
  }
  return succeed(undefined);
};

const validateProposalParameters = (
  value: unknown,
  path: string,
): DomainResult<PersonalizationProposalParameters> => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return malformed(path);
  }
  if (value.kind === 'recommend_existing_next_step') {
    if (!hasOnlyKeys(value, ['kind', 'itemId']) || typeof value.itemId !== 'string') {
      return malformed(path);
    }
    const item = brandIdentifier('plan_item', value.itemId);
    return item.ok
      ? succeed({ kind: value.kind, itemId: item.value })
      : item;
  }
  if (value.kind === 'suggest_pacing_preference') {
    return hasOnlyKeys(value, ['kind', 'preference']) && isPacingPreference(value.preference)
      ? succeed({ kind: value.kind, preference: value.preference })
      : malformed(path);
  }
  if (value.kind === 'request_plan_revision') {
    if (
      !hasOnlyKeys(value, ['kind', 'reason', 'itemId']) ||
      !isPlanRevisionReason(value.reason)
    ) {
      return malformed(path);
    }
    if (value.itemId !== undefined) {
      if (typeof value.itemId !== 'string') return malformed(`${path}.itemId`);
      const item = brandIdentifier('plan_item', value.itemId);
      if (!item.ok) return item;
      return succeed({
        kind: value.kind,
        reason: value.reason,
        itemId: item.value,
      });
    }
    return succeed({ kind: value.kind, reason: value.reason });
  }
  return malformed(path);
};

const safeProposalExplanation = (
  parameters: PersonalizationProposalParameters,
): string => {
  switch (parameters.kind) {
    case 'recommend_existing_next_step':
      return 'Based on your confirmed progress in this plan, consider the existing next step. The accepted plan and your progress will not change automatically.';
    case 'suggest_pacing_preference':
      return `Based on explicit difficulty or pace feedback for this plan, consider a ${parameters.preference} pacing preference. Your accepted plan will not change automatically.`;
    case 'request_plan_revision':
      return 'Based on explicit relevance feedback for this plan, consider asking the connected AI client for a revised plan. Your accepted plan will not change automatically.';
  }
};

const validateProposalRecord = (
  value: unknown,
  ownerId: string,
  planId: string,
  path: string,
): DomainResult<undefined> => {
  if (!isRecord(value)) return malformed(path);
  if (
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
    return unknownField(path);
  }
  const proposalId = validateProposalId(value.proposalId);
  if (!proposalId.ok) return proposalId;
  const recordOwner = validateOwnerId(value.ownerId);
  if (!recordOwner.ok) return recordOwner;
  const recordPlan = validatePlanId(value.planId);
  if (!recordPlan.ok) return recordPlan;
  if (recordOwner.value !== ownerId || recordPlan.value !== planId) {
    return invalidRelationship(`${path}.ownerId`);
  }
  if (typeof value.sourceRevisionId !== 'string') {
    return malformed(`${path}.sourceRevisionId`);
  }
  const sourceRevisionId = brandIdentifier('revision', value.sourceRevisionId);
  if (!sourceRevisionId.ok) {
    return malformed(`${path}.sourceRevisionId`);
  }
  if (!isPositiveInteger(value.consentVersion)) {
    return malformed(`${path}.consentVersion`);
  }
  const parameters = validateProposalParameters(value.parameters, `${path}.parameters`);
  if (!parameters.ok) return parameters;
  if (
    typeof value.explanation !== 'string' ||
    value.explanation.length < 1 ||
    value.explanation.length > 4_000 ||
    /[\u0000-\u001F\u007F]/u.test(value.explanation) ||
    value.explanation !== safeProposalExplanation(parameters.value)
  ) {
    return malformed(`${path}.explanation`);
  }
  if (!Array.isArray(value.basis) || value.basis.length === 0) {
    return malformed(`${path}.basis`);
  }
  if (!value.basis.every(isProposalBasis)) {
    return malformed(`${path}.basis`);
  }
  const createdAt = validateTimestamp(value.createdAt, `${path}.createdAt`);
  if (!createdAt.ok) return createdAt;
  const expiresAt = validateTimestamp(value.expiresAt, `${path}.expiresAt`);
  if (!expiresAt.ok) return expiresAt;
  const proposalLifetime =
    Date.parse(expiresAt.value) - Date.parse(createdAt.value);
  if (
    proposalLifetime <= 0 ||
    proposalLifetime > PERSONALIZATION_PROPOSAL_TTL_MS
  ) {
    return malformed(`${path}.expiresAt`);
  }
  if (!isProposalStatus(value.status) || !isPositiveInteger(value.proposalVersion)) {
    return malformed(path);
  }
  if (value.decidedAt !== undefined) {
    const decidedAt = validateTimestamp(value.decidedAt, `${path}.decidedAt`);
    if (!decidedAt.ok) return decidedAt;
  }
  return succeed(undefined);
};

export const validatePersonalizationState = (
  state: unknown,
): DomainResult<PersonalizationState> => {
  if (!isRecord(state)) {
    return malformed('state');
  }
  if (
    !hasOnlyKeys(state, [
      'ownerId',
      'planId',
      'stateVersion',
      'consent',
      'feedback',
      'proposals',
    ]) ||
    !isNonNegativeInteger(state.stateVersion) ||
    !Array.isArray(state.feedback) ||
    !Array.isArray(state.proposals)
  ) {
    return malformed('state');
  }

  const owner = validateOwnerId(state.ownerId);
  if (!owner.ok) {
    return owner;
  }
  const plan = validatePlanId(state.planId);
  if (!plan.ok) {
    return plan;
  }
  if (!isRecord(state.consent)) {
    return malformed('consent');
  }
  if (
    !hasOnlyKeys(state.consent, [
      'ownerId',
      'planId',
      'state',
      'consentVersion',
      'enabledAt',
      'updatedAt',
    ])
  ) {
    return unknownField('consent');
  }
  if (
    state.consent.ownerId !== owner.value ||
    state.consent.planId !== plan.value ||
    !isConsentState(state.consent.state) ||
    !isNonNegativeInteger(state.consent.consentVersion)
  ) {
    return invalidRelationship('consent');
  }
  if (
    (state.consent.state === 'disabled' &&
      (state.consent.consentVersion !== 0 ||
        state.consent.enabledAt !== undefined)) ||
    (state.consent.state !== 'disabled' &&
      (!isPositiveInteger(state.consent.consentVersion) ||
        state.consent.enabledAt === undefined))
  ) {
    return invalidRelationship('consent');
  }
  const updatedAt = validateTimestamp(state.consent.updatedAt, 'consent.updatedAt');
  if (!updatedAt.ok) {
    return updatedAt;
  }
  if (
    state.consent.enabledAt !== undefined &&
    !validateTimestamp(state.consent.enabledAt, 'consent.enabledAt').ok
  ) {
    return malformed('consent.enabledAt');
  }

  const feedbackIds = new Set<string>();
  for (const [index, feedback] of state.feedback.entries()) {
    const valid = validateFeedbackRecord(
      feedback,
      owner.value,
      plan.value,
      `feedback[${index}]`,
    );
    if (!valid.ok) return valid;
    const feedbackId = (feedback as Record<string, unknown>).feedbackId;
    if (typeof feedbackId !== 'string' || feedbackIds.has(feedbackId)) {
      return fail('duplicate_identifier', [
        {
          path: `feedback[${index}].feedbackId`,
          code: 'duplicate_value',
          identifierKind: 'feedback',
        },
      ]);
    }
    const feedbackRecord = feedback as Record<string, unknown>;
    if (
      feedbackRecord.status === 'active' &&
      feedbackRecord.consentVersion !== state.consent.consentVersion
    ) {
      return invalidRelationship(`feedback[${index}].consentVersion`);
    }
    feedbackIds.add(feedbackId);
  }

  const proposalIds = new Set<string>();
  for (const [index, proposal] of state.proposals.entries()) {
    const valid = validateProposalRecord(
      proposal,
      owner.value,
      plan.value,
      `proposals[${index}]`,
    );
    if (!valid.ok) return valid;
    const proposalId = (proposal as Record<string, unknown>).proposalId;
    if (typeof proposalId !== 'string' || proposalIds.has(proposalId)) {
      return fail('duplicate_identifier', [
        {
          path: `proposals[${index}].proposalId`,
          code: 'duplicate_value',
          identifierKind: 'proposal',
        },
      ]);
    }
    proposalIds.add(proposalId);
  }

  return succeed(state as unknown as PersonalizationState);
};

const validatePlanContext = (
  plan: unknown,
  state: unknown,
  ownerId: unknown,
): DomainResult<{
  readonly plan: ActivePlanAggregate;
  readonly state: PersonalizationState;
}> => {
  const owner = validateOwnerId(ownerId);
  if (!owner.ok) {
    return owner;
  }
  if (!isRecord(plan)) {
    return malformed('plan');
  }
  if (plan.lifecycle === 'deleted') {
    return deletedPlan();
  }
  if (plan.lifecycle !== 'active') {
    return malformed('plan');
  }
  if (plan.ownerId !== owner.value) {
    return fail('owner_unavailable', [{ code: 'owner_unavailable' }]);
  }

  const stateResult = validatePersonalizationState(state);
  if (!stateResult.ok) {
    return stateResult;
  }
  if (
    stateResult.value.ownerId !== owner.value ||
    stateResult.value.planId !== plan.planId
  ) {
    return invalidRelationship('state');
  }

  return succeed({
    plan: plan as unknown as ActivePlanAggregate,
    state: stateResult.value,
  });
};

const stateAfter = (
  state: PersonalizationState,
  changes: Partial<PersonalizationState>,
): PersonalizationState => ({
  ...state,
  ...changes,
  stateVersion: state.stateVersion + 1,
});

export const createPersonalizationState = (
  command: CreatePersonalizationStateCommand,
): DomainResult<PersonalizationState> => {
  const owner = validateOwnerId(command.ownerId);
  if (!owner.ok) {
    return owner;
  }
  const plan = validatePlanId(command.planId);
  if (!plan.ok) {
    return plan;
  }
  const now = validateTimestamp(command.now, 'now');
  if (!now.ok) {
    return now;
  }

  const consent: PersonalizationConsent = {
    ownerId: owner.value,
    planId: plan.value,
    state: 'disabled',
    consentVersion: 0,
    updatedAt: now.value,
  };
  return succeed({
    ownerId: owner.value,
    planId: plan.value,
    stateVersion: 0,
    consent,
    feedback: [],
    proposals: [],
  });
};

export const changePersonalizationConsent = (
  command: ChangePersonalizationConsentCommand,
): DomainResult<PersonalizationState> => {
  const stateResult = validatePersonalizationState(command.state);
  if (!stateResult.ok) {
    return stateResult;
  }
  if (!isConsentAction(command.action)) {
    return malformed('action');
  }
  const now = validateTimestamp(command.now, 'now');
  if (!now.ok) {
    return now;
  }

  const state = stateResult.value;
  const consent = state.consent;
  if (command.action === 'enable') {
    if (consent.state !== 'disabled' && consent.state !== 'revoked') {
      return invalidTransition();
    }
    return succeed(
      stateAfter(state, {
        consent: {
          ...consent,
          state: 'enabled',
          consentVersion: consent.consentVersion + 1,
          enabledAt: now.value,
          updatedAt: now.value,
        },
      }),
    );
  }

  if (command.action === 'pause') {
    if (consent.state !== 'enabled') {
      return invalidTransition();
    }
    return succeed(
      stateAfter(state, {
        consent: { ...consent, state: 'paused', updatedAt: now.value },
      }),
    );
  }

  if (command.action === 'resume') {
    if (consent.state !== 'paused') {
      return invalidTransition();
    }
    return succeed(
      stateAfter(state, {
        consent: { ...consent, state: 'enabled', updatedAt: now.value },
      }),
    );
  }

  if (consent.state !== 'enabled' && consent.state !== 'paused') {
    return invalidTransition();
  }

  const withdrawnProposals = state.proposals.map((proposal) =>
    proposal.status !== 'proposed'
      ? proposal
      : {
          ...proposal,
          status: 'withdrawn' as const,
          proposalVersion: proposal.proposalVersion + 1,
          decidedAt: now.value,
        },
  );
  return succeed(
    stateAfter(state, {
      consent: { ...consent, state: 'revoked', updatedAt: now.value },
      feedback: [],
      proposals: withdrawnProposals,
    }),
  );
};

const validateFeedbackInput = (
  areaValue: unknown,
  valueValue: unknown,
): DomainResult<{
  readonly area: PersonalizationFeedbackArea;
  readonly value: PersonalizationFeedbackValue;
}> => {
  if (!isFeedbackArea(areaValue)) {
    return malformed('area');
  }
  if (!isFeedbackValue(areaValue, valueValue)) {
    return malformed('value');
  }
  return succeed({ area: areaValue, value: valueValue });
};

const currentItemIds = (plan: ActivePlanAggregate): ReadonlySet<string> =>
  new Set(
    plan.content.milestones.flatMap((milestone) =>
      milestone.topics.flatMap((topic) => topic.items.map((entry) => entry.itemId)),
    ),
  );

const validateOptionalItem = (
  plan: ActivePlanAggregate,
  itemValue: unknown,
): DomainResult<import('./types.js').PlanItemId | undefined> => {
  if (itemValue === undefined) {
    return succeed(undefined);
  }
  if (typeof itemValue !== 'string') {
    return malformed('itemId');
  }
  const item = brandIdentifier('plan_item', itemValue);
  if (!item.ok) {
    return item;
  }
  return currentItemIds(plan).has(item.value)
    ? succeed(item.value)
    : invalidRelationship('itemId');
};

const rejectFreeText = (command: object): DomainResult<undefined> => {
  if (hasOwn(command, 'note') || hasOwn(command, 'notes')) {
    return unknownField('note');
  }
  return succeed(undefined);
};

const basisForFeedbackArea = (
  area: PersonalizationFeedbackArea,
): PersonalizationProposalBasis => {
  switch (area) {
    case 'difficulty':
      return 'difficulty_feedback';
    case 'pace':
      return 'pace_feedback';
    case 'relevance':
      return 'relevance_feedback';
  }
};

const withdrawFeedbackProposals = (
  proposals: readonly PersonalizationProposal[],
  area: PersonalizationFeedbackArea,
  decidedAt?: Timestamp,
): readonly PersonalizationProposal[] => {
  const basis = basisForFeedbackArea(area);
  return proposals.map((proposal) =>
    proposal.status === 'proposed' && proposal.basis.includes(basis)
      ? {
          ...proposal,
          status: 'withdrawn' as const,
          proposalVersion: proposal.proposalVersion + 1,
          ...(decidedAt === undefined ? {} : { decidedAt }),
        }
      : proposal,
  );
};

export const recordLearnerFeedback = (
  command: RecordLearnerFeedbackCommand,
): DomainResult<FeedbackMutation> => {
  const context = validatePlanContext(command.plan, command.state, command.ownerId);
  if (!context.ok) {
    return context;
  }
  if (context.value.state.consent.state !== 'enabled') {
    return invalidTransition();
  }
  const noFreeText = rejectFreeText(command as object);
  if (!noFreeText.ok) {
    return noFreeText;
  }
  const feedbackInput = validateFeedbackInput(command.area, command.value);
  if (!feedbackInput.ok) {
    return feedbackInput;
  }
  const item = validateOptionalItem(context.value.plan, command.itemId);
  if (!item.ok) {
    return item;
  }
  const recordedAt = validateTimestamp(command.recordedAt, 'recordedAt');
  if (!recordedAt.ok) {
    return recordedAt;
  }
  const feedbackId = allocateIdentifier(command.allocator, 'feedback', 'feedbackId');
  if (!feedbackId.ok) {
    return feedbackId;
  }
  const feedback: LearnerFeedback = {
    feedbackId: feedbackId.value,
    ownerId: context.value.state.ownerId,
    planId: context.value.state.planId,
    ...(item.value === undefined ? {} : { itemId: item.value }),
    area: feedbackInput.value.area,
    value: feedbackInput.value.value,
    recordedAt: recordedAt.value,
    consentVersion: context.value.state.consent.consentVersion,
    status: 'active',
  };
  return succeed({
    state: stateAfter(context.value.state, {
      feedback: [...context.value.state.feedback, feedback],
    }),
    feedback,
  });
};

export const correctLearnerFeedback = (
  command: CorrectLearnerFeedbackCommand,
): DomainResult<FeedbackMutation> => {
  const context = validatePlanContext(command.plan, command.state, command.ownerId);
  if (!context.ok) {
    return context;
  }
  if (context.value.state.consent.state !== 'enabled') {
    return invalidTransition();
  }
  const noFreeText = rejectFreeText(command as object);
  if (!noFreeText.ok) {
    return noFreeText;
  }
  const feedbackId = validateFeedbackId(command.feedbackId);
  if (!feedbackId.ok) {
    return feedbackId;
  }
  const current = context.value.state.feedback.find(
    (entry) => entry.feedbackId === feedbackId.value,
  );
  if (current === undefined || current.status !== 'active') {
    return invalidRelationship('feedbackId');
  }
  if (
    current.ownerId !== context.value.state.ownerId ||
    current.planId !== context.value.state.planId ||
    current.consentVersion !== context.value.state.consent.consentVersion
  ) {
    return invalidRelationship('feedbackId');
  }
  if (
    current.itemId !== undefined &&
    !currentItemIds(context.value.plan).has(current.itemId)
  ) {
    return invalidRelationship('feedbackId');
  }
  const feedbackInput = validateFeedbackInput(command.area, command.value);
  if (!feedbackInput.ok) {
    return feedbackInput;
  }
  const recordedAt = validateTimestamp(command.recordedAt, 'recordedAt');
  if (!recordedAt.ok) {
    return recordedAt;
  }
  const newId = allocateIdentifier(command.allocator, 'feedback', 'feedbackId');
  if (!newId.ok) {
    return newId;
  }
  const corrected: LearnerFeedback = {
    feedbackId: newId.value,
    ownerId: current.ownerId,
    planId: current.planId,
    ...(current.itemId === undefined ? {} : { itemId: current.itemId }),
    area: feedbackInput.value.area,
    value: feedbackInput.value.value,
    recordedAt: recordedAt.value,
    consentVersion: context.value.state.consent.consentVersion,
    status: 'active',
    supersedesFeedbackId: current.feedbackId,
  };
  return succeed({
    state: stateAfter(context.value.state, {
      feedback: context.value.state.feedback.map((entry) =>
        entry.feedbackId === current.feedbackId
          ? { ...entry, status: 'corrected' as const }
          : entry,
      ).concat(corrected),
      proposals: withdrawFeedbackProposals(
        context.value.state.proposals,
        current.area,
        recordedAt.value,
      ),
    }),
    feedback: corrected,
  });
};

export const deleteLearnerFeedback = (
  command: DeleteLearnerFeedbackCommand,
): DomainResult<PersonalizationState> => {
  const context = validatePlanContext(command.plan, command.state, command.ownerId);
  if (!context.ok) {
    return context;
  }
  if (context.value.state.consent.state === 'revoked') {
    return invalidTransition();
  }
  const feedbackId = validateFeedbackId(command.feedbackId);
  if (!feedbackId.ok) {
    return feedbackId;
  }
  const current = context.value.state.feedback.find(
    (entry) => entry.feedbackId === feedbackId.value,
  );
  if (current === undefined) {
    return invalidRelationship('feedbackId');
  }
  let deletedAt: Timestamp | undefined;
  if (command.now !== undefined) {
    const result = validateTimestamp(command.now, 'now');
    if (!result.ok) return result;
    deletedAt = result.value;
  }
  return succeed(
    stateAfter(context.value.state, {
      feedback: context.value.state.feedback.filter(
        (entry) => entry.feedbackId !== feedbackId.value,
      ),
      proposals: withdrawFeedbackProposals(
        context.value.state.proposals,
        current.area,
        deletedAt,
      ),
    }),
  );
};

const timestampMs = (value: Timestamp): number => Date.parse(value);

const expiresAtFor = (now: Timestamp): Timestamp =>
  new Date(timestampMs(now) + PERSONALIZATION_PROPOSAL_TTL_MS)
    .toISOString() as Timestamp;

const latestFeedback = (
  feedback: readonly LearnerFeedback[],
  area: PersonalizationFeedbackArea,
): LearnerFeedback | undefined =>
  feedback
    .filter((entry) => entry.status === 'active' && entry.area === area)
    .reduce<LearnerFeedback | undefined>(
      (latest, entry) =>
        latest === undefined || timestampMs(entry.recordedAt) >= timestampMs(latest.recordedAt)
          ? entry
          : latest,
      undefined,
    );

const proposalSignature = (
  parameters: PersonalizationProposalParameters,
): string => JSON.stringify(parameters);

const hasEquivalentProposal = (
  proposals: readonly PersonalizationProposal[],
  parameters: PersonalizationProposalParameters,
  sourceRevisionId: string,
  consentVersion: number,
  evidenceAt?: Timestamp,
): boolean =>
  proposals.some(
    (proposal) =>
      proposal.sourceRevisionId === sourceRevisionId &&
      proposal.consentVersion === consentVersion &&
      (proposal.status === 'proposed' ||
        proposal.status === 'accepted' ||
        (proposal.status === 'rejected' &&
          (evidenceAt === undefined ||
            proposal.decidedAt === undefined ||
            timestampMs(evidenceAt) <= timestampMs(proposal.decidedAt)))) &&
      proposalSignature(proposal.parameters) === proposalSignature(parameters),
  );

const currentItems = (plan: ActivePlanAggregate) =>
  plan.content.milestones.flatMap((milestone) =>
    milestone.topics.flatMap((topic) => topic.items),
  );

const proposalFor = (
  plan: ActivePlanAggregate,
  state: PersonalizationState,
  now: Timestamp,
  allocator: IdentityAllocator,
  parameters: PersonalizationProposalParameters,
  basis: readonly [PersonalizationProposalBasis, ...PersonalizationProposalBasis[]],
  explanation: string,
): DomainResult<PersonalizationProposal> => {
  if (explanation !== safeProposalExplanation(parameters)) {
    return malformed('explanation');
  }
  const proposalId = allocateIdentifier(allocator, 'proposal', 'proposalId');
  if (!proposalId.ok) {
    return proposalId;
  }
  return succeed({
    proposalId: proposalId.value,
    ownerId: state.ownerId,
    planId: state.planId,
    sourceRevisionId: plan.currentRevision.revisionId,
    consentVersion: state.consent.consentVersion,
    parameters,
    explanation: explanation as LongText,
    basis,
    createdAt: now,
    expiresAt: expiresAtFor(now),
    status: 'proposed',
    proposalVersion: 1,
  });
};

const suggestionFromFeedback = (
  plan: ActivePlanAggregate,
  state: PersonalizationState,
  feedback: readonly LearnerFeedback[],
  now: Timestamp,
  allocator: IdentityAllocator,
): DomainResult<PersonalizationProposal | undefined> => {
  const relevance = latestFeedback(feedback, 'relevance');
  if (relevance?.value === 'not_relevant') {
    const parameters: PersonalizationProposalParameters = {
      kind: 'request_plan_revision',
      reason: 'relevance',
      ...(relevance.itemId === undefined ? {} : { itemId: relevance.itemId }),
    };
    return hasEquivalentProposal(
      state.proposals,
      parameters,
      plan.currentRevision.revisionId,
      state.consent.consentVersion,
      relevance.recordedAt,
    )
      ? succeed(undefined)
      : proposalFor(
          plan,
          state,
          now,
          allocator,
          parameters,
          ['relevance_feedback'],
          'Based on explicit relevance feedback for this plan, consider asking the connected AI client for a revised plan. Your accepted plan will not change automatically.',
        );
  }

  const difficulty = latestFeedback(feedback, 'difficulty');
  const pace = latestFeedback(feedback, 'pace');
  const wantsSlower =
    difficulty?.value === 'too_hard' || pace?.value === 'too_fast';
  const wantsFaster =
    difficulty?.value === 'too_easy' || pace?.value === 'too_slow';
  if (wantsSlower || wantsFaster) {
    const preference: PacingPreference = wantsSlower ? 'slower' : 'faster';
    const basis: PersonalizationProposalBasis[] = [];
    if (
      difficulty?.value === 'too_hard' ||
      difficulty?.value === 'too_easy'
    ) {
      basis.push('difficulty_feedback');
    }
    if (pace?.value === 'too_fast' || pace?.value === 'too_slow') {
      basis.push('pace_feedback');
    }
    if (basis.length === 0) {
      return malformed('feedback');
    }
    const parameters: PersonalizationProposalParameters = {
      kind: 'suggest_pacing_preference',
      preference,
    };
    const pacingEvidenceAt = [difficulty, pace]
      .filter((entry): entry is LearnerFeedback => entry !== undefined)
      .reduce<Timestamp | undefined>(
        (latest, entry) =>
          latest === undefined || timestampMs(entry.recordedAt) >= timestampMs(latest)
            ? entry.recordedAt
            : latest,
        undefined,
      );
    return hasEquivalentProposal(
      state.proposals,
      parameters,
      plan.currentRevision.revisionId,
      state.consent.consentVersion,
      pacingEvidenceAt,
    )
      ? succeed(undefined)
      : proposalFor(
          plan,
          state,
          now,
          allocator,
          parameters,
          basis as [PersonalizationProposalBasis, ...PersonalizationProposalBasis[]],
          `Based on explicit ${preference === 'slower' ? 'difficulty or pace' : 'difficulty or pace'} feedback for this plan, consider a ${preference} pacing preference. Your accepted plan will not change automatically.`,
        );
  }

  const items = currentItems(plan);
  const progressByItem = new Map(
    plan.progress
      .filter(
        (record) =>
          record.ownerId === plan.ownerId && record.planId === plan.planId,
      )
      .map((record) => [record.itemId, record.state]),
  );
  const hasConfirmedProgress = [...progressByItem.values()].some(
    (stateValue) => stateValue !== 'not_started',
  );
  const progressEvidenceAt = plan.progress
    .filter(
      (record) =>
        record.ownerId === plan.ownerId &&
        record.planId === plan.planId &&
        record.state !== 'not_started',
    )
    .reduce<Timestamp | undefined>(
      (latest, record) =>
        latest === undefined || timestampMs(record.lastConfirmedAt) >= timestampMs(latest)
          ? record.lastConfirmedAt
          : latest,
      undefined,
    );
  const nextItem = items.find(
    (item) => progressByItem.get(item.itemId) !== 'completed_by_learner',
  );
  if (hasConfirmedProgress && nextItem !== undefined) {
    const parameters: PersonalizationProposalParameters = {
      kind: 'recommend_existing_next_step',
      itemId: nextItem.itemId,
    };
    return hasEquivalentProposal(
      state.proposals,
      parameters,
      plan.currentRevision.revisionId,
      state.consent.consentVersion,
      progressEvidenceAt,
    )
      ? succeed(undefined)
      : proposalFor(
          plan,
          state,
          now,
          allocator,
          parameters,
          ['confirmed_progress'],
          'Based on your confirmed progress in this plan, consider the existing next step. The accepted plan and your progress will not change automatically.',
        );
  }
  return succeed(undefined);
};

export const evaluatePersonalization = (
  command: EvaluatePersonalizationCommand,
): DomainResult<PersonalizationEvaluation> => {
  const context = validatePlanContext(command.plan, command.state, command.ownerId);
  if (!context.ok) {
    return context;
  }
  const now = validateTimestamp(command.now, 'now');
  if (!now.ok) {
    return now;
  }
  const state = context.value.state;
  if (state.consent.state !== 'enabled') {
    return succeed({ state, proposals: state.proposals });
  }

  const currentRevisionId = context.value.plan.currentRevision.revisionId;
  const expired = state.proposals.map((proposal) => {
    if (proposal.status !== 'proposed') {
      return proposal;
    }
    if (proposal.sourceRevisionId !== currentRevisionId) {
      return {
        ...proposal,
        status: 'withdrawn' as const,
        proposalVersion: proposal.proposalVersion + 1,
        decidedAt: now.value,
      };
    }
    return timestampMs(proposal.expiresAt) <= timestampMs(now.value)
      ? {
          ...proposal,
          status: 'expired' as const,
          proposalVersion: proposal.proposalVersion + 1,
          decidedAt: now.value,
        }
      : proposal;
  });
  const expiredState = expired.some((proposal, index) => proposal !== state.proposals[index])
    ? stateAfter(state, { proposals: expired })
    : state;
  const itemIds = currentItemIds(context.value.plan);
  const eligibleFeedback = expiredState.feedback.filter(
    (feedback) =>
      feedback.ownerId === state.ownerId &&
      feedback.planId === state.planId &&
      feedback.consentVersion === state.consent.consentVersion &&
      feedback.status === 'active' &&
      (feedback.itemId === undefined || itemIds.has(feedback.itemId)),
  );
  const suggestion = suggestionFromFeedback(
    context.value.plan,
    expiredState,
    eligibleFeedback,
    now.value,
    command.allocator,
  );
  if (!suggestion.ok) {
    return suggestion;
  }
  if (suggestion.value === undefined) {
    return succeed({
      state: expiredState,
      proposals: expiredState.proposals,
    });
  }
  const nextState = stateAfter(expiredState, {
    proposals: [...expiredState.proposals, suggestion.value],
  });
  return succeed({
    state: nextState,
    proposals: nextState.proposals,
    createdProposal: suggestion.value,
  });
};

const isCurrentProposal = (
  proposal: PersonalizationProposal,
  state: PersonalizationState,
): boolean =>
  proposal.ownerId === state.ownerId &&
  proposal.planId === state.planId &&
  proposal.consentVersion === state.consent.consentVersion;

const handoffFor = (
  proposal: PersonalizationProposal,
  createdAt: Timestamp,
): PersonalizationRevisionHandoff | undefined => {
  let intent: PersonalizationHandoffIntent;
  if (proposal.parameters.kind === 'suggest_pacing_preference') {
    intent = {
      kind: 'pacing',
      preference: proposal.parameters.preference,
    };
  } else if (proposal.parameters.kind === 'request_plan_revision') {
    intent = {
      kind: 'plan_revision',
      reason: proposal.parameters.reason,
      ...(proposal.parameters.itemId === undefined
        ? {}
        : { itemId: proposal.parameters.itemId }),
    };
  } else {
    return undefined;
  }
  return {
    requestId: proposal.proposalId,
    proposalId: proposal.proposalId,
    ownerId: proposal.ownerId,
    planId: proposal.planId,
    sourceRevisionId: proposal.sourceRevisionId,
    intent,
    createdAt,
  };
};

export const decidePersonalizationProposal = (
  command: DecidePersonalizationProposalCommand,
): DomainResult<PersonalizationDecision> => {
  const context = validatePlanContext(command.plan, command.state, command.ownerId);
  if (!context.ok) {
    return context;
  }
  if (
    context.value.state.consent.state !== 'enabled' &&
    context.value.state.consent.state !== 'paused'
  ) {
    return invalidTransition();
  }
  const proposalId = validateProposalId(command.proposalId);
  if (!proposalId.ok) {
    return proposalId;
  }
  if (command.decision !== 'accept' && command.decision !== 'reject') {
    return malformed('decision');
  }
  if (!isNonNegativeInteger(command.expectedProposalVersion)) {
    return malformed('expectedProposalVersion');
  }
  const now = validateTimestamp(command.now, 'now');
  if (!now.ok) {
    return now;
  }
  const current = context.value.state.proposals.find(
    (proposal) => proposal.proposalId === proposalId.value,
  );
  if (current === undefined || !isCurrentProposal(current, context.value.state)) {
    return invalidRelationship('proposalId');
  }
  if (current.proposalVersion !== command.expectedProposalVersion) {
    return stalePersonalization(
      'expectedProposalVersion',
      command.expectedProposalVersion,
      current.proposalVersion,
    );
  }
  if (current.status !== 'proposed') {
    return invalidTransition();
  }
  if (timestampMs(current.expiresAt) <= timestampMs(now.value)) {
    return invalidTransition();
  }
  if (current.sourceRevisionId !== context.value.plan.currentRevision.revisionId) {
    return staleRevision();
  }
  const currentPlanItemIds = currentItemIds(context.value.plan);
  const proposalItemId =
    current.parameters.kind === 'recommend_existing_next_step' ||
    current.parameters.kind === 'request_plan_revision'
      ? current.parameters.itemId
      : undefined;
  if (proposalItemId !== undefined && !currentPlanItemIds.has(proposalItemId)) {
    return invalidRelationship('proposalId');
  }

  const proposal: PersonalizationProposal = {
    ...current,
    status: command.decision === 'accept' ? 'accepted' : 'rejected',
    proposalVersion: current.proposalVersion + 1,
    decidedAt: now.value,
  };
  const state = stateAfter(context.value.state, {
    proposals: context.value.state.proposals.map((entry) =>
      entry.proposalId === proposal.proposalId ? proposal : entry,
    ),
  });
  const handoff =
    command.decision === 'accept' ? handoffFor(proposal, now.value) : undefined;
  return succeed({
    state,
    proposal,
    ...(handoff === undefined ? {} : { handoff }),
  });
};
