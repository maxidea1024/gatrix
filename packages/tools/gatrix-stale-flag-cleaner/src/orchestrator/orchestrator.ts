import * as path from 'path';
import * as fs from 'fs';
import pLimit from 'p-limit';
import {
  CleanerConfig,
  StaleFlagInfo,
  FlagRunResult,
  FlagRunStatus,
  OrchestratorSummary,
  RepoConfig,
} from '../types';
import { buildRemovalPrompt } from '../agent/promptBuilder';
import { runAgent } from '../agent/agentRunner';
import { findFilesWithFlag } from '../scanner/fileScanner';
import {
  buildBranchName,
  buildWorktreePath,
  prepareMainRepo,
  createWorktree,
  runWorktreeSetup,
  hasChanges,
  stageAndCommit,
} from '../git/worktreeManager';
import { createPr } from '../git/prCreator';
import { printInfo, printFlagStatus } from '../utils/display';

// ============================================================
// Orchestrator - coordinates fetch → worktree → agent → PR
// ============================================================

export interface OrchestratorRunOptions {
  flags: StaleFlagInfo[];
  config: CleanerConfig;
  targetReposDir: string;
  dryRun: boolean;
}

/**
 * Run the full stale flag removal pipeline for all given flags across all repos.
 */
export async function runOrchestrator(opts: OrchestratorRunOptions): Promise<OrchestratorSummary> {
  const { flags, config, targetReposDir, dryRun } = opts;
  const startedAt = new Date().toISOString();
  const results: FlagRunResult[] = [];

  // Prepare all main repos first (fetch + mainSetup)
  for (const [repoName, repoCfg] of Object.entries(config.repos)) {
    const repoPath = path.join(targetReposDir, repoName);
    if (!fs.existsSync(repoPath)) {
      printInfo(`Repo directory not found, skipping: ${repoPath}`);
      continue;
    }
    printInfo(`Preparing main repo: ${repoName}`);
    await prepareMainRepo(repoPath, resolveRepoConfig(repoCfg, config.repoDefaults));
  }

  // Flatten: one work item = one flag × one repo
  const workItems: Array<{ flag: StaleFlagInfo; repoName: string; repoCfg: RepoConfig }> = [];
  for (const flag of flags) {
    for (const [repoName, repoCfg] of Object.entries(config.repos)) {
      workItems.push({
        flag,
        repoName,
        repoCfg: resolveRepoConfig(repoCfg, config.repoDefaults),
      });
    }
  }

  let prCount = 0;
  const limit = pLimit(config.orchestrator.concurrency);

  const tasks = workItems.map((item) =>
    limit(async () => {
      if (prCount >= config.orchestrator.maxPrs) {
        const result: FlagRunResult = {
          flag: item.flag,
          repo: item.repoName,
          status: 'skipped',
          error: `maxPrs limit (${config.orchestrator.maxPrs}) reached`,
        };
        results.push(result);
        printFlagStatus(item.repoName, item.flag.key, 'skipped');
        return;
      }

      const result = await processSingleFlag({
        flag: item.flag,
        repoName: item.repoName,
        repoCfg: item.repoCfg,
        config,
        targetReposDir,
        dryRun,
      });

      results.push(result);
      printFlagStatus(item.repoName, item.flag.key, result.status, result.prUrl);

      if (result.status === 'pr-created') {
        prCount++;
      }
    }),
  );

  await Promise.all(tasks);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalFlags: flags.length,
    results,
  };
}

// ============================================================
// Single flag processing
// ============================================================

interface ProcessOptions {
  flag: StaleFlagInfo;
  repoName: string;
  repoCfg: RepoConfig;
  config: CleanerConfig;
  targetReposDir: string;
  dryRun: boolean;
}

async function processSingleFlag(opts: ProcessOptions): Promise<FlagRunResult> {
  const { flag, repoName, repoCfg, config, targetReposDir, dryRun } = opts;
  const start = Date.now();

  const repoPath = path.join(targetReposDir, repoName);
  if (!fs.existsSync(repoPath)) {
    return makeResult(flag, repoName, 'failed', start, `Repo not found: ${repoPath}`);
  }

  const branchName = buildBranchName(flag.key);
  const worktreePath = buildWorktreePath(config.worktrees.basePath, repoName, flag.key);

  try {
    // 1. Create worktree
    await createWorktree(repoPath, worktreePath, branchName, repoCfg.baseBranch);

    // 2. Run setup commands in worktree
    runWorktreeSetup(worktreePath, repoCfg);

    // 3. Pre-scan: find files that actually reference this flag.
    //    This narrows the agent's focus and avoids unnecessary full-repo scanning.
    const relevantFiles = findFilesWithFlag(flag.key, worktreePath);
    printInfo(`  ${flag.key}: found ${relevantFiles.length} file(s) with flag references`);

    if (relevantFiles.length === 0) {
      return makeResult(flag, repoName, 'no-changes', start);
    }

    // 4. Build prompt and invoke AI agent
    const prompt = buildRemovalPrompt(flag, relevantFiles);
    const logDir = path.join(config.orchestrator.logDir, repoName);
    const logFile = path.join(logDir, `${flag.key}.log`);
    fs.mkdirSync(logDir, { recursive: true });

    printFlagStatus(repoName, flag.key, 'running');
    const agentResult = await runAgent({
      prompt,
      workspacePath: worktreePath,
      config: config.agent,
      logFile,
    });

    if (!agentResult.success) {
      return makeResult(
        flag,
        repoName,
        'failed',
        start,
        agentResult.timedOut ? 'Agent timed out' : `Agent exited with code ${agentResult.exitCode}`,
      );
    }

    // 4. Check if the agent made any changes
    if (!(await hasChanges(worktreePath))) {
      return makeResult(flag, repoName, 'no-changes', start);
    }

    // 5. Commit changes
    await stageAndCommit(worktreePath, flag);

    // 6. Create PR
    const prResult = await createPr({
      flag,
      repoPath: worktreePath,
      branchName,
      baseBranch: repoCfg.baseBranch,
      provider: config.git,
      dryRun,
    });

    return {
      flag,
      repo: repoName,
      status: prResult.created ? 'pr-created' : 'no-changes',
      prUrl: prResult.prUrl,
      worktreePath,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return makeResult(
      flag,
      repoName,
      'failed',
      start,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ============================================================
// Helpers
// ============================================================

function makeResult(
  flag: StaleFlagInfo,
  repo: string,
  status: FlagRunStatus,
  startMs: number,
  error?: string,
): FlagRunResult {
  return { flag, repo, status, durationMs: Date.now() - startMs, error };
}

function resolveRepoConfig(
  repoCfg: Partial<RepoConfig>,
  defaults?: Partial<RepoConfig>,
): RepoConfig {
  const baseBranch = repoCfg.baseBranch ?? defaults?.baseBranch ?? 'main';
  return {
    baseBranch,
    mainSetup: repoCfg.mainSetup ?? defaults?.mainSetup,
    setup: repoCfg.setup ?? defaults?.setup,
  };
}
