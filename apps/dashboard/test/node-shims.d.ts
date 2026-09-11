declare module 'node:test' {
  type TestFunction = (name: string, fn: () => void | Promise<void>) => void;

  const test: TestFunction;

  export default test;
}

declare module 'node:assert/strict' {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: Assert;

  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function resolve(...segments: string[]): string;
}

declare const process: {
  cwd(): string;
};
