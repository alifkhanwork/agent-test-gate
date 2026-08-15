import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { DependencyGraphManager } from "../src/graph/dependencyGraph.js";

describe("Fail-safe fallback behavior", () => {
  const fixtureDir = path.resolve(__dirname, "fixtures/dynamic-app");
  const config = loadConfig(undefined, fixtureDir);

  it("detects dynamic imports and triggers fallback when graph confidence drops below threshold", async () => {
    const manager = new DependencyGraphManager(config);
    await manager.buildGraph();

    const result = manager.getAffectedTests(["src/dynamic.ts"]);

    expect(result.confidenceScore).toBeLessThan(config.confidenceThreshold);
    expect(result.fallbackToAll).toBe(true);
    expect(result.fallbackReason).toContain("dynamic");
  });
});
