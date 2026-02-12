import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { GitMetadata } from '../types';

// ============================================================
// Git metadata extraction using simple-git SDK
// ============================================================

/**
 * Extract comprehensive git metadata from the repository.
 */
export async function getGitMetadata(root: string): Promise<GitMetadata> {
  const absolutePath = path.resolve(root);
  const gitDir = fs.statSync(absolutePath).isFile() ? path.dirname(absolutePath) : absolutePath;
  const git = simpleGit(gitDir);

  const [repository, branch, commit, remoteUrl, gitRoot] = await Promise.all([
    getRepositoryName(git),
    getCurrentBranch(git),
    getCurrentCommit(git),
    getRemoteUrl(git),
    getGitRoot(git),
  ]);

  return { repository, branch, commit, remoteUrl, gitRoot };
}

/**
 * Get the repository name from git remote URL.
 */
async function getRepositoryName(git: ReturnType<typeof simpleGit>): Promise<string> {
  const url = await getRemoteUrl(git);
  if (!url) return 'unknown';

  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  // Handle HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return 'unknown';
}

/**
 * Get the current branch name.
 */
async function getCurrentBranch(git: ReturnType<typeof simpleGit>): Promise<string> {
  try {
    const branchInfo = await git.branchLocal();
    return branchInfo.current || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get the current commit hash.
 */
async function getCurrentCommit(git: ReturnType<typeof simpleGit>): Promise<string> {
  try {
    return (await git.revparse(['HEAD'])).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Get the remote origin URL.
 */
async function getRemoteUrl(git: ReturnType<typeof simpleGit>): Promise<string> {
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin');
    return origin?.refs?.fetch ?? origin?.refs?.push ?? '';
  } catch {
    return '';
  }
}

/**
 * Get the git repository root directory.
 */
async function getGitRoot(git: ReturnType<typeof simpleGit>): Promise<string> {
  try {
    return (await git.revparse(['--show-toplevel'])).trim();
  } catch {
    return '';
  }
}
