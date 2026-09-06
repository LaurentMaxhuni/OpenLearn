import type { TelemetryEvent, TelemetrySink } from '@openlearn/application';
import type { ServiceMetrics } from './metrics.js';

export interface RedactedTelemetryOptions {
  readonly write?: (line: string) => void | Promise<void>;
  readonly metrics?: ServiceMetrics;
}

const safeLabel = (value: string | undefined, maxLength = 128): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]+$/u.test(trimmed) ? trimmed.slice(0, maxLength) : undefined;
};

const boundedDuration = (value: number | undefined): number | undefined =>
  value === undefined || !Number.isFinite(value)
    ? undefined
    : Math.max(0, Math.min(Math.round(value), 86_400_000));

/** Emits only bounded labels and outcome metadata; no prompts, tokens, or plan data. */
export const createRedactedTelemetrySink = (
  options: RedactedTelemetryOptions = {},
): TelemetrySink => {
  const write = options.write ?? ((line: string) => process.stderr.write(line));
  return {
    record: async (event: TelemetryEvent): Promise<void> => {
      options.metrics?.recordApplicationTransition(event.transition);
      const record = {
        service: 'openlearn',
        type: 'application_transition',
        ...(safeLabel(event.operationId) === undefined ? {} : { operationId: safeLabel(event.operationId) }),
        ...(safeLabel(event.requestId) === undefined ? {} : { requestId: safeLabel(event.requestId) }),
        capability: event.capability,
        actorClass: event.actorClass,
        transition: event.transition,
        ...(boundedDuration(event.durationMs) === undefined
          ? {}
          : { durationMs: boundedDuration(event.durationMs) }),
        ...(safeLabel(event.validationCategory, 64) === undefined
          ? {}
          : { validationCategory: safeLabel(event.validationCategory, 64) }),
      };
      await write(`${JSON.stringify(record)}\n`);
    },
  };
};
