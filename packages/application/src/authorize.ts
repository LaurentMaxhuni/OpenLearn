import type {
  ActorContext,
  ApplicationResult,
  CapabilityScope,
  OperationView,
} from './contracts.js';
import { applicationFailure } from './errors.js';

export const hasCapability = (
  actor: ActorContext,
  capability: CapabilityScope,
): boolean => actor.scopes.includes(capability);

export const missingCapability = <T>(
  operationId: string,
  capability: CapabilityScope,
): ApplicationResult<T> => {
  const operation: OperationView = {
    operationId,
    state: 'rejected',
  };
  return applicationFailure(operation, {
    code: 'missing_capability',
    message: `The ${capability} capability is not available for this actor.`,
    retryable: false,
  });
};
