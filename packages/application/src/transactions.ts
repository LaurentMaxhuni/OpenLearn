import type { PlanAggregate, PlanId } from '@openlearn/domain';
import type {
  MutationCommit,
  StoredOperationOutcome,
} from './contracts.js';

export interface ApplicationTransaction {
  readPlan(planId: PlanId): Promise<PlanAggregate | undefined>;
  writePlan(plan: PlanAggregate): Promise<void>;
  commitMutation(outcome: StoredOperationOutcome): Promise<MutationCommit>;
}
