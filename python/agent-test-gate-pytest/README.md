# agent-test-gate-pytest

Python pytest adapter & AST impact analyzer for [`@siliconvalleyglobal/agent-test-gate`](https://github.com/alifkhanwork/agent-test-gate).

## Installation

```bash
pip install agent-test-gate-pytest
```

## Usage

Run AST dependency analysis on Python files:

```bash
agent-test-gate-pytest graph --files src/utils.py app/main.py
```

Run only affected pytest tests for changed files:

```bash
agent-test-gate-pytest run --files src/utils.py
```

Or enable the pytest plugin:

```bash
pytest --agent-test-gate-changed=src/utils.py
```
