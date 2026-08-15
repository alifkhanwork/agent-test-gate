import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import type { AgentTestGateConfig, AffectedTestsResult, FileNodeInfo } from "../types.js";
import { GraphCache } from "./cache.js";
import { parseJSImports } from "./jsParser.js";
import { parsePyImports, resolvePyImport } from "./pyParser.js";
import { ModuleResolver } from "./resolver.js";

export class DependencyGraphManager {
  private config: Required<AgentTestGateConfig>;
  private cache: GraphCache;
  private resolver: ModuleResolver;
  private nodes: Map<string, FileNodeInfo> = new Map();
  private forwardGraph: Map<string, Set<string>> = new Map(); // file -> imports
  private reverseGraph: Map<string, Set<string>> = new Map(); // file -> importedBy

  constructor(config: Required<AgentTestGateConfig>) {
    this.config = config;
    this.cache = new GraphCache(config.cwd);
    this.resolver = new ModuleResolver({ cwd: config.cwd });
  }

  /**
   * Scans workspace files matching include/exclude patterns and builds the dependency graph
   */
  public async buildGraph(): Promise<void> {
    const files = this.scanWorkspaceFiles();
    const isTestMatcher = picomatch(this.config.testPatterns, { dot: true });

    for (const relPath of files) {
      const fullPath = path.resolve(this.config.cwd, relPath);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;

      const hash = this.cache.getFileHash(relPath, this.config.cwd);
      const isTestFile = isTestMatcher(relPath);

      const cached = this.cache.getCachedEntry(relPath, hash);
      let imports: string[] = [];
      let hasDynamicImports = false;
      let confidenceScore = 1.0;

      if (cached) {
        imports = cached.imports;
        hasDynamicImports = cached.hasDynamicImports;
        confidenceScore = cached.confidenceScore;
      } else {
        const ext = path.extname(relPath).toLowerCase();
        if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
          const parsed = parseJSImports(fullPath);
          hasDynamicImports = parsed.hasDynamicImports;
          confidenceScore = parsed.confidenceScore;
          imports = this.resolveJSImports(parsed.imports, relPath);
        } else if (ext === ".py") {
          const parsed = parsePyImports(fullPath);
          hasDynamicImports = parsed.hasDynamicImports;
          confidenceScore = parsed.confidenceScore;
          imports = this.resolvePyImports(parsed.imports, relPath);
        }

        this.cache.setCachedEntry(relPath, {
          hash,
          imports,
          hasDynamicImports,
          confidenceScore,
          isTestFile
        });
      }

      const nodeInfo: FileNodeInfo = {
        path: relPath,
        imports,
        hasDynamicImports,
        confidenceScore,
        hash,
        isTestFile
      };

      this.nodes.set(relPath, nodeInfo);
      this.forwardGraph.set(relPath, new Set(imports));
    }

    // Build reverse graph
    for (const [file, info] of this.nodes.entries()) {
      if (!this.reverseGraph.has(file)) {
        this.reverseGraph.set(file, new Set());
      }
      for (const imported of info.imports) {
        if (!this.reverseGraph.has(imported)) {
          this.reverseGraph.set(imported, new Set());
        }
        this.reverseGraph.get(imported)!.add(file);
      }
    }

    this.cache.save();
  }

  private resolveJSImports(rawSpecifiers: string[], importingFile: string): string[] {
    const resolved: string[] = [];
    for (const spec of rawSpecifiers) {
      const res = this.resolver.resolve(spec, importingFile);
      if (res && res !== importingFile) {
        resolved.push(res);
      }
    }
    return Array.from(new Set(resolved));
  }

  private resolvePyImports(rawSpecifiers: string[], importingFile: string): string[] {
    const resolved: string[] = [];
    for (const spec of rawSpecifiers) {
      const res = resolvePyImport(spec, importingFile, this.config.cwd);
      if (res && res !== importingFile) {
        resolved.push(res);
      }
    }
    return Array.from(new Set(resolved));
  }

  /**
   * Resolves tests affected by the given list of changed files using reverse graph traversal (TIA)
   */
  public getAffectedTests(changedFiles: string[]): AffectedTestsResult {
    const normalizedChanged = changedFiles.map(f => f.replace(/\\/g, "/"));
    const allTestFiles = Array.from(this.nodes.values())
      .filter(n => n.isTestFile)
      .map(n => n.path);

    const visited = new Set<string>();
    const queue: string[] = [...normalizedChanged];
    let overallConfidence = 1.0;
    let containsDynamicImports = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const nodeInfo = this.nodes.get(current);
      if (nodeInfo) {
        overallConfidence = Math.min(overallConfidence, nodeInfo.confidenceScore);
        if (nodeInfo.hasDynamicImports) {
          containsDynamicImports = true;
        }
      }

      const dependents = this.reverseGraph.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    const affectedTests = Array.from(visited).filter(file => {
      const info = this.nodes.get(file);
      return info ? info.isTestFile : false;
    });

    let fallbackToAll = false;
    let fallbackReason: string | undefined;

    if (containsDynamicImports) {
      overallConfidence = Math.min(overallConfidence, 0.5);
    }

    if (overallConfidence < this.config.confidenceThreshold) {
      fallbackToAll = true;
      fallbackReason = `Graph confidence score (${overallConfidence.toFixed(2)}) is below threshold (${this.config.confidenceThreshold.toFixed(2)}) due to dynamic imports or unresolvable modules.`;
    }

    // Convert forward and reverse graph maps to plain objects for JSON export
    const graphObj: Record<string, string[]> = {};
    for (const [k, v] of this.forwardGraph.entries()) {
      graphObj[k] = Array.from(v);
    }
    const reverseGraphObj: Record<string, string[]> = {};
    for (const [k, v] of this.reverseGraph.entries()) {
      reverseGraphObj[k] = Array.from(v);
    }

    return {
      changedFiles: normalizedChanged,
      affectedTests,
      allTests: allTestFiles,
      confidenceScore: overallConfidence,
      fallbackToAll,
      fallbackReason,
      graph: graphObj,
      reverseGraph: reverseGraphObj
    };
  }

  private scanWorkspaceFiles(): string[] {
    const isIncludeMatch = picomatch(this.config.include, { dot: true });
    const isExcludeMatch = picomatch(this.config.exclude, { dot: true });

    const results: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(this.config.cwd, fullPath).replace(/\\/g, "/");

        if (isExcludeMatch(relPath)) continue;

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          if (isIncludeMatch(relPath)) {
            results.push(relPath);
          }
        }
      }
    };

    walk(this.config.cwd);
    return results;
  }
}
