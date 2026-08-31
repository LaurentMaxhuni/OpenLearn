import type {
  MutationCommit,
  MutationReference,
  OperationRecord,
  OperationReservation,
  OperationReservationInput,
  TelemetryEvent,
} from './contracts.js';
import type { ApplicationTransaction } from './transactions.js';
import type {
  PlanAggregate,
  IdentityAllocator,
  PlanId,
} from '@openlearn/domain';

export interface Clock {
  now(): Date;
}

export interface OperationIdGenerator {
  next(): string;
}

export interface ApplicationStatePort {
  readPlan(planId: PlanId): Promise<PlanAggregate | undefined>;
  reserveOperation(
    input: OperationReservationInput,
  ): Promise<OperationReservation>;
  runMutation(
    operation: OperationRecord,
    work: (transaction: ApplicationTransaction) => Promise<MutationCommit>,
  ): Promise<MutationCommit>;
  findMutationReference(operationId: string): Promise<MutationReference | undefined>;
}

export interface TelemetrySink {
  record(event: TelemetryEvent): void | Promise<void>;
}

export interface ApplicationDependencies {
  readonly state: ApplicationStatePort;
  readonly allocator: IdentityAllocator;
  readonly clock: Clock;
  readonly operationIds: OperationIdGenerator;
  readonly telemetry?: TelemetrySink;
  readonly dashboardOrigin: string;
}
