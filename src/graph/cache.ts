import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CacheSchema } from "../types.js";

const CACHE_VERSION = "1.0.0";
const DEFAULT_CACHE_FILENAME = ".agent-test-gate-cache.json";

export class GraphCache {
  private cachePath: string;
  private cache: CacheSchema;

  constructor(cwd: string = process.cwd()) {
    this.cachePath = path.resolve(cwd, DEFAULT_CACHE_FILENAME);
    this.cache = this.load();
  }

  private load(): CacheSchema {
    if (fs.existsSync(this.cachePath)) {
      try {
        const raw = fs.readFileSync(this.cachePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.version === CACHE_VERSION && parsed.files) {
          return parsed;
        }
      } catch {
        // Corrupted cache, start fresh
      }
    }
    return {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      files: {}
    };
  }

  public save() {
    try {
      this.cache.timestamp = Date.now();
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (err) {
      console.warn("[agent-test-gate] Warning: failed to save cache:", err);
    }
  }

  public getFileHash(filePath: string, cwd: string): string {
    const fullPath = path.resolve(cwd, filePath);
    if (!fs.existsSync(fullPath)) return "";
    const content = fs.readFileSync(fullPath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  public getCachedEntry(filePath: string, currentHash: string) {
    const entry = this.cache.files[filePath];
    if (entry && entry.hash === currentHash) {
      return entry;
    }
    return null;
  }

  public setCachedEntry(
    filePath: string,
    data: {
      hash: string;
      imports: string[];
      hasDynamicImports: boolean;
      confidenceScore: number;
      isTestFile: boolean;
    }
  ) {
    this.cache.files[filePath] = data;
  }

  public removeCachedEntry(filePath: string) {
    delete this.cache.files[filePath];
  }

  public clear() {
    this.cache.files = {};
    if (fs.existsSync(this.cachePath)) {
      try {
        fs.unlinkSync(this.cachePath);
      } catch {}
    }
  }
}
