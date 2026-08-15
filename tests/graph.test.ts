import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { DependencyGraphManager } from "../src/graph/dependencyGraph.js";

describe("DependencyGraphManager", () => {
  const fixtureDir = path.resolve(__dirname, "fixtures/ts-app");
  const config = loadConfig(undefined, fixtureDir);

  beforeEach(() => {
    const cacheFile = path.join(fixtureDir, ".agent-test-gate-cache.json");
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  });

  it("accurately computes affected tests for modified source files", async () => {
    const manager = new DependencyGraphManager(config);
    await manager.buildGraph();

    // Changing src/math.ts affects tests/math.test.ts AND tests/utils.test.ts (transitive dep)
    const mathAffected = manager.getAffectedTests(["src/math.ts"]);
    expect(mathAffected.affectedTests).toContain("tests/math.test.ts");
    expect(mathAffected.affectedTests).toContain("tests/utils.test.ts");
    expect(mathAffected.affectedTests).not.toContain("tests/unrelated.test.ts");

    // Changing src/utils.ts affects ONLY tests/utils.test.ts
    const utilsAffected = manager.getAffectedTests(["src/utils.ts"]);
    expect(utilsAffected.affectedTests).toEqual(["tests/utils.test.ts"]);
  });

  it("handles empty or non-existent changed files gracefully", async () => {
    const manager = new DependencyGraphManager(config);
    await manager.buildGraph();

    const result = manager.getAffectedTests(["src/nonexistent.ts"]);
    expect(result.affectedTests).toEqual([]);
  });
});
