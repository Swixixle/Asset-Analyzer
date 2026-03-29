"""Tests for lockfile-based dependency graph (not Python import graph between modules)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from server.analyzer.src.core.dependency_graph import build_dependency_graph


def test_build_dependency_graph_includes_requirements_packages(tmp_path: Path, monkeypatch):
    """
    build_dependency_graph lists direct packages from requirements.txt.
    Internal module import edges (e.g. a.py -> b.py) are out of scope for this module.
    """

    def _noop_osv(deps, timeout=45.0):
        return None

    monkeypatch.setattr(
        "server.analyzer.src.core.dependency_graph.osv_query_batch",
        _noop_osv,
    )

    (tmp_path / "requirements.txt").write_text(
        "requests==2.31.0\ncertifi==2023.7.22\n",
        encoding="utf-8",
    )
    graph = build_dependency_graph(tmp_path)
    names = {d["name"] for d in graph["dependencies"]}
    assert "requests" in names
    assert "certifi" in names
    assert graph["summary"]["direct_total"] >= 2

    # Stable shape: each dependency row is JSON-serializable
    json.dumps(graph["dependencies"])

