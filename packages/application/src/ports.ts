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
import type {
  InternalOwnerId,
  PersonalizationState,
} from '@openlearn/domain';

export interface Clock {
  now(): Date;
}

export interface OperationIdGenerator {
  next(): string;
}

export type PersonalizationWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: 'conflict' | 'unavailable' };

export interface PersonalizationStatePort {
  readPersonalization(
    ownerId: InternalOwnerId,
    planId: PlanId,
  ): Promise<PersonalizationState | undefined>;
  writePersonalization(
    state: PersonalizationState,
    expectedStateVersion: number,
  ): Promise<PersonalizationWriteResult>;
  purgePersonalization(
    ownerId: InternalOwnerId,
    planId: PlanId,
    expectedStateVersion?: number,
  ): Promise<PersonalizationWriteResult>;
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
