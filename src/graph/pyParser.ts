import fs from "node:fs";
import path from "node:path";

export interface PyParseResult {
  imports: string[];
  hasDynamicImports: boolean;
  confidenceScore: number;
}

export function parsePyImports(filePath: string, fileContent?: string): PyParseResult {
  const content = fileContent ?? fs.readFileSync(filePath, "utf-8");
  const imports: Set<string> = new Set();
  let hasDynamicImports = false;
  let confidenceScore = 1.0;

  // Regex patterns for Python import statements
  // e.g. import foo, bar
  // e.g. import foo.bar as fb
  // e.g. from foo.bar import baz, qux
  // e.g. from .foo import bar
  // e.g. from ..utils import helper

  const lines = content.split("\n");
  for (let line of lines) {
    line = line.trim();
    // Ignore comments
    if (line.startsWith("#")) continue;

    // Check for __import__() or importlib.import_module()
    if (line.includes("__import__") || line.includes("import_module(")) {
      hasDynamicImports = true;
      confidenceScore = Math.min(confidenceScore, 0.5);
    }

    // Match `from <module> import ...`
    const fromMatch = line.match(/^from\s+([\.\w]+)\s+import/);
    if (fromMatch) {
      imports.add(fromMatch[1]);
      continue;
    }

    // Match `import <module> [as alias]`
    const importMatch = line.match(/^import\s+([\w\.,\s]+)/);
    if (importMatch) {
      const modules = importMatch[1].split(",");
      for (const mod of modules) {
        const modName = mod.trim().split(/\s+as\s+/)[0].trim();
        if (modName) {
          imports.add(modName);
        }
      }
    }
  }

  return {
    imports: Array.from(imports),
    hasDynamicImports,
    confidenceScore
  };
}

export function resolvePyImport(specifier: string, importingFilePath: string, cwd: string): string | null {
  const importingDir = path.dirname(path.resolve(cwd, importingFilePath));

  // Handle relative Python imports (e.g. `.foo`, `..utils`)
  if (specifier.startsWith(".")) {
    let dotsCount = 0;
    while (specifier[dotsCount] === ".") {
      dotsCount++;
    }
    const modulePath = specifier.slice(dotsCount).replace(/\./g, "/");
    let currentDir = importingDir;
    for (let i = 1; i < dotsCount; i++) {
      currentDir = path.dirname(currentDir);
    }

    const targetBase = modulePath ? path.join(currentDir, modulePath) : currentDir;
    return tryPyFile(targetBase, cwd);
  }

  // Handle dot notation module imports (e.g. `src.utils.helper` or `app.models`)
  const asPath = specifier.replace(/\./g, "/");
  const absoluteTarget = path.resolve(cwd, asPath);
  return tryPyFile(absoluteTarget, cwd);
}

function tryPyFile(targetPath: string, cwd: string): string | null {
  // 1. target.py
  const pyFile = targetPath + ".py";
  if (fs.existsSync(pyFile) && fs.statSync(pyFile).isFile()) {
    return path.relative(cwd, pyFile).replace(/\\/g, "/");
  }

  // 2. target/__init__.py
  const initFile = path.join(targetPath, "__init__.py");
  if (fs.existsSync(initFile) && fs.statSync(initFile).isFile()) {
    return path.relative(cwd, initFile).replace(/\\/g, "/");
  }

  return null;
}
