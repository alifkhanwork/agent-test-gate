import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RunTestsOptions, TestRunResult, TestRunnerAdapter } from "./base.js";

export class JestAdapter implements TestRunnerAdapter {
  public name = "jest";

  public async detect(cwd: string): Promise<boolean> {
    const jestConfigFiles = [
      "jest.config.js",
      "jest.config.ts",
      "jest.config.cjs",
      "jest.config.mjs",
      "jest.config.json"
    ];

    for (const file of jestConfigFiles) {
      if (fs.existsSync(path.resolve(cwd, file))) {
        return true;
      }
    }

    const pkgPath = path.resolve(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.jest) return true;
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if ("jest" in deps) {
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
      cmd = `npx jest ${extra}`.trim();
    } else {
      const fileList = options.testFiles.map(f => `"${f}"`).join(" ");
      cmd = `npx jest ${fileList} ${extra}`.trim();
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
