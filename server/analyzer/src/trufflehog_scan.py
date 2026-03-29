"""Optional TruffleHog filesystem scan for committed secrets."""
from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any, Dict, List


def run_trufflehog_scan(repo_path: str) -> List[Dict[str, Any]]:
    """Run TruffleHog against a local repo path. Returns list of findings."""
    if not shutil.which("trufflehog"):
        return []

    try:
        result = subprocess.run(
            ["trufflehog", "filesystem", repo_path, "--json", "--no-update"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        findings: List[Dict[str, Any]] = []
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                findings.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return findings
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return []
