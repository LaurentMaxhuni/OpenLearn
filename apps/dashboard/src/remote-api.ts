import type {
  ApplyProgressActionInput,
  DeletePlanInput,
  PlanHandoff,
  PlanSummary,
  PlanView,
} from '@openlearn/application';

export interface DashboardApiOptions {
  readonly origin?: string;
  readonly fetch?: typeof globalThis.fetch;
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
  listPlanViews(): Promise<readonly PlanView[]>;
  getPlanView(planId: string): Promise<PlanView>;
  applyProgressAction(
    input: ApplyProgressActionInput,
  ): Promise<PlanHandoff | undefined>;
  deletePlan(input: DeletePlanInput): Promise<void>;
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
  isProgressSummary(value.progressSummary) &&
  isString(value.dashboardUrl);

const safeMessage = (value: unknown, fallback: string): string =>
  isString(value) && value.length <= 256 ? value : fallback;

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
  if (typeof fetcher !== 'function') {
    throw new Error('The dashboard API requires fetch.');
  }
  let csrfToken: string | undefined;

  const urlFor = (path: string): string => `${origin}${path}`;

  const request = async (
    path: string,
    init: RequestInit = {},
    mutation = false,
  ): Promise<unknown> => {
    if (mutation && csrfToken === undefined) {
      const csrfResponse = await fetcher(urlFor('/api/csrf'), {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      const csrfBody = await readBody(csrfResponse);
      if (!csrfResponse.ok || !isRecord(csrfBody) || !isString(csrfBody.csrfToken)) {
        throw new DashboardApiError('Your dashboard session could not be prepared.', csrfResponse.status, csrfResponse.status >= 500);
      }
      csrfToken = csrfBody.csrfToken;
    }
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (mutation && csrfToken !== undefined) {
      headers.set('x-openlearn-csrf', csrfToken);
    }
    const response = await fetcher(urlFor(path), {
      ...init,
      headers,
      credentials: 'include',
    });
    const body = await readBody(response);
    if (!response.ok) {
      const error = isRecord(body) ? body.error : undefined;
      const message = isRecord(error) ? error.message : undefined;
      throw new DashboardApiError(
        safeMessage(message, response.status === 409 ? 'The plan changed. Refresh and try again.' : 'The dashboard request could not be completed.'),
        response.status,
        response.status >= 500 || response.status === 429,
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

  const getPlanView = async (planId: string): Promise<PlanView> => {
    const body = await request(`/api/plans/${encodeURIComponent(planId)}`);
    return valueFrom(body, isPlanView);
  };

  return {
    async listPlanViews(): Promise<readonly PlanView[]> {
      const body = await request('/api/plans');
      if (!isRecord(body) || body.outcome !== 'succeeded' || !Array.isArray(body.value)) {
        throw new DashboardApiError('The dashboard received an invalid plan list.', 502, true);
      }
      const summaries = body.value.filter(isPlanSummary);
      if (summaries.length !== body.value.length) {
        throw new DashboardApiError('The dashboard received an invalid plan list.', 502, true);
      }
      return Promise.all(summaries.map((summary) => getPlanView(summary.planId)));
    },

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
  };
};
