import type {
  ApplyProgressActionInput,
  DeletePlanInput,
  PlanHandoff,
  PlanSummary,
  PlanView,
} from '@openlearn/application';
import { validatePersonalizationState } from '@openlearn/domain';
import type {
  PersonalizationDecision,
  PersonalizationEvaluation,
  PersonalizationState,
} from '@openlearn/domain';

export interface DashboardApiOptions {
  readonly origin?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

export class DashboardApiError extends Error {
  public override readonly name = 'DashboardApiError';

  public constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface DashboardApiClient {
  listPlanSummaries(signal?: AbortSignal): Promise<readonly PlanSummary[]>;
  listPlanViews(signal?: AbortSignal): Promise<readonly PlanView[]>;
  getPlanView(planId: string, signal?: AbortSignal): Promise<PlanView>;
  applyProgressAction(
    input: ApplyProgressActionInput,
  ): Promise<PlanHandoff | undefined>;
  deletePlan(input: DeletePlanInput): Promise<void>;
  getPersonalization(planId: string, signal?: AbortSignal): Promise<PersonalizationState>;
  changePersonalizationConsent(input: {
    readonly planId: string;
    readonly action: 'enable' | 'pause' | 'resume' | 'revoke';
    readonly expectedStateVersion: number;
  }): Promise<PersonalizationState>;
  recordLearnerFeedback(input: {
    readonly planId: string;
    readonly itemId?: string;
    readonly area: string;
    readonly value: string;
    readonly expectedStateVersion: number;
  }): Promise<void>;
  correctLearnerFeedback(input: {
    readonly planId: string;
    readonly feedbackId: string;
    readonly area: string;
    readonly value: string;
    readonly expectedStateVersion: number;
  }): Promise<void>;
  deleteLearnerFeedback(input: {
    readonly planId: string;
    readonly feedbackId: string;
    readonly expectedStateVersion: number;
  }): Promise<PersonalizationState>;
  evaluatePersonalization(input: {
    readonly planId: string;
    readonly expectedStateVersion: number;
  }): Promise<PersonalizationEvaluation>;
  decidePersonalizationProposal(input: {
    readonly planId: string;
    readonly proposalId: string;
    readonly decision: 'accept' | 'reject';
    readonly expectedStateVersion: number;
    readonly expectedProposalVersion: number;
  }): Promise<PersonalizationDecision>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isProgressState = (value: unknown): boolean =>
  value === 'not_started' ||
  value === 'in_progress' ||
  value === 'completed_by_learner';

const isProgressSummary = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  ['totalCount', 'completedCount', 'inProgressCount', 'notStartedCount', 'remainingCount'].every(
    (field) => Number.isInteger(value[field]),
  );

const isContent = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.goal) || !Array.isArray(value.milestones)) {
    return false;
  }
  if (!isString(value.goal.goalId) || !isString(value.goal.title)) return false;
  return value.milestones.every((milestone) => {
    if (!isRecord(milestone) || !isString(milestone.milestoneId) || !isString(milestone.title)) {
      return false;
    }
    if (!Array.isArray(milestone.topics)) return false;
    return milestone.topics.every((topic) => {
      if (!isRecord(topic) || !isString(topic.topicId) || !isString(topic.title)) {
        return false;
      }
      if (!Array.isArray(topic.items)) return false;
      return topic.items.every((item) => {
        if (!isRecord(item) || !isString(item.itemId) || !isString(item.title)) {
          return false;
        }
        if (item.resources !== undefined && !Array.isArray(item.resources)) return false;
        return (item.resources ?? []).every((resource) =>
          isRecord(resource) &&
          isString(resource.resourceId) &&
          isString(resource.label) &&
          (resource.href === undefined || typeof resource.href === 'string') &&
          (resource.opaqueReference === undefined || typeof resource.opaqueReference === 'string'),
        );
      });
    });
  });
};

const isPlanView = (value: unknown): value is PlanView => {
  if (!isRecord(value)) return false;
  const progressSummary = value.progressSummary;
  if (
    !isString(value.planId) ||
    !isString(value.revisionId) ||
    !Number.isInteger(value.revisionNumber) ||
    !isString(value.acceptedAt) ||
    !isContent(value.content) ||
    !Array.isArray(value.missingOptionalPaths) ||
    !value.missingOptionalPaths.every((path) => typeof path === 'string') ||
    !Array.isArray(value.currentProgress) ||
    !value.currentProgress.every(
      (record) =>
        isRecord(record) &&
        isString(record.itemId) &&
        isProgressState(record.state) &&
        Number.isInteger(record.progressVersion),
    ) ||
    !isProgressSummary(progressSummary)
  ) {
    return false;
  }
  return value.dashboardUrl === undefined || isString(value.dashboardUrl);
};

const isPlanSummary = (value: unknown): value is PlanSummary =>
  isRecord(value) &&
  isString(value.planId) &&
  isString(value.revisionId) &&
  Number.isInteger(value.revisionNumber) &&
  isString(value.acceptedAt) &&
  isString(value.goalTitle) &&
  (value.title === undefined || typeof value.title === 'string') &&
  (value.goalDescription === undefined || typeof value.goalDescription === 'string') &&
  (value.nextItemId === undefined || isString(value.nextItemId)) &&
  (value.nextItemTitle === undefined || typeof value.nextItemTitle === 'string') &&
  (value.nextItemDescription === undefined || typeof value.nextItemDescription === 'string') &&
  isProgressSummary(value.progressSummary) &&
  isString(value.dashboardUrl);

const safeMessage = (value: unknown, fallback: string): string =>
  isString(value) && value.length <= 256 ? value : fallback;

const isPersonalizationState = (value: unknown): value is PersonalizationState => {
  try {
    return validatePersonalizationState(value).ok;
  } catch {
    return false;
  }
};

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

export const createDashboardApiClient = (
  options: DashboardApiOptions = {},
): DashboardApiClient => {
  const origin = (options.origin ?? '').trim().replace(/\/+$/u, '');
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (typeof fetcher !== 'function') {
    throw new Error('The dashboard API requires fetch.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new RangeError('The dashboard API timeout must be between 1000 and 120000 milliseconds.');
  }
  let csrfToken: string | undefined;

  const urlFor = (path: string): string => `${origin}${path}`;

  const request = async (
    path: string,
    init: RequestInit = {},
    mutation = false,
  ): Promise<unknown> => {
    const callerSignal = init.signal;
    const signal = init.signal === null || init.signal === undefined
      ? AbortSignal.timeout(timeoutMs)
      : AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]);
    const send = async (url: string, requestInit: RequestInit): Promise<Response> => {
      try {
        return await fetcher(url, { ...requestInit, signal });
      } catch {
        if (callerSignal !== null && callerSignal !== undefined && callerSignal.aborted) {
          throw new DOMException('The request was cancelled.', 'AbortError');
        }
        if (signal.aborted) {
          throw new DashboardApiError(
            'The dashboard request timed out. Refresh to check its latest state before retrying.',
            408,
            true,
          );
        }
        throw new DashboardApiError(
          'The dashboard could not reach the service. Check the connection and try again.',
          503,
          true,
        );
      }
    };
    if (mutation && csrfToken === undefined) {
      const csrfResponse = await send(urlFor('/api/csrf'), {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      const csrfBody = await readBody(csrfResponse);
      if (!csrfResponse.ok || !isRecord(csrfBody) || !isString(csrfBody.csrfToken)) {
        throw new DashboardApiError(
          csrfResponse.status === 401
            ? 'Your dashboard session has expired. Sign in again and retry.'
            : 'Your dashboard session could not be prepared.',
          csrfResponse.status,
          csrfResponse.status >= 500,
        );
      }
      csrfToken = csrfBody.csrfToken;
    }
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (mutation && csrfToken !== undefined) {
      headers.set('x-openlearn-csrf', csrfToken);
    }
    const response = await send(urlFor(path), {
      ...init,
      headers,
      credentials: 'include',
    });
    const body = await readBody(response);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) csrfToken = undefined;
      const error = isRecord(body) ? body.error : undefined;
      const message = isRecord(error) ? error.message : undefined;
      throw new DashboardApiError(
        safeMessage(
          message,
          response.status === 401
            ? 'Your dashboard session has expired. Sign in again and retry.'
            : response.status === 403
              ? 'Your dashboard session could not authorize this request. Refresh the page and try again.'
              : response.status === 409
                ? 'The plan changed. Refresh and try again.'
                : 'The dashboard request could not be completed.',
        ),
        response.status,
        response.status >= 500 || response.status === 429 || response.status === 408,
      );
    }
    return body;
  };

  const valueFrom = <T>(body: unknown, guard: (value: unknown) => value is T): T => {
    if (!isRecord(body) || body.outcome !== 'succeeded' || !guard(body.value)) {
      throw new DashboardApiError('The dashboard received an invalid service response.', 502, true);
    }
    return body.value;
  };

  const personalizationPath = (planId: string): string =>
    `/api/plans/${encodeURIComponent(planId)}/personalization`;

  const postPersonalization = async <T>(
    planId: string,
    action: string,
    input: Record<string, unknown>,
    guard: (value: unknown) => value is T,
  ): Promise<T> => {
    const body = await request(
      personalizationPath(planId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...input, action }),
      },
      true,
    );
    return valueFrom(body, guard);
  };

  const isEvaluation = (value: unknown): value is PersonalizationEvaluation =>
    isRecord(value) &&
    isPersonalizationState(value.state) &&
    Array.isArray(value.proposals) &&
    value.proposals.every(isRecord) &&
    (value.createdProposal === undefined || isRecord(value.createdProposal));

  const isDecision = (value: unknown): value is PersonalizationDecision =>
    isRecord(value) &&
    isPersonalizationState(value.state) &&
    isRecord(value.proposal) &&
    (value.handoff === undefined || isRecord(value.handoff));

  const getPlanView = async (planId: string, signal?: AbortSignal): Promise<PlanView> => {
    const body = await request(`/api/plans/${encodeURIComponent(planId)}`, {
      ...(signal === undefined ? {} : { signal }),
    });
    return valueFrom(body, isPlanView);
  };

  const listPlanSummaries = async (signal?: AbortSignal): Promise<readonly PlanSummary[]> => {
    const body = await request('/api/plans', {
      ...(signal === undefined ? {} : { signal }),
    });
    if (!isRecord(body) || body.outcome !== 'succeeded' || !Array.isArray(body.value)) {
      throw new DashboardApiError('The dashboard received an invalid plan list.', 502, true);
    }
    const summaries = body.value.filter(isPlanSummary);
    if (summaries.length !== body.value.length) {
      throw new DashboardApiError('The dashboard received an invalid plan list.', 502, true);
    }
    return summaries;
  };

  return {
    async listPlanViews(signal): Promise<readonly PlanView[]> {
      const summaries = await listPlanSummaries(signal);
      return Promise.all(summaries.map((summary) => getPlanView(summary.planId, signal)));
    },

    listPlanSummaries,

    getPlanView,

    async applyProgressAction(input): Promise<PlanHandoff | undefined> {
      const body = await request(
        `/api/plans/${encodeURIComponent(input.planId)}/progress`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        true,
      );
      if (!isRecord(body) || body.outcome !== 'succeeded') {
        throw new DashboardApiError('Progress could not be confirmed.', 502, true);
      }
      return isRecord(body.value) && isString(body.value.planId)
        ? body.value as unknown as PlanHandoff
        : undefined;
    },

    async deletePlan(input): Promise<void> {
      const body = await request(
        `/api/plans/${encodeURIComponent(input.planId)}`,
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        true,
      );
      if (!isRecord(body) || body.outcome !== 'succeeded') {
        throw new DashboardApiError('The plan could not be deleted.', 502, true);
      }
    },

    async getPersonalization(planId, signal): Promise<PersonalizationState> {
      const body = await request(personalizationPath(planId), {
        ...(signal === undefined ? {} : { signal }),
      });
      return valueFrom(body, isPersonalizationState);
    },

    changePersonalizationConsent(input): Promise<PersonalizationState> {
      return postPersonalization(
        input.planId,
        'change_consent',
        { consentAction: input.action, expectedStateVersion: input.expectedStateVersion },
        isPersonalizationState,
      );
    },

    async recordLearnerFeedback(input): Promise<void> {
      await postPersonalization(
        input.planId,
        'record_feedback',
        {
          ...(input.itemId === undefined ? {} : { itemId: input.itemId }),
          area: input.area,
          value: input.value,
          expectedStateVersion: input.expectedStateVersion,
        },
        isRecord,
      );
    },

    async correctLearnerFeedback(input): Promise<void> {
      await postPersonalization(
        input.planId,
        'correct_feedback',
        {
          feedbackId: input.feedbackId,
          area: input.area,
          value: input.value,
          expectedStateVersion: input.expectedStateVersion,
        },
        isRecord,
      );
    },

    deleteLearnerFeedback(input): Promise<PersonalizationState> {
      return postPersonalization(
        input.planId,
        'delete_feedback',
        {
          feedbackId: input.feedbackId,
          expectedStateVersion: input.expectedStateVersion,
        },
        isPersonalizationState,
      );
    },

    evaluatePersonalization(input): Promise<PersonalizationEvaluation> {
      return postPersonalization(
        input.planId,
        'evaluate',
        { expectedStateVersion: input.expectedStateVersion },
        isEvaluation,
      );
    },

    decidePersonalizationProposal(input): Promise<PersonalizationDecision> {
      return postPersonalization(
        input.planId,
        'decide_proposal',
        {
          proposalId: input.proposalId,
          decision: input.decision,
          expectedStateVersion: input.expectedStateVersion,
          expectedProposalVersion: input.expectedProposalVersion,
        },
        isDecision,
      );
    },
  };
};
