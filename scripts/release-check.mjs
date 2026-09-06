import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  '.env.example',
  'Dockerfile.service',
  'Dockerfile.dashboard',
  'compose.yaml',
  '.github/workflows/ci.yml',
  'packages/persistence/migrations/001_initial.sql',
  'docs/operations/DEPLOYMENT.md',
  'docs/operations/RECOVERY.md',
  'docs/operations/INCIDENTS.md',
  'docs/release/BETA-FEEDBACK.md',
  'docs/release/STABLE-RELEASE-CHECKLIST.md',
  'docs/quality/PHASE-10-RELEASE-GATE.md',
];

for (const relativePath of requiredFiles) {
  await access(path.join(root, ...relativePath.split('/')));
}

const phase = await readFile(
  path.join(root, 'docs/phases/phase-10-beta-deployment-operations-and-community-release.md'),
  'utf8',
);
if (!phase.includes('Complete')) {
  throw new Error('Phase 10 must be marked Complete before a release check can pass.');
}

process.stdout.write(`Release check passed for ${requiredFiles.length} required artifacts.\n`);
