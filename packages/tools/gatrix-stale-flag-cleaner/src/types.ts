// ============================================================
// Core type definitions for gatrix-stale-flag-cleaner
// ============================================================

/**
 * Reason a flag is considered stale.
 */
export type StaleReason = 'archived' | 'fully-enabled' | 'fully-disabled' | 'inactive';

/**
 * Which code path to keep when removing the flag.
 * - enabled: keep the "flag is on" branch
 * - disabled: keep the "flag is off" branch
 */
export type KeepBranch = 'enabled' | 'disabled';

/**
 * Information about a single stale flag returned by the fetcher.
 */
export interface StaleFlagInfo {
  /** Feature flag key */
  key: string;
  /** Human-readable reason this flag is stale */
  reason: string;
  /** Which code path to preserve when removing the flag */
  keepBranch: KeepBranch;
  /** ISO timestamp of the flag's last modification */
  lastModified: string;
  /** Internal stale category */
  staleReason: StaleReason;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Minimal stale flag schema for use with the --input option.
 */
export interface ManualFlagEntry {
  key: string;
  keepBranch: KeepBranch;
  reason?: string;
  lastModified?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Agent configuration
// ============================================================

export type AgentType = 'claude' | 'codex' | 'custom';

// ============================================================
// Git provider configuration
// ============================================================

export type GitProvider = 'github' | 'gitlab';

export interface GitProviderConfig {
  /** Git provider type */
  type: GitProvider;
  /**
   * For GitLab: base URL of the instance (e.g. https://gitlab.example.com).
   * Defaults to https://gitlab.com
   */
  host?: string;
}

export interface AgentConfig {
  /** Agent type: built-in 'claude', 'codex', or 'custom' */
  type: AgentType;
  /** CLI command to run (defaults to agent.type if not specified) */
  command?: string;
  /** Timeout in minutes for a single agent run */
  timeoutMinutes: number;
  /** Extra CLI args appended to the agent invocation */
  args?: string[];
}

// ============================================================
// Orchestrator configuration
// ============================================================

export interface OrchestratorConfig {
  /** Max agents running in parallel */
  concurrency: number;
  /** Stop after creating this many PRs */
  maxPrs: number;
  /** Directory for agent logs */
  logDir: string;
}

// ============================================================
// Repo configuration
// ============================================================

export interface RepoConfig {
  /** Base branch for creating worktree branches (e.g. main, develop) */
  baseBranch: string;
  /** Commands to run once on the main repo before worktree creation */
  mainSetup?: string[];
  /** Commands to run in each worktree before invoking the agent */
  setup?: string[];
}

// ============================================================
// Worktree configuration
// ============================================================

export interface WorktreeConfig {
  /** Base directory where git worktrees are created */
  basePath: string;
}

// ============================================================
// Top-level config file schema (gatrix-stale-flag-config.json)
// ============================================================

export interface CleanerConfig {
  agent: AgentConfig;
  orchestrator: OrchestratorConfig;
  worktrees: WorktreeConfig;
  /** Git provider for PR creation */
  git: GitProviderConfig;
  /** Per-repo configuration. Key = repo directory name under --target-repos */
  repos: Record<string, RepoConfig>;
  /** Default values applied to all repos unless overridden */
  repoDefaults?: Partial<RepoConfig>;
}

// ============================================================
// Run-time state
// ============================================================

export type FlagRunStatus =
  | 'pending'
  | 'running'
  | 'pr-created'
  | 'no-changes'
  | 'skipped'
  | 'failed';

export interface FlagRunResult {
  flag: StaleFlagInfo;
  repo: string;
  status: FlagRunStatus;
  prUrl?: string;
  worktreePath?: string;
  durationMs?: number;
  error?: string;
}

export interface OrchestratorSummary {
  startedAt: string;
  finishedAt: string;
  totalFlags: number;
  results: FlagRunResult[];
}

// ============================================================
// Gatrix backend types
// ============================================================

export interface GatrixFlagDefinition {
  type: string;
  flagType: string;
  archived: boolean;
  updatedAt?: string;
  environments?: Record<string, GatrixEnvironmentData>;
}

export interface GatrixEnvironmentData {
  enabled: boolean;
  rolloutPercentage?: number;
}
