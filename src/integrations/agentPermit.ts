import { loadConfig } from "../config.js";
import { getChangedFiles } from "../git.js";
import { DependencyGraphManager } from "../graph/dependencyGraph.js";
import { defaultRunnerRegistry } from "../runners/index.js";
import type { AffectedTestsResult, GateResult, RunGateOptions } from "../types.js";

/**
 * Computes affected tests for a given list of changed files or git diff
 */
export async function getAffectedTests(
  changedFiles?: string[],
  options: { configPath?: string; cwd?: string } = {}
): Promise<AffectedTestsResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(options.configPath, cwd);

  const files = changedFiles ?? getChangedFiles({ cwd });
  const graphManager = new DependencyGraphManager(config);
  await graphManager.buildGraph();

  return graphManager.getAffectedTests(files);
}

/**
 * Runs gate enforcement: computes affected tests and executes them using the active runner.
 * Used by agent-permit or pre-commit hooks to allow or deny a commit.
 */
export async function runGate(
  changedFiles?: string[],
  options: RunGateOptions = {}
): Promise<GateResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(options.configPath, cwd);

  let files = changedFiles;
  if (!files || files.length === 0) {
    files = getChangedFiles({
      staged: options.staged,
      commitRange: options.commitRange,
      cwd
    });
  }

  const graphManager = new DependencyGraphManager(config);
  await graphManager.buildGraph();

  const affectedResult = graphManager.getAffectedTests(files);
  const runner = await defaultRunnerRegistry.detectRunner(cwd, options.runner ?? config.runner);

  let testsToRun: string[] = [];
  let ranAll = false;
  let fallbackReason = affectedResult.fallbackReason;

  if (options.forceAll || affectedResult.fallbackToAll || affectedResult.affectedTests.length === 0) {
    ranAll = true;
    testsToRun = affectedResult.allTests;
  } else {
    testsToRun = affectedResult.affectedTests;
  }

  const runResult = await runner.runTests({
    testFiles: testsToRun,
    cwd,
    extraArgs: config.runnerArgs,
    runAll: ranAll
  });

  return {
    passed: runResult.success,
    exitCode: runResult.exitCode,
    affectedTests: testsToRun,
    ranFullSuite: ranAll,
    fallbackReason,
    runnerName: runner.name,
    output: runResult.output
  };
}
