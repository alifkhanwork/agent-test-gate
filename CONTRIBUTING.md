# Contributing to agent-test-gate

Thank you for your interest in contributing to `@siliconvalleyglobal/agent-test-gate`!

---

## How to Add a New Test Runner Adapter

`agent-test-gate` uses a pluggable adapter pattern (`TestRunnerAdapter`) to execute tests across different test frameworks (e.g. Vitest, Jest, Pytest, Mocha, Playwright, AVA).

Follow these steps to implement and register a new adapter:

### 1. Implement the `TestRunnerAdapter` Interface

Create a new file in `src/runners/your-runner.ts` implementing `TestRunnerAdapter`:

```typescript
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RunTestsOptions, TestRunResult, TestRunnerAdapter } from "./base.js";

export class MochaAdapter implements TestRunnerAdapter {
  public name = "mocha";

  /**
   * Return true if your test runner is detected in the workspace
   */
  public async detect(cwd: string): Promise<boolean> {
    const mochaConfigFile = path.resolve(cwd, ".mocharc.json");
    if (fs.existsSync(mochaConfigFile)) return true;

    const pkgPath = path.resolve(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if ("mocha" in deps) return true;
      } catch {}
    }
    return false;
  }

  /**
   * Execute tests for the specified testFiles or run full suite if runAll is true
   */
  public async runTests(options: RunTestsOptions): Promise<TestRunResult> {
    const extra = options.extraArgs ? options.extraArgs.join(" ") : "";
    let cmd = "";

    if (options.runAll || options.testFiles.length === 0) {
      cmd = `npx mocha ${extra}`.trim();
    } else {
      const fileList = options.testFiles.map(f => `"${f}"`).join(" ");
      cmd = `npx mocha ${fileList} ${extra}`.trim();
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
```

### 2. Register Your Adapter in `RunnerRegistry`

Export your new adapter from `src/runners/index.ts` and register it in the `RunnerRegistry` constructor:

```typescript
// src/runners/index.ts
import { MochaAdapter } from "./mocha.js";

export class RunnerRegistry {
  constructor() {
    this.register(new VitestAdapter());
    this.register(new JestAdapter());
    this.register(new PytestAdapter());
    this.register(new MochaAdapter()); // <--- Add your adapter here
  }
  // ...
}
```

### 3. Add Unit Tests

Create or update unit tests in `tests/runners.test.ts` to verify detection and command generation for your adapter:

```typescript
it("detects Mocha adapter when mocha config exists", async () => {
  const detected = await registry.detectRunner(mochaCwd);
  expect(detected.name).toBe("mocha");
});
```

---

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run typecheck & unit tests:
   ```bash
   npm run typecheck
   npm run test
   ```

3. Build the package:
   ```bash
   npm run build
   ```
