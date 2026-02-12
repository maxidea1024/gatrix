import simpleGit from 'simple-git';
import { BlameInfo } from '../types';

// ============================================================
// Git blame integration using simple-git SDK
// ============================================================

/**
 * Get blame info for a specific line of a file.
 */
export async function getBlameForLine(
  root: string,
  filePath: string,
  line: number,
): Promise<BlameInfo | null> {
  try {
    const git = simpleGit(root);
    const raw = await git.raw(['blame', '-L', `${line},${line}`, '--porcelain', filePath]);

    const lines = raw.split('\n');
    const commitHash = lines[0]?.split(' ')[0] ?? 'unknown';
    const author = extractBlameLine(lines, 'author') ?? 'unknown';
    const email = extractBlameLine(lines, 'author-mail') ?? 'unknown';
    const date = extractBlameLine(lines, 'author-time') ?? 'unknown';

    return { commitHash, author, email, date };
  } catch {
    return null;
  }
}

/**
 * Extract a specific field from git blame porcelain output.
 */
function extractBlameLine(lines: string[], prefix: string): string | null {
  for (const line of lines) {
    if (line.startsWith(prefix + ' ')) {
      return line.slice(prefix.length + 1).replace(/[<>]/g, '');
    }
  }
  return null;
}
