import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOTS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_DIRECTORY_NAMES = new Set(['.git', 'dist', 'dist-test', 'node_modules']);

const DANGEROUS_SOURCE_PATTERNS = [
  { label: 'HTML injection sink', pattern: /dangerouslySetInnerHTML|\.innerHTML\b/u },
  { label: 'dynamic code execution', pattern: /\beval\s*\(|\bnew\s+Function\s*\(/u },
  { label: 'native process execution', pattern: /(?:node:)?child_process|execFile\s*\(|spawn\s*\(/u },
];

const readDirectoryFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readDirectoryFiles(entryPath)));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
};

const isTestFile = (filePath) => {
  const normalized = filePath.replaceAll('\\', '/');
  return normalized.includes('/test/') || /\.(?:test|spec)\.[^.]+$/u.test(normalized);
};

export const inspectSourceText = (text, label) => {
  const findings = DANGEROUS_SOURCE_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label: findingLabel }) => `${label}: ${findingLabel}`);
  return findings;
};

const readRequiredFile = async (root, relativePath, failures) => {
  const filePath = path.join(root, ...relativePath.split('/'));
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    failures.push(`missing required file: ${relativePath}`);
    return '';
  }
};

const sourceGateChecks = async (root) => {
  const failures = [];
  const sourceFiles = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    const sourcePath = path.join(root, sourceRoot);
    try {
      sourceFiles.push(...(await readDirectoryFiles(sourcePath)));
    } catch {
      failures.push(`missing source root: ${sourceRoot}`);
    }
  }

  for (const filePath of sourceFiles) {
    if (isTestFile(filePath)) {
      continue;
    }
    const text = await readFile(filePath, 'utf8');
    failures.push(...inspectSourceText(text, path.relative(root, filePath)));
  }

  const uiStyles = await readRequiredFile(root, 'packages/ui/styles.css', failures);
  if (!uiStyles.includes(':focus-visible')) {
    failures.push('accessibility: packages/ui/styles.css must define a visible focus indicator');
  }
  if (!uiStyles.includes('prefers-reduced-motion')) {
    failures.push('accessibility: packages/ui/styles.css must define reduced-motion behavior');
  }
  const uiComponents = await readRequiredFile(root, 'packages/ui/src/components.tsx', failures);
  if (!uiComponents.includes('useId')) {
    failures.push('accessibility: reusable UI components must use instance-scoped IDs');
  }
  if (!uiComponents.includes('data-focus-target="focused-item"')) {
    failures.push('accessibility: focused content must expose a focus target');
  }

  const dashboardIndex = await readRequiredFile(root, 'apps/dashboard/index.html', failures);
  if (!/<html\s+lang="[A-Za-z-]+"/u.test(dashboardIndex)) {
    failures.push('accessibility: dashboard document language is missing');
  }
  if (!dashboardIndex.includes('Content-Security-Policy')) {
    failures.push('security: dashboard document policy is missing');
  }

  const rootPackageText = await readRequiredFile(root, 'package.json', failures);
  try {
    const rootPackage = JSON.parse(rootPackageText);
    for (const scriptName of ['lint', 'typecheck', 'test', 'build', 'verify']) {
      if (typeof rootPackage.scripts?.[scriptName] !== 'string') {
        failures.push(`quality: root package is missing the ${scriptName} script`);
      }
    }
  } catch {
    failures.push('quality: package.json is not valid JSON');
  }

  const serviceSecurity = await readRequiredFile(root, 'apps/service/src/security.ts', failures);
  if (!serviceSecurity.includes('securityHeaders')) {
    failures.push('security: service securityHeaders helper is missing');
  }
  const mcpContracts = await readRequiredFile(root, 'packages/mcp/src/contracts.ts', failures);
  if (!mcpContracts.includes('MCP_MAX_REQUEST_BYTES')) {
    failures.push('security: MCP request bound is missing');
  }
  await readRequiredFile(root, 'apps/dashboard/performance-budget.json', failures);

  return failures;
};

const byteCount = async (directory, extension) => {
  let total = 0;
  let files = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await byteCount(entryPath, extension);
      total += nested.total;
      files += nested.files;
    } else if (path.extname(entry.name).toLowerCase() === extension) {
      total += (await stat(entryPath)).size;
      files += 1;
    }
  }
  return { total, files };
};

export const runSourceGates = async (root) => {
  const failures = await sourceGateChecks(root);
  if (failures.length > 0) {
    throw new Error(`Source quality gates failed:\n- ${failures.join('\n- ')}`);
  }
  return { passed: true, failures: [] };
};

export const runBundleGates = async (root) => {
  const budgetPath = path.join(root, 'apps', 'dashboard', 'performance-budget.json');
  const distPath = path.join(root, 'apps', 'dashboard', 'dist', 'assets');
  const budget = JSON.parse(await readFile(budgetPath, 'utf8'));
  const javascript = await byteCount(distPath, '.js');
  const stylesheet = await byteCount(distPath, '.css');
  const measured = {
    javascriptBytes: javascript.total,
    stylesheetBytes: stylesheet.total,
    totalBytes: javascript.total + stylesheet.total,
    javascriptFiles: javascript.files,
    stylesheetFiles: stylesheet.files,
  };
  const failures = [];
  for (const key of ['javascriptBytes', 'stylesheetBytes', 'totalBytes']) {
    if (!Number.isInteger(budget[key]) || budget[key] < 0) {
      failures.push(`performance: ${key} budget is invalid`);
    } else if (measured[key] > budget[key]) {
      failures.push(`performance: ${key} measured ${measured[key]} bytes exceeds ${budget[key]} bytes`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Bundle performance gates failed:\n- ${failures.join('\n- ')}`);
  }
  return { passed: true, measured, budget };
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (mode === 'source') {
  await runSourceGates(root);
  process.stdout.write('Source quality gates passed.\n');
} else if (mode === 'bundle') {
  const result = await runBundleGates(root);
  process.stdout.write(`Bundle performance gates passed: ${JSON.stringify(result.measured)}\n`);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  process.stderr.write('Usage: node scripts/quality-gates.mjs <source|bundle>\n');
  process.exitCode = 2;
}
