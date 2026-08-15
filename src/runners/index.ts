import type { TestRunnerAdapter } from "./base.js";
import { JestAdapter } from "./jest.js";
import { PytestAdapter } from "./pytest.js";
import { VitestAdapter } from "./vitest.js";

export * from "./base.js";
export * from "./jest.js";
export * from "./pytest.js";
export * from "./vitest.js";

export class RunnerRegistry {
  private adapters: Map<string, TestRunnerAdapter> = new Map();

  constructor() {
    this.register(new VitestAdapter());
    this.register(new JestAdapter());
    this.register(new PytestAdapter());
  }

  public register(adapter: TestRunnerAdapter) {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  public get(name: string): TestRunnerAdapter | undefined {
    return this.adapters.get(name.toLowerCase());
  }

  public async detectRunner(cwd: string, preferredName?: string): Promise<TestRunnerAdapter> {
    if (preferredName) {
      const preferred = this.get(preferredName);
      if (preferred) return preferred;
    }

    // Try auto-detection in priority order: Vitest, Jest, Pytest
    for (const adapter of this.adapters.values()) {
      if (await adapter.detect(cwd)) {
        return adapter;
      }
    }

    // Fallback default to Vitest if nothing detected
    return this.adapters.get("vitest")!;
  }
}

export const defaultRunnerRegistry = new RunnerRegistry();
