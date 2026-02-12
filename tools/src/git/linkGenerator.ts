import { GitProvider } from '../types';
import { normalizePath } from '../utils';

// ============================================================
// Code deep link generator
// Supports GitHub.com, GitLab.com, Bitbucket.org,
// and self-hosted instances (GitHub Enterprise, GitLab CE/EE,
// Gitea, etc.)
// ============================================================

/**
 * Detect the git provider from the remote URL.
 * Supports self-hosted instances by checking URL patterns.
 */
export function detectProvider(remoteUrl: string): GitProvider {
  const url = remoteUrl.toLowerCase();
  if (url.includes('github.com') || url.includes('github')) return 'github';
  if (url.includes('gitlab.com') || url.includes('gitlab')) return 'gitlab';
  if (url.includes('bitbucket.org') || url.includes('bitbucket')) return 'bitbucket';
  return 'unknown';
}

/**
 * Parse a git remote URL (SSH or HTTPS) into its components.
 * Handles both cloud and self-hosted instances, including custom ports.
 *
 * Examples:
 *   git@github.com:owner/repo.git
 *   https://github.com/owner/repo.git
 *   git@gitlab.mycompany.com:team/project.git
 *   https://gitlab.internal.corp/team/project.git
 *   ssh://git@git.mycompany.com:2222/team/project.git
 *   http://orca.company.in:30080/uwo-dev/game.git
 */
function parseRemoteUrl(remoteUrl: string): ParsedRemote | null {
  // HTTPS/HTTP format: http(s)://host(:port)/owner/repo.git
  const httpsMatch = remoteUrl.match(/^(https?):\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    const scheme = httpsMatch[1];
    const host = httpsMatch[2]; // includes port if present (e.g., "host:30080")
    const pathParts = httpsMatch[3].split('/');

    if (pathParts.length >= 2) {
      const repo = pathParts[pathParts.length - 1];
      const ownerPath = pathParts.slice(0, -1).join('/');
      return { scheme, host, ownerPath, repo };
    }
  }

  // SSH format: git@host:owner/repo.git or ssh://git@host:port/owner/repo.git
  const sshMatch = remoteUrl.match(
    /^(?:ssh:\/\/)?(?:[^@]+@)?([^:/]+)(?::(\d+))?[:/](.+?)(?:\.git)?$/,
  );
  if (sshMatch) {
    const host = sshMatch[2] ? `${sshMatch[1]}:${sshMatch[2]}` : sshMatch[1];
    const pathParts = sshMatch[3].split('/');

    if (pathParts.length >= 2) {
      const repo = pathParts[pathParts.length - 1];
      const ownerPath = pathParts.slice(0, -1).join('/');
      return { scheme: 'https', host, ownerPath, repo };
    }
  }

  return null;
}

/**
 * Generate a deep link to a specific line in a file.
 * Works with any self-hosted or cloud Git provider.
 * Preserves the original URL scheme (http/https).
 */
export function generateCodeUrl(
  remoteUrl: string,
  commit: string,
  filePath: string,
  line: number,
): string {
  if (!remoteUrl || !commit || commit === 'unknown') return '';

  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) return '';

  const provider = detectProvider(remoteUrl);
  const normalizedPath = normalizePath(filePath);
  const baseUrl = `${parsed.scheme}://${parsed.host}/${parsed.ownerPath}/${parsed.repo}`;

  switch (provider) {
    case 'github':
      // GitHub / GitHub Enterprise
      return `${baseUrl}/blob/${commit}/${normalizedPath}#L${line}`;

    case 'gitlab':
      // GitLab.com / GitLab CE/EE self-hosted
      return `${baseUrl}/-/blob/${commit}/${normalizedPath}#L${line}`;

    case 'bitbucket':
      // Bitbucket Cloud / Bitbucket Server
      return `${baseUrl}/src/${commit}/${normalizedPath}#lines-${line}`;

    case 'unknown':
      // Fallback: assume GitLab-style (most common for self-hosted like Gitea)
      return `${baseUrl}/-/blob/${commit}/${normalizedPath}#L${line}`;

    default:
      return '';
  }
}

// -- Internal types --

interface ParsedRemote {
  scheme: string; // e.g., "http" or "https"
  host: string; // e.g., "orca.motifgames.in:30080"
  ownerPath: string; // e.g., "uwo-dev"
  repo: string; // e.g., "game"
}
