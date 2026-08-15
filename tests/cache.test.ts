import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GraphCache } from "../src/graph/cache.js";

describe("GraphCache", () => {
  const tmpDir = path.resolve(__dirname, "fixtures/cache-test-tmp");

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves file hash and entry incrementally", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const dummyFile = path.join(tmpDir, "sample.ts");
    fs.writeFileSync(dummyFile, "const x = 42;");

    const cache = new GraphCache(tmpDir);
    const hash = cache.getFileHash("sample.ts", tmpDir);
    expect(hash).toBeTruthy();

    cache.setCachedEntry("sample.ts", {
      hash,
      imports: ["./other.ts"],
      hasDynamicImports: false,
      confidenceScore: 1.0,
      isTestFile: false
    });
    cache.save();

    // Re-instantiate cache and check hit
    const cache2 = new GraphCache(tmpDir);
    const entry = cache2.getCachedEntry("sample.ts", hash);
    expect(entry).not.toBeNull();
    expect(entry?.imports).toEqual(["./other.ts"]);

    // Modify file content -> hash changes -> cache miss
    fs.writeFileSync(dummyFile, "const x = 100;");
    const newHash = cache2.getFileHash("sample.ts", tmpDir);
    expect(newHash).not.toEqual(hash);
    expect(cache2.getCachedEntry("sample.ts", newHash)).toBeNull();
  });
});
