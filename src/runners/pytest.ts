import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RunTestsOptions, TestRunResult, TestRunnerAdapter } from "./base.js";

export class PytestAdapter implements TestRunnerAdapter {
  public name = "pytest";

  public async detect(cwd: string): Promise<boolean> {
    const pytestFiles = ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"];
    for (const file of pytestFiles) {
      if (fs.existsSync(path.resolve(cwd, file))) {
        return true;
      }
    }

    // Check if any python file exists in root or tests dir
    const entries = fs.readdirSync(cwd);
    if (entries.some(e => e.endsWith(".py"))) {
      return true;
    }

    return false;
  }

  public async runTests(options: RunTestsOptions): Promise<TestRunResult> {
    const extra = options.extraArgs ? options.extraArgs.join(" ") : "";
    let cmd = "";

    if (options.runAll || options.testFiles.length === 0) {
      cmd = `pytest ${extra}`.trim();
    } else {
      const fileList = options.testFiles.map(f => `"${f}"`).join(" ");
      cmd = `pytest ${fileList} ${extra}`.trim();
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
