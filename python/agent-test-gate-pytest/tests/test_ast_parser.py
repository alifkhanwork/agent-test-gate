import os
import tempfile
from agent_test_gate_pytest.ast_parser import PyASTGraphBuilder

def test_python_ast_graph_builder():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create src/utils.py
        src_dir = os.path.join(tmpdir, "src")
        os.makedirs(src_dir, exist_ok=True)
        utils_path = os.path.join(src_dir, "utils.py")
        with open(utils_path, "w") as f:
            f.write("def add(a, b):\n    return a + b\n")

        # Create tests/test_utils.py importing src.utils
        test_dir = os.path.join(tmpdir, "tests")
        os.makedirs(test_dir, exist_ok=True)
        test_path = os.path.join(test_dir, "test_utils.py")
        with open(test_path, "w") as f:
            f.write("from src.utils import add\n\ndef test_add():\n    assert add(1, 2) == 3\n")

        builder = PyASTGraphBuilder(tmpdir)
        builder.build()

        affected = builder.get_affected_tests(["src/utils.py"])
        assert "tests/test_utils.py" in affected
