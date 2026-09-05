import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectSourceText,
  runBundleGates,
  runSourceGates,
} from './quality-gates.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('source inspection rejects executable HTML and code sinks', () => {
  const findings = inspectSourceText(
    'element.innerHTML = value; eval(value); new Function(value);',
    'fixture.ts',
  );
  assert.deepEqual(findings, [
    'fixture.ts: HTML injection sink',
    'fixture.ts: dynamic code execution',
  ]);
});

test('repository source satisfies the quality gate contract', async () => {
  await assert.doesNotReject(() => runSourceGates(repositoryRoot));
});

test('bundle gate rejects a JavaScript budget overage', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'openlearn-quality-'));
  try {
    await mkdir(path.join(root, 'apps', 'dashboard', 'dist', 'assets'), { recursive: true });
    await mkdir(path.join(root, 'apps', 'dashboard'), { recursive: true });
    await writeFile(
      path.join(root, 'apps', 'dashboard', 'performance-budget.json'),
      JSON.stringify({ javascriptBytes: 2, stylesheetBytes: 10, totalBytes: 12 }),
    );
    await writeFile(
      path.join(root, 'apps', 'dashboard', 'dist', 'assets', 'app.js'),
      '123',
    );
    await assert.rejects(
      () => runBundleGates(root),
      /javascriptBytes measured 3 bytes exceeds 2 bytes/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
