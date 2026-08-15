import path from "node:path";
import { describe, expect, it } from "vitest";
import { JestAdapter, PytestAdapter, RunnerRegistry, VitestAdapter } from "../src/runners/index.js";

describe("TestRunnerAdapter Registry & Detection", () => {
  const registry = new RunnerRegistry();

  it("registers and retrieves adapters", () => {
    expect(registry.get("vitest")).toBeInstanceOf(VitestAdapter);
    expect(registry.get("jest")).toBeInstanceOf(JestAdapter);
    expect(registry.get("pytest")).toBeInstanceOf(PytestAdapter);
  });

  it("detects Vitest adapter when vitest is installed in project", async () => {
    const cwd = path.resolve(__dirname, ".."); // root agent-test-gate directory
    const detected = await registry.detectRunner(cwd);
    expect(detected.name).toBe("vitest");
  });

  it("detects Pytest adapter when python files exist", async () => {
    const pyCwd = path.resolve(__dirname, "../python/agent-test-gate-pytest");
    const detected = await registry.detectRunner(pyCwd);
    expect(detected.name).toBe("pytest");
  });
});
