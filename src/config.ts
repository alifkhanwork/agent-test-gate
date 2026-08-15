import fs from "node:fs";
import path from "node:path";
import type { AgentTestGateConfig } from "./types.js";

export const DEFAULT_CONFIG: Required<AgentTestGateConfig> = {
  runner: "",
  include: ["src/**/*", "lib/**/*", "app/**/*", "components/**/*", "tests/**/*", "test/**/*", "__tests__/**/*", "*.ts", "*.js", "*.py"],
  exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/coverage/**"],
  testPatterns: [
    "**/*.test.[jt]s",
    "**/*.test.[jt]sx",
    "**/*.spec.[jt]s",
    "**/*.spec.[jt]sx",
    "**/test_*.py",
    "**/*_test.py",
    "**/tests/**/*.py",
    "**/tests/**/*.[jt]s*",
    "**/__tests__/**/*.[jt]s*"
  ],
  confidenceThreshold: 0.8,
  runnerArgs: [],
  cwd: process.cwd()
};

export function loadConfig(configPath?: string, cwd: string = process.cwd()): Required<AgentTestGateConfig> {
  let loaded: Partial<AgentTestGateConfig> = {};

  const fileToTry = configPath
    ? path.resolve(cwd, configPath)
    : path.resolve(cwd, ".agent-test-gate.json");

  if (fs.existsSync(fileToTry)) {
    try {
      const raw = fs.readFileSync(fileToTry, "utf-8");
      loaded = JSON.parse(raw);
    } catch (err) {
      console.warn(`[agent-test-gate] Warning: failed to parse config file at ${fileToTry}:`, err);
    }
  }

  return {
    runner: loaded.runner ?? DEFAULT_CONFIG.runner,
    include: loaded.include ?? DEFAULT_CONFIG.include,
    exclude: loaded.exclude ?? DEFAULT_CONFIG.exclude,
    testPatterns: loaded.testPatterns ?? DEFAULT_CONFIG.testPatterns,
    confidenceThreshold: loaded.confidenceThreshold ?? DEFAULT_CONFIG.confidenceThreshold,
    runnerArgs: loaded.runnerArgs ?? DEFAULT_CONFIG.runnerArgs,
    cwd: loaded.cwd ?? cwd
  };
}
