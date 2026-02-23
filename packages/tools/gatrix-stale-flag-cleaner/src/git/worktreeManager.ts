import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import simpleGit from 'simple-git';
import { RepoConfig, StaleFlagInfo } from '../types';

// ============================================================
// Git worktree manager
// ============================================================

const BRANCH_PREFIX = 'remove-stale-flag';

/**
 * Create a branch name for removing the given flag.
 */
export function buildBranchName(flagKey: string): string {
  // Sanitize flag key for use as a git branch name
  const sanitized = flagKey.replace(/[^a-zA-Z0-9-_.]/g, '-').toLowerCase();
  return `${BRANCH_PREFIX}/${sanitized}`;
}

/**
 * Build the worktree path for a given flag + repo combination.
 */
export function buildWorktreePath(basePath: string, repo: string, flagKey: string): string {
  const sanitized = flagKey.replace(/[^a-zA-Z0-9-_.]/g, '-').toLowerCase();
  return path.join(basePath, `${repo}--${sanitized}`);
}

/**
 * Fetch latest changes from origin and run mainSetup commands in the main repo.
 */
export async function prepareMainRepo(repoPath: string, repoConfig: RepoConfig): Promise<void> {
  const git = simpleGit(repoPath);
  await git.fetch('origin');

  if (repoConfig.mainSetup && repoConfig.mainSetup.length > 0) {
    for (const cmd of repoConfig.mainSetup) {
      runShellCommand(cmd, repoPath);
    }
  }
}

/**
 * Create a git worktree for the given flag removal branch.
 * If the worktree already exists, reuse it.
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  const git = simpleGit(repoPath);

  if (fs.existsSync(worktreePath)) {
    // Worktree already exists — reuse it
    return;
  }

  // Create a new worktree on a fresh branch from baseBranch
  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, `origin/${baseBranch}`]);
}

/**
 * Run repo setup commands inside the worktree.
 */
export function runWorktreeSetup(worktreePath: string, repoConfig: RepoConfig): void {
  const setup = repoConfig.setup ?? [];
  for (const cmd of setup) {
    runShellCommand(cmd, worktreePath);
  }
}

/**
 * Run a shell command, inheriting stdio so output is visible to the user.
 */
function runShellCommand(cmd: string, cwd: string): void {
  const result = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status ?? 'null'}): ${cmd}`);
  }
}

/**
 * Check whether the worktree has any uncommitted changes after the agent ran.
 */
export async function hasChanges(worktreePath: string): Promise<boolean> {
  const git = simpleGit(worktreePath);
  const status = await git.status();
  return !status.isClean();
}

/**
 * Stage all changes and commit inside the worktree.
 */
export async function stageAndCommit(worktreePath: string, flag: StaleFlagInfo): Promise<void> {
  const git = simpleGit(worktreePath);
  await git.add('.');
  await git.commit(
    `chore: remove stale flag ${flag.key}\n\nFlag was ${flag.reason.toLowerCase()}.\nAlways keep ${flag.keepBranch} path.`,
  );
}

/**
 * Remove the worktree after a PR has been merged or the run completed.
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.raw(['worktree', 'remove', '--force', worktreePath]);
}
