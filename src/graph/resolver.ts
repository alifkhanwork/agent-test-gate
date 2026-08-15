import fs from "node:fs";
import path from "node:path";

export interface ResolverOptions {
  cwd: string;
  paths?: Record<string, string[]>; // compilerOptions.paths from tsconfig
  baseUrl?: string;
}

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".py"];

export class ModuleResolver {
  private cwd: string;
  private paths: Record<string, string[]>;
  private baseUrl: string;

  constructor(options: ResolverOptions) {
    this.cwd = options.cwd;
    this.paths = options.paths ?? {};
    this.baseUrl = options.baseUrl ? path.resolve(options.cwd, options.baseUrl) : options.cwd;
    this.loadTsConfigPathAliases();
  }

  private loadTsConfigPathAliases() {
    const tsconfigPath = path.resolve(this.cwd, "tsconfig.json");
    const jsconfigPath = path.resolve(this.cwd, "jsconfig.json");
    const fileToRead = fs.existsSync(tsconfigPath) ? tsconfigPath : (fs.existsSync(jsconfigPath) ? jsconfigPath : null);

    if (!fileToRead) return;

    try {
      const raw = fs.readFileSync(fileToRead, "utf-8");
      // Clean simple trailing commas/comments if needed or parse standard JSON
      const cleanJson = raw.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*/g, "");
      const parsed = JSON.parse(cleanJson);
      if (parsed.compilerOptions) {
        if (parsed.compilerOptions.baseUrl) {
          this.baseUrl = path.resolve(this.cwd, parsed.compilerOptions.baseUrl);
        }
        if (parsed.compilerOptions.paths) {
          this.paths = { ...this.paths, ...parsed.compilerOptions.paths };
        }
      }
    } catch {
      // Ignore tsconfig parse errors
    }
  }

  /**
   * Resolve an imported specifier from a source file to a relative file path (from cwd)
   */
  public resolve(specifier: string, importingFilePath: string): string | null {
    if (!specifier) return null;

    // Ignore node builtins & package imports unless they match path aliases
    if (!specifier.startsWith(".") && !specifier.startsWith("/") && !this.matchesPathAlias(specifier)) {
      return null;
    }

    const importingDir = path.dirname(path.resolve(this.cwd, importingFilePath));

    // Handle relative imports
    if (specifier.startsWith(".")) {
      const absoluteTarget = path.resolve(importingDir, specifier);
      return this.tryFileWithExtensions(absoluteTarget);
    }

    // Handle path alias matching (e.g. `@/components/Button` -> `src/components/Button`)
    if (this.matchesPathAlias(specifier)) {
      const aliasTarget = this.resolvePathAlias(specifier);
      if (aliasTarget) {
        const resolved = this.tryFileWithExtensions(aliasTarget);
        if (resolved) return resolved;
      }
    }

    // Absolute path
    if (specifier.startsWith("/")) {
      const absoluteTarget = path.resolve(this.cwd, specifier.slice(1));
      return this.tryFileWithExtensions(absoluteTarget);
    }

    return null;
  }

  private matchesPathAlias(specifier: string): boolean {
    for (const pattern of Object.keys(this.paths)) {
      const prefix = pattern.replace(/\*$/, "");
      if (specifier.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  private resolvePathAlias(specifier: string): string | null {
    for (const [pattern, targets] of Object.entries(this.paths)) {
      const prefix = pattern.replace(/\*$/, "");
      if (specifier.startsWith(prefix)) {
        const remainder = specifier.slice(prefix.length);
        for (const targetPattern of targets) {
          const targetPrefix = targetPattern.replace(/\*$/, "");
          const candidate = path.resolve(this.baseUrl, targetPrefix + remainder);
          const resolved = this.tryFileWithExtensions(candidate);
          if (resolved) return candidate;
        }
      }
    }
    return null;
  }

  private tryFileWithExtensions(targetPath: string): string | null {
    // 1. Direct match if it already has an extension and exists
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      return this.toRelative(targetPath);
    }

    // 2. If targetPath ends with .js/.jsx/.mjs/.cjs but doesn't exist,
    // strip extension to allow resolving to .ts/.tsx files (TS ESM convention)
    let basePath = targetPath;
    const currentExt = path.extname(targetPath).toLowerCase();
    if ([".js", ".jsx", ".mjs", ".cjs"].includes(currentExt)) {
      basePath = targetPath.slice(0, -currentExt.length);
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return this.toRelative(basePath);
      }
    }

    // 3. Try with extensions added
    for (const ext of DEFAULT_EXTENSIONS) {
      const withExt = basePath + ext;
      if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
        return this.toRelative(withExt);
      }
    }

    // 4. Try as directory with index file
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of DEFAULT_EXTENSIONS) {
        const indexFile = path.join(basePath, `index${ext}`);
        if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
          return this.toRelative(indexFile);
        }
      }
    }

    return null;
  }

  private toRelative(absolutePath: string): string {
    const rel = path.relative(this.cwd, absolutePath);
    return rel.replace(/\\/g, "/");
  }
}
