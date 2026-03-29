"""TruffleHog integration returns empty when binary is absent."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from server.analyzer.src.trufflehog_scan import run_trufflehog_scan  # noqa: E402


def test_run_trufflehog_scan_returns_empty_when_not_installed(monkeypatch, tmp_path: Path):
    import server.analyzer.src.trufflehog_scan as th

    monkeypatch.setattr(th.shutil, "which", lambda _: None)
    assert run_trufflehog_scan(str(tmp_path)) == []
