export interface HttpMetricInput {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
}

export interface ServiceMetrics {
  recordHttpRequest(input: HttpMetricInput): void;
  recordApplicationTransition(transition: string): void;
  renderPrometheus(): string;
}

const labelValue = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');

const increment = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

export const createServiceMetrics = (): ServiceMetrics => {
  const requests = new Map<string, number>();
  const transitions = new Map<string, number>();
  let requestDurationMs = 0;
  let requestCount = 0;

  const recordHttpRequest = (input: HttpMetricInput): void => {
    const method = input.method.toUpperCase().slice(0, 16) || 'UNKNOWN';
    const route = input.route.replace(/\/[A-Za-z0-9._~-]{2,128}/gu, '/:id').slice(0, 128);
    const status = Number.isInteger(input.statusCode) ? String(input.statusCode) : '0';
    increment(requests, `${method}\u0000${route}\u0000${status}`);
    requestDurationMs += Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : 0;
    requestCount += 1;
  };

  const recordApplicationTransition = (transition: string): void => {
    increment(transitions, transition.slice(0, 64));
  };

  const renderPrometheus = (): string => {
    const lines = [
      '# HELP openlearn_http_requests_total HTTP requests handled by the service.',
      '# TYPE openlearn_http_requests_total counter',
    ];
    for (const [key, value] of requests) {
      const [method, route, status] = key.split('\u0000');
      lines.push(
        `openlearn_http_requests_total{method="${labelValue(method ?? 'UNKNOWN')}",route="${labelValue(route ?? 'unknown')}",status="${labelValue(status ?? '0')}"} ${value}`,
      );
    }
    lines.push(
      '# HELP openlearn_application_transitions_total Application lifecycle transitions.',
      '# TYPE openlearn_application_transitions_total counter',
    );
    for (const [transition, value] of transitions) {
      lines.push(
        `openlearn_application_transitions_total{transition="${labelValue(transition)}"} ${value}`,
      );
    }
    lines.push(
      '# HELP openlearn_http_request_duration_ms_sum Sum of HTTP request durations.',
      '# TYPE openlearn_http_request_duration_ms_sum counter',
      `openlearn_http_request_duration_ms_sum ${requestDurationMs.toFixed(3)}`,
      '# HELP openlearn_http_requests_recorded Number of HTTP request durations recorded.',
      '# TYPE openlearn_http_requests_recorded counter',
      `openlearn_http_requests_recorded ${requestCount}`,
    );
    return `${lines.join('\n')}\n`;
  };

  return { recordHttpRequest, recordApplicationTransition, renderPrometheus };
};
