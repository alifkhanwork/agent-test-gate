import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RunTestsOptions, TestRunResult, TestRunnerAdapter } from "./base.js";

export class VitestAdapter implements TestRunnerAdapter {
  public name = "vitest";

  public async detect(cwd: string): Promise<boolean> {
    const vitestConfigFiles = [
      "vitest.config.ts",
      "vitest.config.js",
      "vitest.config.mjs",
      "vitest.config.mts",
      "vite.config.ts",
      "vite.config.js"
    ];

    for (const file of vitestConfigFiles) {
      if (fs.existsSync(path.resolve(cwd, file))) {
        return true;
      }
    }

    const pkgPath = path.resolve(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if ("vitest" in deps) {
          return true;
        }
      } catch {}
    }

    return false;
  }

  public async runTests(options: RunTestsOptions): Promise<TestRunResult> {
    const extra = options.extraArgs ? options.extraArgs.join(" ") : "";
    let cmd = "";

    if (options.runAll || options.testFiles.length === 0) {
      cmd = `npx vitest run ${extra}`.trim();
    } else {
      const fileList = options.testFiles.map(f => `"${f}"`).join(" ");
      cmd = `npx vitest run ${fileList} ${extra}`.trim();
    }

    return new Promise(resolve => {
      exec(cmd, { cwd: options.cwd }, (error, stdout, stderr) => {
        const output = (stdout + "\n" + stderr).trim();
        const exitCode = error ? (error.code ?? 1) : 0;
        resolve({
          success: exitCode === 0,
          exitCode,
          runnerName: this.name,
          ranAll: options.runAll || options.testFiles.length === 0,
          output
        });
      });
    });
  }
}
