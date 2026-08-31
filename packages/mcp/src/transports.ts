import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Readable, Writable } from 'node:stream';

export const createStdioServerTransport = (
  stdin?: Readable,
  stdout?: Writable,
): StdioServerTransport =>
  stdin === undefined && stdout === undefined
    ? new StdioServerTransport()
    : new StdioServerTransport(stdin, stdout);

export const createStreamableHttpServerTransport = (
  options?: StreamableHTTPServerTransportOptions,
): StreamableHTTPServerTransport =>
  options === undefined
    ? new StreamableHTTPServerTransport()
    : new StreamableHTTPServerTransport(options);

export const createStatelessStreamableHttpServerTransport = (
  options?: Omit<StreamableHTTPServerTransportOptions, 'sessionIdGenerator'>,
): StreamableHTTPServerTransport =>
  new StreamableHTTPServerTransport(({
    ...options,
    sessionIdGenerator: undefined,
  } as unknown) as StreamableHTTPServerTransportOptions);
