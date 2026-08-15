import pytest
from agent_test_gate_pytest.ast_parser import PyASTGraphBuilder

def pytest_addoption(parser):
    group = parser.getgroup("agent-test-gate")
    group.addoption(
        "--agent-test-gate-changed",
        action="store",
        default="",
        help="Comma-separated list of changed files for impact-based test filtering."
    )

def pytest_collection_modifyitems(config, items):
    changed_str = config.getoption("--agent-test-gate-changed")
    if not changed_str:
        return

    changed_files = [f.strip() for f in changed_str.split(",") if f.strip()]
    if not changed_files:
        return

    builder = PyASTGraphBuilder()
    builder.build()
    affected_tests = set(builder.get_affected_tests(changed_files))

    selected = []
    deselected = []

    for item in items:
        # Match test file path relative to root
        rel_node = item.nodeid.split("::")[0]
        if rel_node in affected_tests:
            selected.append(item)
        else:
            deselected.append(item)

    if deselected:
        config.hook.pytest_deselected(items=deselected)
        items[:] = selected
