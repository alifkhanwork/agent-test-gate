import argparse
import json
import sys
from agent_test_gate_pytest.ast_parser import PyASTGraphBuilder

def main():
    parser = argparse.ArgumentParser(description="agent-test-gate-pytest CLI adapter")
    subparsers = parser.add_subparsers(dest="command")

    graph_parser = subparsers.add_parser("graph", help="Compute dependency graph")
    graph_parser.add_argument("--files", nargs="*", help="Changed files to compute graph for")

    run_parser = subparsers.add_parser("run", help="Run affected tests")
    run_parser.add_argument("--files", nargs="*", help="Changed files")

    args = parser.parse_args()

    builder = PyASTGraphBuilder()
    builder.build()

    if args.command == "graph":
        changed = args.files or []
        affected = builder.get_affected_tests(changed)
        print(json.dumps({
            "changedFiles": changed,
            "affectedTests": affected,
            "testFiles": list(builder.test_files),
            "forwardGraph": {k: list(v) for k, v in builder.forward_graph.items()}
        }, indent=2))
    elif args.command == "run":
        changed = args.files or []
        affected = builder.get_affected_tests(changed)
        print(f"Affected Pytest tests: {affected}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
