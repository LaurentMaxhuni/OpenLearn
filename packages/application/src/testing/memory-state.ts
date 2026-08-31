import type {
  PlanAggregate,
  PlanId,
} from '@openlearn/domain';
import type {
  ApplicationStatePort,
  ApplicationTransaction,
} from '../index.js';
import type {
  MutationCommit,
  MutationReference,
  OperationRecord,
  OperationReservation,
  OperationReservationInput,
  StoredOperationOutcome,
} from '../index.js';

const operationKey = (
  ownerId: string,
  capability: string,
  idempotencyKey: string,
): string => `${ownerId}\u0000${capability}\u0000${idempotencyKey}`;

export interface MemoryApplicationState extends ApplicationStatePort {
  seedPlan(plan: PlanAggregate): void;
  getPlan(planId: PlanId): PlanAggregate | undefined;
  listPlans(): readonly PlanAggregate[];
}

export const createMemoryApplicationState = (
  initialPlans: readonly PlanAggregate[] = [],
): MemoryApplicationState => {
  const plans = new Map<string, PlanAggregate>();
  const operations = new Map<string, OperationRecord>();
  const references = new Map<string, MutationReference>();

  const seedPlan = (plan: PlanAggregate): void => {
    plans.set(plan.planId, plan);
  };
  initialPlans.forEach(seedPlan);

  const state: MemoryApplicationState = {
    async readPlan(planId) {
      return plans.get(planId);
    },

    async reserveOperation(input: OperationReservationInput): Promise<OperationReservation> {
      const key = operationKey(input.ownerId, input.capability, input.idempotencyKey);
      const existing = operations.get(key);
      if (existing !== undefined) {
        return { kind: 'existing', operation: existing };
      }

      const operation: OperationRecord = {
        ...input,
        state: 'received',
        fencingVersion: 0,
      };
      operations.set(key, operation);
      return { kind: 'created', operation };
    },

    async runMutation(operation, work): Promise<MutationCommit> {
      const key = operationKey(
        operation.ownerId,
        operation.capability,
        operation.idempotencyKey,
      );
      operations.set(key, operation);
      let pendingPlan: PlanAggregate | undefined;
      const transaction: ApplicationTransaction = {
        async readPlan(planId) {
          return plans.get(planId);
        },
        async writePlan(plan) {
          pendingPlan = plan;
        },
        async commitMutation(outcome: StoredOperationOutcome): Promise<MutationCommit> {
          if (pendingPlan !== undefined) {
            plans.set(pendingPlan.planId, pendingPlan);
          }
          const completed: OperationRecord = {
            ...operation,
            state: outcome.state,
            outcome,
          };
          operations.set(key, completed);
          const reference: MutationReference = {
            operationId: operation.operationId,
            ownerId: operation.ownerId,
            capability: operation.capability,
            requestFingerprint: operation.requestFingerprint,
            outcome,
          };
          references.set(operation.operationId, reference);
          return {
            ...(pendingPlan === undefined ? {} : { plan: pendingPlan }),
            outcome,
            reference,
          };
        },
      };
      return work(transaction);
    },

    async findMutationReference(operationId) {
      return references.get(operationId);
    },

    seedPlan,
    getPlan(planId) {
      return plans.get(planId);
    },
    listPlans() {
      return [...plans.values()];
    },
  };

  return state;
};
