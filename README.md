# agent-test-gate 🚦

> **Scoped, Affected-Only Test Gating for AI Agent Commits**

A Project by [**SILICON VALLEY GLOBAL PH INC**](https://svg.ph/)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@siliconvalleyglobal/agent-test-gate-red.svg)](https://www.npmjs.com/package/@siliconvalleyglobal/agent-test-gate)
[![Node version](https://img.shields.io/node/v/@siliconvalleyglobal/agent-test-gate.svg)](https://nodejs.org/)
[![Tests Passing](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/alifkhanwork/agent-test-gate)

**agent-test-gate** blocks an AI coding agent's commit from landing until the tests actually affected by the change pass — not the entire suite. Created and maintained by [SILICON VALLEY GLOBAL PH INC](https://svg.ph/).

---

## ⚠️ The Problem

Running a full test suite on every single agent-generated commit is often too slow to enforce in practice — a suite that takes minutes to run can't realistically gate every small change an agent makes throughout a session. So teams either skip testing at commit time entirely and rely on CI to catch problems much later, or they let agents commit unchecked and hope nothing broke. Both outcomes mean broken changes stack on top of each other before anyone notices.

**agent-test-gate** solves this by computing exactly which tests are affected by the files an agent just changed, and running only those — fast enough to gate every single commit, not just a nightly CI run.

---

## 🧩 Key Architecture Pillars

### Change Detection (`src/graph/diff.ts`)
Reads the current git diff (staged changes or a specified commit range) to get the exact list of changed files.

### Affected-Test Mapping (`src/graph/dependencyGraph.ts`)
Builds an import/require dependency graph connecting changed source files to the tests that actually exercise them, based on proven approaches from established test-impact-analysis tools rather than a from-scratch algorithm.

### Test Runner Adapters (`src/runners/`)
Pluggable adapters for Vitest, Jest, and (via the companion `agent-test-gate-pytest` package) pytest — each knows how to invoke its runner against a specific, scoped file list.

### Gate Enforcement (`src/cli/index.ts`)
Exits non-zero (or returns a deny through the `agent-permit` integration) if affected tests fail, blocking the commit before it lands.

### Fail-Safe Fallback (`src/graph/confidence.ts`)
When the dependency graph can't be computed with high confidence — dynamic imports, unusual module resolution — the tool falls back to running a broader or full suite rather than silently under-testing, and clearly logs when it's operating in fallback mode.

---

## 📊 Supported Test Runners

| Runner | Ecosystem | Status |
| :--- | :--- | :--- |
| **Vitest** | JS/TS | Supported |
| **Jest** | JS/TS | Supported |
| **pytest** | Python | Supported via `agent-test-gate-pytest` |
| **Others** | — | Planned — contributions welcome |

---

## 💻 Quickstart

### Installation

```bash
# Install the core package
npm install @siliconvalleyglobal/agent-test-gate

# Optional: pytest adapter for Python projects
pip install agent-test-gate-pytest
```

### Usage

```bash
# Run affected tests for your currently staged changes:
npx agent-test-gate run

# Check what the tool thinks is affected, without running anything:
npx agent-test-gate check src/auth.ts src/utils/token.ts

# Debug the computed dependency graph:
npx agent-test-gate graph
```

---

## ⚙️ Configuration

Project-level config (`.agent-test-gate.json`):

```json
{
  "runner": "vitest",
  "include": ["src/**"],
  "exclude": ["**/*.stories.tsx"],
  "confidenceThreshold": 0.8,
  "fallback": "full-suite"
}
```

If graph-computation confidence falls below `confidenceThreshold`, the gate automatically runs the full suite instead of a scoped subset.

---

## 🔌 Agent Integration Example

```typescript
import { runGate } from "@siliconvalleyglobal/agent-test-gate";

const result = await runGate(changedFiles);

if (!result.passed) {
  // agent-permit blocks the commit action here
  console.error(`[agent-test-gate] Blocked: ${result.failedTests.length} affected test(s) failed`);
}
```

---

## 🗺️ Roadmap

- [ ] Additional test runner adapters (Go test, RSpec, JUnit)
- [ ] Persistent graph cache shared across CI runs
- [ ] GitHub Action for PR-level affected-test reporting

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a new test runner adapter or improve dependency-graph accuracy.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

Copyright (c) 2026 [SILICON VALLEY GLOBAL PH INC](https://svg.ph/).
