# @siliconvalleyglobal/agent-test-gate

> Smart Test Impact Analysis (TIA) CLI & library that blocks an AI agent's commit from landing until the tests **actually affected by the change** pass — fast enough to gate every commit without slowing development down.

[![npm version](https://img.shields.io/npm/v/@siliconvalleyglobal/agent-test-gate.svg)](https://www.npmjs.com/package/@siliconvalleyglobal/agent-test-gate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Problem Solved

Running a full test suite on every single agent-generated commit is often too slow to enforce in practice. Teams either skip testing on agent commits entirely or only check them in CI much later — well after broken changes have already stacked on top of other work.

`agent-test-gate` computes which tests are actually affected by the files an agent just changed and runs **only those tests**, enabling instant commit gating before code lands.

---

## Key Features

- 🎯 **Incremental Test Impact Analysis (TIA)**: Constructs a directed dependency graph using static AST parsing (JS/TS + Python) and performs reverse graph traversal to find downstream test files.
- ⚡ **Incremental Graph Caching**: Hashes file contents (`.agent-test-gate-cache.json`) to incrementally update the graph without re-parsing unchanged files.
- 🛡️ **Fail-Safe Confidence Threshold**: If dynamic imports (`import(var)`, `require(var)`), unresolvable specifiers, or unparseable files lower graph confidence below `confidenceThreshold` (default `0.8`), it safely falls back to running the full test suite.
- 🔌 **Pluggable Test Runner Adapters**: Out-of-the-box support for **Vitest**, **Jest**, and **Pytest** via extensible `TestRunnerAdapter` interface.
- 🤝 **Agent Integration Ready**: Direct inline integration API (`getAffectedTests` and `runGate`) for [`@siliconvalleyglobal/agent-permit`](https://github.com/alifkhanwork/agent-permit).

---

## Research & Rationale

`agent-test-gate` adapts established test impact & build graph algorithms from proven industry tools:
- **Nx (`affected`)**: Workspace graph modeling from static import AST analysis with incremental file caching.
- **Bazel (`rdeps`)**: Reverse dependency traversal query to resolve affected root test targets.
- **Jest (`--changedSince`)**: AST extraction of module dependencies to find reachable spec files.
- **pytest-testmon**: Impact-based selective execution for Python suites.

---

## Installation

```bash
npm install --save-dev @siliconvalleyglobal/agent-test-gate
```

For Python projects using `pytest`, install the companion adapter:

```bash
pip install agent-test-gate-pytest
```

---

## CLI Usage

### 1. `agent-test-gate run`
Detects changed files in git diff and executes affected tests:

```bash
# Run affected tests for current staged git changes
npx agent-test-gate run --staged

# Run affected tests for a specific git commit range
npx agent-test-gate run --commit HEAD~1..HEAD

# Force running full test suite regardless of graph
npx agent-test-gate run --all
```

### 2. `agent-test-gate check <files...>`
Dry-run affected test resolution for given files (useful for debugging impact resolution):

```bash
npx agent-test-gate check src/utils.ts src/components/Button.tsx
```

Outputs graph confidence score and affected test file list without executing tests.

### 3. `agent-test-gate graph [files...]`
Outputs computed dependency graph in tree or JSON format:

```bash
npx agent-test-gate graph --json
```

---

## Configuration (`.agent-test-gate.json`)

Create `.agent-test-gate.json` in your repository root:

```json
{
  "runner": "vitest",
  "include": [
    "src/**/*",
    "lib/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**"
  ],
  "testPatterns": [
    "**/*.test.[jt]s*",
    "**/*.spec.[jt]s*",
    "**/test_*.py",
    "**/*_test.py"
  ],
  "confidenceThreshold": 0.8
}
```

---

## Agent Integration (`agent-permit`)

You can call `agent-test-gate` programmatically in Node.js / TypeScript as an inline pre-approval check:

```typescript
import { runGate, getAffectedTests } from "@siliconvalleyglobal/agent-test-gate";

// 1. Dry run / query affected tests
const impact = await getAffectedTests(["src/auth.ts"]);
console.log("Affected tests:", impact.affectedTests);
console.log("Confidence:", impact.confidenceScore);

// 2. Execute gate check before permitting a commit
const gate = await runGate(undefined, { staged: true });
if (!gate.passed) {
  throw new Error("Agent commit denied: Affected tests failed!");
}
```

---

## Architecture Overview

```
src/
├── graph/
│   ├── dependencyGraph.ts   # Core reverse graph TIA engine & confidence calculator
│   ├── jsParser.ts          # Babel AST static import extractor (TS, JS, JSX, TSX)
│   ├── pyParser.ts          # Python AST static import parser
│   ├── resolver.ts          # TS path alias & extension resolver
│   └── cache.ts             # Incremental SHA-256 hash cache manager
├── runners/
│   ├── base.ts              # TestRunnerAdapter interface definition
│   ├── vitest.ts            # Vitest adapter
│   ├── jest.ts              # Jest adapter
│   └── pytest.ts            # Pytest adapter
├── cli/
│   └── index.ts             # Commander CLI subcommands (run, check, graph)
└── integrations/
    └── agentPermit.ts       # Direct agent-permit gating API
```

---

## Contributing

For guidelines on adding new test runner adapters or contributing to core graph features, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Silicon Valley Global
