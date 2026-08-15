import { Command } from "commander";
import path from "node:path";
import { loadConfig } from "../config.js";
import { getChangedFiles } from "../git.js";
import { DependencyGraphManager } from "../graph/dependencyGraph.js";
import { runGate } from "../integrations/agentPermit.js";
import { defaultRunnerRegistry } from "../runners/index.js";

const program = new Command();

program
  .name("agent-test-gate")
  .description("Smart Test Impact Analysis CLI for gating AI agent commits")
  .version("0.1.0");

program
  .command("run")
  .description("Run affected tests for current git changes or commit range")
  .option("-s, --staged", "Check staged git changes")
  .option("-c, --commit <range>", "Check specific git commit range (e.g. HEAD~1..HEAD)")
  .option("-r, --runner <runner>", "Test runner to use (vitest, jest, pytest)")
  .option("-a, --all", "Force running all tests regardless of impact graph")
  .option("--config <path>", "Path to .agent-test-gate.json config file")
  .action(async (opts) => {
    console.log("🔍 Computing affected tests and running gate enforcement...\n");

    const result = await runGate(undefined, {
      staged: opts.staged,
      commitRange: opts.commit,
      runner: opts.runner,
      configPath: opts.config,
      forceAll: opts.all
    });

    if (result.ranFullSuite) {
      if (result.fallbackReason) {
        console.warn(`⚠️  Warning: ${result.fallbackReason}`);
        console.warn("   Falling back to running the FULL test suite.\n");
      } else {
        console.log("ℹ️  Running FULL test suite.\n");
      }
    } else {
      console.log(`🎯 Found ${result.affectedTests.length} affected test(s):\n${result.affectedTests.map(f => `  • ${f}`).join("\n")}\n`);
    }

    console.log(`🚀 Executing runner: ${result.runnerName}\n`);
    console.log(result.output);

    if (!result.passed) {
      console.error("\n❌ Commit Gated: Affected tests failed!");
      process.exit(result.exitCode || 1);
    } else {
      console.log("\n✅ Gate Passed: All affected tests passed!");
      process.exit(0);
    }
  });

program
  .command("check")
  .argument("[files...]", "Specific changed files to dry-run analysis for")
  .option("-s, --staged", "Use staged git files if no files specified")
  .option("-c, --commit <range>", "Use commit range git files if no files specified")
  .option("--config <path>", "Path to .agent-test-gate.json config file")
  .action(async (filesArg: string[], opts) => {
    const cwd = process.cwd();
    const config = loadConfig(opts.config, cwd);

    let changedFiles = filesArg;
    if (!changedFiles || changedFiles.length === 0) {
      changedFiles = getChangedFiles({ staged: opts.staged, commitRange: opts.commit, cwd });
    }

    if (changedFiles.length === 0) {
      console.log("No changed files detected.");
      return;
    }

    console.log(`📋 Analyzing impact for ${changedFiles.length} changed file(s):`);
    changedFiles.forEach(f => console.log(`  • ${f}`));
    console.log("");

    const graphManager = new DependencyGraphManager(config);
    await graphManager.buildGraph();

    const affected = graphManager.getAffectedTests(changedFiles);

    console.log(`📊 Graph Confidence Score: ${(affected.confidenceScore * 100).toFixed(1)}%`);
    if (affected.fallbackToAll) {
      console.warn(`⚠️  Fallback Warning: ${affected.fallbackReason}`);
      console.warn("   Impact analysis would trigger FULL test suite execution.");
    }

    console.log(`\n🧪 Affected Tests (${affected.affectedTests.length} of ${affected.allTests.length} total):`);
    if (affected.affectedTests.length === 0) {
      console.log("  (None - no test files depend on these changes)");
    } else {
      affected.affectedTests.forEach(t => console.log(`  • ${t}`));
    }
  });

program
  .command("graph")
  .argument("[files...]", "Specific files to inspect in dependency graph")
  .option("--json", "Output raw JSON dependency graph")
  .option("--config <path>", "Path to .agent-test-gate.json config file")
  .action(async (filesArg: string[], opts) => {
    const cwd = process.cwd();
    const config = loadConfig(opts.config, cwd);

    const graphManager = new DependencyGraphManager(config);
    await graphManager.buildGraph();

    const files = filesArg && filesArg.length > 0 ? filesArg : getChangedFiles({ cwd });
    const affected = graphManager.getAffectedTests(files);

    if (opts.json) {
      console.log(JSON.stringify({
        changedFiles: affected.changedFiles,
        affectedTests: affected.affectedTests,
        confidenceScore: affected.confidenceScore,
        graph: affected.graph,
        reverseGraph: affected.reverseGraph
      }, null, 2));
    } else {
      console.log("🕸️  Dependency Graph Visualization:");
      console.log(JSON.stringify(affected.graph, null, 2));
    }
  });

program.parse(process.argv);
