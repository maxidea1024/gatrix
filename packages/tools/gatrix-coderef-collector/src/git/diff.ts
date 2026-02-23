import simpleGit from 'simple-git';

// ============================================================
// Git diff integration using simple-git SDK
// ============================================================

/**
 * Get files changed since a given ref (e.g., origin/main).
 */
export async function getChangedFiles(root: string, since: string): Promise<string[]> {
  try {
    const git = simpleGit(root);
    const diff = await git.diff(['--name-only', since]);

    return diff
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch (err) {
    console.error(`[WARN] Failed to get git diff since ${since}:`, err);
    return [];
  }
}

/**
 * Get files changed (staged and unstaged) in the working directory.
 */
export async function getUncommittedFiles(root: string): Promise<string[]> {
  try {
    const git = simpleGit(root);
    const diff = await git.diff(['--name-only', 'HEAD']);

    return diff
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
