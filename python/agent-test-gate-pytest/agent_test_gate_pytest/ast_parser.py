import ast
import os
import re
from typing import Dict, List, Set, Tuple

class PyASTGraphBuilder:
    def __init__(self, root_dir: str = "."):
        self.root_dir = os.path.abspath(root_dir)
        self.forward_graph: Dict[str, Set[str]] = {}  # file -> imported_files
        self.reverse_graph: Dict[str, Set[str]] = {}  # imported_file -> importing_files
        self.test_files: Set[str] = set()

    def is_test_file(self, rel_path: str) -> bool:
        filename = os.path.basename(rel_path)
        return (
            filename.startswith("test_")
            or filename.endswith("_test.py")
            or "/tests/" in rel_path.replace("\\", "/")
        )

    def parse_file(self, rel_path: str) -> Tuple[List[str], bool, float]:
        full_path = os.path.join(self.root_dir, rel_path)
        if not os.path.exists(full_path):
            return [], False, 1.0

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            tree = ast.parse(content, filename=full_path)
            imports = set()
            has_dynamic = False
            confidence = 1.0

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        resolved = self.resolve_module(alias.name, rel_path)
                        if resolved:
                            imports.add(resolved)
                elif isinstance(node, ast.ImportFrom):
                    module = node.module or ""
                    resolved = self.resolve_module(module, rel_path, level=node.level)
                    if resolved:
                        imports.add(resolved)
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name) and node.func.id in ("__import__", "exec", "eval"):
                        has_dynamic = True
                        confidence = min(confidence, 0.5)

            return list(imports), has_dynamic, confidence
        except Exception:
            return [], True, 0.5

    def resolve_module(self, module_name: str, importing_file: str, level: int = 0) -> str:
        if not module_name and level == 0:
            return ""

        importing_dir = os.path.dirname(os.path.join(self.root_dir, importing_file))

        if level > 0:
            current = importing_dir
            for _ in range(level - 1):
                current = os.path.dirname(current)
            target = os.path.join(current, module_name.replace(".", "/")) if module_name else current
        else:
            as_path = module_name.replace(".", "/")
            target = os.path.join(self.root_dir, as_path)

        # Check target.py
        py_file = target + ".py"
        if os.path.isfile(py_file):
            return os.path.relpath(py_file, self.root_dir).replace("\\", "/")

        # Check target/__init__.py
        init_file = os.path.join(target, "__init__.py")
        if os.path.isfile(init_file):
            return os.path.relpath(init_file, self.root_dir).replace("\\", "/")

        return ""

    def build(self) -> None:
        for root, _, files in os.walk(self.root_dir):
            if "node_modules" in root or ".venv" in root or "__pycache__" in root or ".git" in root:
                continue
            for file in files:
                if file.endswith(".py"):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.root_dir).replace("\\", "/")
                    if self.is_test_file(rel_path):
                        self.test_files.add(rel_path)

                    imports, _, _ = self.parse_file(rel_path)
                    self.forward_graph[rel_path] = set(imports)

        for src, imps in self.forward_graph.items():
            if src not in self.reverse_graph:
                self.reverse_graph[src] = set()
            for imp in imps:
                if imp not in self.reverse_graph:
                    self.reverse_graph[imp] = set()
                self.reverse_graph[imp].add(src)

    def get_affected_tests(self, changed_files: List[str]) -> List[str]:
        visited = set()
        queue = [f.replace("\\", "/") for f in changed_files]

        while queue:
            curr = queue.pop(0)
            if curr in visited:
                continue
            visited.add(curr)

            dependents = self.reverse_graph.get(curr, set())
            for dep in dependents:
                if dep not in visited:
                    queue.append(dep)

        return [f for f in visited if f in self.test_files or self.is_test_file(f)]
