import fs from "node:fs";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

// Handle default or named import for @babel/traverse depending on ESM/CJS interop
const traverse = typeof traverseModule === "function" ? traverseModule : (traverseModule as unknown as { default: typeof traverseModule }).default;

export interface JSParseResult {
  imports: string[];
  hasDynamicImports: boolean;
  confidenceScore: number;
}

export function parseJSImports(filePath: string, fileContent?: string): JSParseResult {
  const content = fileContent ?? fs.readFileSync(filePath, "utf-8");
  const imports: Set<string> = new Set();
  let hasDynamicImports = false;
  let confidenceScore = 1.0;

  try {
    const ast = parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "dynamicImport",
        "importMeta",
        "topLevelAwait",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        ["decorators", { decoratorsBeforeExport: true }]
      ]
    });

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source && path.node.source.value) {
          imports.add(path.node.source.value);
        }
      },
      ExportNamedDeclaration(path) {
        if (path.node.source && path.node.source.value) {
          imports.add(path.node.source.value);
        }
      },
      ExportAllDeclaration(path) {
        if (path.node.source && path.node.source.value) {
          imports.add(path.node.source.value);
        }
      },
      CallExpression(path) {
        // Handle require(...)
        if (
          path.node.callee.type === "Identifier" &&
          path.node.callee.name === "require" &&
          path.node.arguments.length > 0
        ) {
          const arg = path.node.arguments[0];
          if (arg.type === "StringLiteral") {
            imports.add(arg.value);
          } else {
            // Non-string require statement like require(variable)
            hasDynamicImports = true;
            confidenceScore = Math.min(confidenceScore, 0.5);
          }
        }

        // Handle dynamic import(...)
        if (path.node.callee.type === "Import") {
          const arg = path.node.arguments[0];
          if (arg && arg.type === "StringLiteral") {
            imports.add(arg.value);
          } else {
            // Dynamic import with variable identifier or expression
            hasDynamicImports = true;
            confidenceScore = Math.min(confidenceScore, 0.5);
          }
        }
      }
    });

  } catch (err) {
    // If parse fails (e.g. syntax error in uncompiled snippet), fallback regex extraction
    const regexImports = extractRegexImports(content);
    regexImports.imports.forEach(imp => imports.add(imp));
    hasDynamicImports = hasDynamicImports || regexImports.hasDynamic;
    confidenceScore = Math.min(confidenceScore, 0.6);
  }

  return {
    imports: Array.from(imports),
    hasDynamicImports,
    confidenceScore
  };
}

function extractRegexImports(content: string): { imports: string[]; hasDynamic: boolean } {
  const imports: Set<string> = new Set();
  let hasDynamic = false;

  // Match import ... from '...' or import '...'
  const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Match export ... from '...'
  const exportRegex = /export\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  while ((match = exportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Match require('...')
  const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  if (/import\s*\([^'"]/.test(content) || /require\s*\([^'"]/.test(content)) {
    hasDynamic = true;
  }

  return { imports: Array.from(imports), hasDynamic };
}
