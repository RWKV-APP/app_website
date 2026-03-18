import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const frontendDir = path.join(repoRoot, 'frontend');
const publicDir = path.join(frontendDir, 'public');
const outputPath = path.join(publicDir, 'build-info.json');

function runGit(command) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
);

const dirtyStatus = runGit('git status --porcelain');

const buildInfo = {
  builtAt: new Date().toISOString(),
  buildSource: process.env.APP_BUILD_SOURCE || 'frontend:build',
  gitBranch: runGit('git rev-parse --abbrev-ref HEAD') || 'unknown',
  gitCommit: runGit('git rev-parse HEAD') || 'unknown',
  gitCommitShort: runGit('git rev-parse --short HEAD') || 'unknown',
  gitDirty: Boolean(dirtyStatus),
  packageVersion: rootPackageJson.version || 'unknown',
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

console.log(`Generated build info: ${outputPath}`);
