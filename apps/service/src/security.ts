import type { FastifyReply } from 'fastify';

export const SERVICE_SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
} as const;

interface RawHeaderTarget {
  setHeader(name: string, value: string): unknown;
}

export const setRawSecurityHeaders = (response: RawHeaderTarget): void => {
  for (const [name, value] of Object.entries(SERVICE_SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
};

export const securityHeaders = (reply: FastifyReply): void => {
  for (const [name, value] of Object.entries(SERVICE_SECURITY_HEADERS)) {
    reply.header(name, value);
  }
};
