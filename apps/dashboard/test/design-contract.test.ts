import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const uiSource = readFileSync(
  resolve(process.cwd(), '../../packages/ui/src/components.tsx'),
  'utf8',
);
const dashboardSource = readFileSync(
  resolve(process.cwd(), 'src/app.tsx'),
  'utf8',
);
const dashboardProxySource = readFileSync(
  resolve(process.cwd(), '../../deploy/dashboard/nginx.conf'),
  'utf8',
);

test('marks the learning workspace regions used by the redesigned shell', () => {
  assert.equal(uiSource.includes('data-layout="workbench-shell"'), true);
  assert.equal(uiSource.includes('data-layout="detail-workbench"'), true);
  assert.equal(uiSource.includes('data-region="next-action"'), true);
  assert.equal(uiSource.includes('data-region="outline"'), true);
  assert.equal(uiSource.includes('data-region="focused-item"'), true);
});

test('gives the plans page a single clear continuation point', () => {
  assert.equal(uiSource.includes('Continue here'), true);
  assert.equal(dashboardSource.includes('Connected dashboard'), false);
  assert.equal(dashboardSource.includes('Static fixture preview'), false);
});

test('keeps the deployed connector endpoint on the service upstream', () => {
  assert.equal(dashboardProxySource.includes('location = /mcp'), true);
  assert.equal(
    dashboardProxySource.includes('location = /.well-known/oauth-protected-resource'),
    true,
  );
  assert.equal(dashboardProxySource.includes('proxy_buffering off'), true);
});
