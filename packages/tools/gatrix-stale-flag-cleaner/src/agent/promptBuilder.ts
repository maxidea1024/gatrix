import * as fs from 'fs';
import * as path from 'path';
import { StaleFlagInfo } from '../types';

// ============================================================
// AI agent prompt builder
// Loads the prompt template from prompts/remove-stale-flag.md and
// interpolates flag-specific variables before passing to the agent.
// ============================================================

const DEFAULT_TEMPLATE_PATH = path.join(__dirname, '..', '..', 'prompts', 'remove-stale-flag.md');
const RELEVANT_FILES_SECTION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'prompts',
  'relevant-files-section.md',
);

/**
 * Build a removal prompt for the given stale flag.
 *
 * @param flag           - The stale flag to remove.
 * @param relevantFiles  - Pre-scanned list of files that reference the flag.
 *                         When provided, a focused file list is injected into the prompt so
 *                         the agent does not scan the entire codebase unnecessarily.
 * @param templatePath   - Override the default template path.
 *
 * Supported template variables:
 *   {{FLAG_KEY}}                  - original flag key (e.g. my-feature-flag)
 *   {{FLAG_KEY_CAMEL}}            - camelCase variant
 *   {{FLAG_KEY_PASCAL}}           - PascalCase variant
 *   {{FLAG_KEY_SNAKE}}            - snake_case variant
 *   {{FLAG_KEY_SCREAMING_SNAKE}}  - SCREAMING_SNAKE_CASE variant
 *   {{KEEP_BRANCH}}               - "enabled" or "disabled"
 *   {{KEEP_BRANCH_LABEL}}         - human-readable label
 *   {{KEEP_BRANCH_BOOL}}          - "true" or "false" (for inline comments)
 *   {{REMOVE_BRANCH}}             - the branch being discarded
 *   {{FLAG_REASON}}               - human-readable stale reason
 *   {{FLAG_REASON_LOWER}}         - lowercase version of the reason
 *   {{LAST_MODIFIED}}             - ISO timestamp of last modification
 *   {{RELEVANT_FILES}}            - newline-separated list of files to focus on
 */
export function buildRemovalPrompt(
  flag: StaleFlagInfo,
  relevantFiles?: string[],
  templatePath?: string,
): string {
  const tplPath = templatePath ?? DEFAULT_TEMPLATE_PATH;

  if (!fs.existsSync(tplPath)) {
    throw new Error(
      `Prompt template not found: ${tplPath}\n` +
        `The prompts/remove-stale-flag.md file must exist in the package directory.`,
    );
  }

  let template = fs.readFileSync(tplPath, 'utf-8');

  // If we know which files reference the flag, inject a focused file list section
  // right after the flag details table so the agent doesn't scan the whole repo.
  if (relevantFiles && relevantFiles.length > 0 && fs.existsSync(RELEVANT_FILES_SECTION_PATH)) {
    const fileSection = fs.readFileSync(RELEVANT_FILES_SECTION_PATH, 'utf-8');
    // Insert after the flag details table (before the Step-by-Step section)
    const insertMarker = '## Step-by-Step Instructions';
    if (template.includes(insertMarker)) {
      template = template.replace(insertMarker, `${fileSection}\n---\n\n${insertMarker}`);
    } else {
      template = template + '\n\n' + fileSection;
    }
  }

  return interpolate(template, flag, relevantFiles ?? []);
}

/**
 * Replace all {{VARIABLE}} placeholders in the template.
 */
function interpolate(template: string, flag: StaleFlagInfo, relevantFiles: string[]): string {
  const removeBranch = flag.keepBranch === 'enabled' ? 'disabled' : 'enabled';
  const keepLabel = flag.keepBranch === 'enabled' ? 'ENABLED (truthy)' : 'DISABLED (falsy)';
  const keepBool = flag.keepBranch === 'enabled' ? 'true' : 'false';

  const vars: Record<string, string> = {
    FLAG_KEY: flag.key,
    FLAG_KEY_CAMEL: toCamelCase(flag.key),
    FLAG_KEY_PASCAL: toPascalCase(flag.key),
    FLAG_KEY_SNAKE: toSnakeCase(flag.key),
    FLAG_KEY_SCREAMING_SNAKE: toScreamingSnake(flag.key),
    KEEP_BRANCH: flag.keepBranch,
    KEEP_BRANCH_LABEL: keepLabel,
    KEEP_BRANCH_BOOL: keepBool,
    REMOVE_BRANCH: removeBranch,
    FLAG_REASON: flag.reason,
    FLAG_REASON_LOWER: flag.reason.toLowerCase(),
    LAST_MODIFIED: flag.lastModified,
    RELEVANT_FILES: relevantFiles.length > 0 ? relevantFiles.join('\n') : '(none found)',
  };

  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

// ============================================================
// Naming convention helpers
// ============================================================

function tokenize(key: string): string[] {
  return key.split(/[-_.]+/).filter((t) => t.length > 0);
}

export function toCamelCase(key: string): string {
  const tokens = tokenize(key);
  if (tokens.length <= 1) return key.toLowerCase();
  return (
    tokens[0].toLowerCase() +
    tokens
      .slice(1)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
      .join('')
  );
}

export function toPascalCase(key: string): string {
  return tokenize(key)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join('');
}

export function toSnakeCase(key: string): string {
  return tokenize(key)
    .map((t) => t.toLowerCase())
    .join('_');
}

export function toScreamingSnake(key: string): string {
  return tokenize(key)
    .map((t) => t.toUpperCase())
    .join('_');
}
