import * as fs from 'fs';
import * as path from 'path';
import {
  CleanerConfig,
  AgentConfig,
  OrchestratorConfig,
  WorktreeConfig,
  GitProviderConfig,
} from '../types';

// ============================================================
// Config loader - reads gatrix-stale-flag-config.json
// ============================================================

const CONFIG_FILE = 'gatrix-stale-flag-config.json';

const DEFAULT_AGENT: AgentConfig = {
  type: 'claude',
  timeoutMinutes: 60,
};

const DEFAULT_ORCHESTRATOR: OrchestratorConfig = {
  concurrency: 2,
  maxPrs: 10,
  logDir: './gatrix-cleaner-logs',
};

const DEFAULT_WORKTREES: WorktreeConfig = {
  basePath: '/tmp/gatrix-stale-flag-worktrees',
};

const DEFAULT_GIT: GitProviderConfig = {
  type: 'github',
};

/**
 * Load and validate config from the target-repos directory.
 */
export function loadConfig(targetReposDir: string): CleanerConfig {
  const configPath = path.join(targetReposDir, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\n` +
        `Create a ${CONFIG_FILE} in your target-repos directory.\n` +
        `See README.md for the full config schema.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    throw new Error(`Failed to parse ${configPath}`);
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${CONFIG_FILE} must be a JSON object`);
  }

  const cfg = raw as Partial<CleanerConfig>;

  if (!cfg.repos || Object.keys(cfg.repos).length === 0) {
    throw new Error(`${CONFIG_FILE} must define at least one repo under "repos"`);
  }

  // Validate each repo has a baseBranch (from repo or repoDefaults)
  for (const [name, repo] of Object.entries(cfg.repos)) {
    const baseBranch = repo.baseBranch ?? cfg.repoDefaults?.baseBranch;
    if (!baseBranch) {
      throw new Error(
        `Repo "${name}" is missing "baseBranch". ` +
          `Set it in repos.${name}.baseBranch or repoDefaults.baseBranch.`,
      );
    }
  }

  return {
    agent: { ...DEFAULT_AGENT, ...cfg.agent },
    orchestrator: { ...DEFAULT_ORCHESTRATOR, ...cfg.orchestrator },
    worktrees: { ...DEFAULT_WORKTREES, ...cfg.worktrees },
    git: { ...DEFAULT_GIT, ...cfg.git },
    repos: cfg.repos,
    repoDefaults: cfg.repoDefaults,
  };
}
