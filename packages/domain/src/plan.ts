import { normalizePlanContent } from './normalize.js';
import { progressRecordsBelongToPlan } from './progress.js';
import {
  allocateIdentifier,
  type CreatePlanCommand,
  type ReplacePlanCommand,
  validateAcceptedAt,
  validateOwnerId,
} from './revisions.js';
import { fail, succeed, type DomainResult } from './errors.js';
import type {
  ActivePlanAggregate,
  PlanAggregate,
  RevisionId,
} from './types.js';

const staleRevision = () =>
  fail('stale_revision', [{ code: 'stale_revision' }]);

const deletedPlan = () => fail('plan_deleted', [{ code: 'plan_deleted' }]);

const malformedPlan = () =>
  fail('malformed_input', [{ code: 'invalid_shape' }]);

export const createPlan = (
  command: CreatePlanCommand,
): DomainResult<ActivePlanAggregate> => {
  const ownerResult = validateOwnerId(command.ownerId);
  if (!ownerResult.ok) {
    return ownerResult;
  }

  const acceptedAtResult = validateAcceptedAt(command.acceptedAt);
  if (!acceptedAtResult.ok) {
    return acceptedAtResult;
  }

  const normalizedResult = normalizePlanContent(
    command.candidate,
    command.allocator,
  );
  if (!normalizedResult.ok) {
    return normalizedResult;
  }

  const planIdResult = allocateIdentifier(command.allocator, 'plan', 'planId');
  if (!planIdResult.ok) {
    return planIdResult;
  }
  const revisionIdResult = allocateIdentifier(
    command.allocator,
    'revision',
    'currentRevision.revisionId',
  );
  if (!revisionIdResult.ok) {
    return revisionIdResult;
  }

  return succeed({
    ownerId: ownerResult.value,
    planId: planIdResult.value,
    lifecycle: 'active',
    currentRevision: {
      revisionId: revisionIdResult.value,
      revisionNumber: 1,
      acceptedAt: acceptedAtResult.value,
    },
    content: normalizedResult.value,
    progress: [],
  });
};

const isActivePlan = (
  plan: PlanAggregate,
): plan is ActivePlanAggregate =>
  plan !== null &&
  typeof plan === 'object' &&
  plan.lifecycle === 'active' &&
  plan.currentRevision !== undefined &&
  plan.content !== undefined;

export const replacePlan = (
  command: ReplacePlanCommand,
): DomainResult<ActivePlanAggregate> => {
  const ownerResult = validateOwnerId(command.ownerId);
  if (!ownerResult.ok) {
    return ownerResult;
  }

  const plan = command.plan;
  if (plan === null || typeof plan !== 'object') {
    return malformedPlan();
  }
  if (plan.ownerId !== ownerResult.value) {
    return fail('owner_unavailable', [{ code: 'owner_unavailable' }]);
  }
  if (plan.lifecycle === 'deleted') {
    return deletedPlan();
  }
  if (!isActivePlan(plan)) {
    return malformedPlan();
  }
  if (!progressRecordsBelongToPlan(plan)) {
    return malformedPlan();
  }

  if (command.expectedRevisionId === undefined) {
    return staleRevision();
  }
  if (command.expectedRevisionId !== plan.currentRevision.revisionId) {
    return staleRevision();
  }

  const acceptedAtResult = validateAcceptedAt(command.acceptedAt);
  if (!acceptedAtResult.ok) {
    return acceptedAtResult;
  }

  const normalizedResult = normalizePlanContent(
    command.candidate,
    command.allocator,
  );
  if (!normalizedResult.ok) {
    return normalizedResult;
  }

  const revisionIdResult = allocateIdentifier(
    command.allocator,
    'revision',
    'currentRevision.revisionId',
  );
  if (!revisionIdResult.ok) {
    return revisionIdResult;
  }

  return succeed({
    ...plan,
    currentRevision: {
      revisionId: revisionIdResult.value as RevisionId,
      revisionNumber: plan.currentRevision.revisionNumber + 1,
      acceptedAt: acceptedAtResult.value,
    },
    content: normalizedResult.value,
  });
};
