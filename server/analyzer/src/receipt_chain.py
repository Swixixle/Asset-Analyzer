"""
Cryptographic receipt chaining: canonical JSON hashing, signing, verification, chain state I/O.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

def canonical_json_bytes(obj: Any) -> bytes:
    """Deterministic JSON: sorted keys, compact separators, UTF-8."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def receipt_document_hash(receipt: Dict[str, Any]) -> str:
    """SHA-256 of full receipt as canonical JSON (for previous_receipt_hash links)."""
    return hashlib.sha256(canonical_json_bytes(receipt)).hexdigest()


def signing_bytes(receipt: Dict[str, Any]) -> bytes:
    """Payload to sign: receipt without signature field."""
    to_sign = {k: v for k, v in receipt.items() if k != "signature" and k != "chain_signature_algorithm"}
    return canonical_json_bytes(to_sign)


def sign_receipt(receipt: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Sign receipt (mutates nothing). Returns (signature_base64_or_hex, algorithm_name).
    Ed25519 takes precedence over HMAC when both DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY and DEBRIEF_CHAIN_HMAC_SECRET are set.
    HMAC is for internal use only; use Ed25519 for buyer-facing verification.
    """
    msg = signing_bytes(receipt)

    pem = os.environ.get("DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY", "").strip()
    if pem:
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

            key = serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise TypeError("DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY must be an Ed25519 PEM key")
            sig = key.sign(msg)
            return sig.hex(), "Ed25519"
        except Exception:
            pass

    secret = os.environ.get("DEBRIEF_CHAIN_HMAC_SECRET", "").strip()
    if secret:
        digest = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        return digest, "HMAC-SHA256"

    return None, None


def verify_receipt_signature(receipt: Dict[str, Any]) -> Tuple[bool, str]:
    """Verify signature on receipt. Returns (ok, detail)."""
    sig = receipt.get("signature")
    alg = receipt.get("chain_signature_algorithm")
    if not sig:
        return True, "no_signature_configured"
    if not alg:
        # Prefer Ed25519 when a public key is configured (matches sign_receipt + Node verifyChainRows).
        if os.environ.get("DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY"):
            alg = "Ed25519"
        elif os.environ.get("DEBRIEF_CHAIN_HMAC_SECRET"):
            alg = "HMAC-SHA256"
        else:
            return False, "signature_without_algorithm_or_keys"
    msg = signing_bytes(receipt)
    if alg == "Ed25519":
        pub_pem = os.environ.get("DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY", "").strip()
        if not pub_pem:
            return False, "missing_DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY"
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

            pub = serialization.load_pem_public_key(pub_pem.encode("utf-8"))
            if not isinstance(pub, Ed25519PublicKey):
                return False, "public_key_not_ed25519"
            pub.verify(bytes.fromhex(sig), msg)
            return True, "ed25519_ok"
        except Exception as e:
            return False, f"ed25519_fail:{e}"
    if alg == "HMAC-SHA256":
        secret = os.environ.get("DEBRIEF_CHAIN_HMAC_SECRET", "").strip()
        if not secret:
            return False, "missing_DEBRIEF_CHAIN_HMAC_SECRET"
        expected = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, str(sig)):
            return True, "hmac_ok"
        return False, "hmac_mismatch"
    return False, f"unknown_algorithm:{alg}"


def chain_state_dir(base: Optional[Path] = None) -> Path:
    raw = os.environ.get("PTA_CHAIN_STATE_DIR", "").strip()
    if raw:
        return Path(raw).resolve()
    root = base or Path.cwd()
    return (root / "out" / "chain_state").resolve()


def latest_receipt_path(state_dir: Path, target_id: str) -> Path:
    return state_dir / target_id / "latest_receipt.json"


def load_latest_receipt(state_dir: Path, target_id: str) -> Optional[Dict[str, Any]]:
    p = latest_receipt_path(state_dir, target_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def persist_receipt_to_chain_state(
    state_dir: Path,
    target_id: str,
    receipt: Dict[str, Any],
    chain_sequence: int,
) -> None:
    d = state_dir / target_id / "receipts"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{chain_sequence:06d}.json").write_text(
        json.dumps(receipt, indent=2, default=str),
        encoding="utf-8",
    )
    latest_receipt_path(state_dir, target_id).parent.mkdir(parents=True, exist_ok=True)
    latest_receipt_path(state_dir, target_id).write_text(
        json.dumps(receipt, indent=2, default=str),
        encoding="utf-8",
    )


def list_chain_receipt_files(state_dir: Path, target_id: str) -> List[Path]:
    receipts_dir = state_dir / target_id / "receipts"
    if not receipts_dir.exists():
        p = latest_receipt_path(state_dir, target_id)
        if p.exists():
            return [p]
        return []
    files = sorted(receipts_dir.glob("*.json"))
    if files:
        return files
    p = latest_receipt_path(state_dir, target_id)
    return [p] if p.exists() else []


@dataclass
class ChainVerifyReport:
    target_id: str
    chain_length: int
    intact: bool
    broken_at_sequence: Optional[int] = None
    broken_reason: Optional[str] = None
    signature_failures: List[Dict[str, Any]] = field(default_factory=list)
    first_timestamp: Optional[str] = None
    last_timestamp: Optional[str] = None
    gaps_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_id": self.target_id,
            "chain_length": self.chain_length,
            "chain_intact": self.intact,
            "broken_at_sequence": self.broken_at_sequence,
            "broken_reason": self.broken_reason,
            "signature_failures": self.signature_failures,
            "first_timestamp": self.first_timestamp,
            "last_timestamp": self.last_timestamp,
            "gaps_count": self.gaps_count,
        }


def verify_chain_for_target(state_dir: Path, target_id: str) -> ChainVerifyReport:
    files = list_chain_receipt_files(state_dir, target_id)
    receipts: List[Dict[str, Any]] = []
    for fp in files:
        try:
            receipts.append(json.loads(fp.read_text(encoding="utf-8")))
        except Exception:
            continue

    def seq_key(r: Dict[str, Any]) -> int:
        return int(r.get("chain_sequence", -1))

    receipts.sort(key=seq_key)
    rep = ChainVerifyReport(
        target_id=target_id,
        chain_length=len(receipts),
        intact=len(receipts) > 0,
    )
    if not receipts:
        rep.intact = True
        return rep

    rep.first_timestamp = receipts[0].get("generated_at")
    rep.last_timestamp = receipts[-1].get("generated_at")
    rep.gaps_count = sum(1 for r in receipts if r.get("receipt_type") == "gap")

    prev: Optional[Dict[str, Any]] = None
    expected_seq = 0
    for r in receipts:
        seq = r.get("chain_sequence")
        if seq is None:
            rep.intact = False
            rep.broken_at_sequence = None
            rep.broken_reason = "missing_chain_sequence"
            return rep
        if int(seq) != expected_seq:
            rep.intact = False
            rep.broken_at_sequence = int(seq)
            rep.broken_reason = f"sequence_jump_expected_{expected_seq}_got_{seq}"
            return rep

        prev_hash = r.get("previous_receipt_hash")
        if expected_seq == 0:
            if prev_hash is not None:
                rep.intact = False
                rep.broken_at_sequence = 0
                rep.broken_reason = "genesis_should_have_null_previous_hash"
                return rep
            if not r.get("chain_genesis"):
                pass
        else:
            if prev is None:
                rep.intact = False
                rep.broken_reason = "internal_prev_missing"
                return rep
            want = receipt_document_hash(prev)
            if str(prev_hash) != want:
                rep.intact = False
                rep.broken_at_sequence = int(seq)
                rep.broken_reason = f"previous_hash_mismatch_want_{want}_got_{prev_hash}"
                return rep

        ok, detail = verify_receipt_signature(r)
        if not ok:
            rep.signature_failures.append({"chain_sequence": seq, "detail": detail})
            rep.intact = False
            rep.broken_at_sequence = int(seq)
            rep.broken_reason = f"signature:{detail}"
            return rep

        prev = r
        expected_seq += 1

    rep.intact = len(rep.signature_failures) == 0 and rep.broken_reason is None
    return rep


def build_gap_receipt(
    target_id: str,
    *,
    gap_start_iso: str,
    gap_end_iso: str,
    scheduled: bool = True,
    run_id: str,
) -> Dict[str, Any]:
    from datetime import datetime

    try:
        t0 = datetime.fromisoformat(gap_start_iso.replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(gap_end_iso.replace("Z", "+00:00"))
        gap_sec = max(0, int((t1 - t0).total_seconds()))
    except Exception:
        gap_sec = 0

    state = chain_state_dir()
    prior = load_latest_receipt(state, target_id)
    if prior is None:
        seq = 0
        prev_hash = None
        genesis = True
    else:
        seq = int(prior.get("chain_sequence", -1)) + 1
        prev_hash = receipt_document_hash(prior)
        genesis = False

    ts = gap_end_iso
    rec: Dict[str, Any] = {
        "schema_version": "1.0",
        "run_id": run_id,
        "generated_at": ts,
        "receipt_type": "gap",
        "gap_start": gap_start_iso,
        "gap_end": gap_end_iso,
        "gap_duration_seconds": gap_sec,
        "reason": "scheduled_run_missed",
        "dossier_file_sha256": None,
        "dossier_main_body_sha256": None,
        "model": None,
        "repo_mode": None,
        "repo_source_redacted": None,
        "target_id": target_id,
        "previous_receipt_hash": prev_hash,
        "chain_sequence": seq,
        "scheduled": scheduled,
        "artifacts": ["receipt.json"],
        "note": "Scheduled analysis window missed; gap recorded on the evidence chain.",
    }
    if genesis:
        rec["chain_genesis"] = True

    sig, alg = sign_receipt(rec)
    rec["signature"] = sig
    rec["chain_signature_algorithm"] = alg
    rec["signed"] = bool(sig)

    persist_receipt_to_chain_state(state, target_id, rec, seq)
    return rec


def print_verify_report(report: ChainVerifyReport) -> None:
    from rich.console import Console
    from rich.table import Table

    console = Console()
    table = Table(title=f"Chain verification — {report.target_id}")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="white")
    table.add_row("Chain length", str(report.chain_length))
    table.add_row("Intact", "yes" if report.intact else "no")
    if report.broken_at_sequence is not None:
        table.add_row("Broken at seq", str(report.broken_at_sequence))
    if report.broken_reason:
        table.add_row("Reason", report.broken_reason)
    table.add_row("Gap receipts", str(report.gaps_count))
    table.add_row("First ts", report.first_timestamp or "")
    table.add_row("Last ts", report.last_timestamp or "")
    console.print(table)
    if report.signature_failures:
        console.print("[red]Signature failures[/red]")
        for sf in report.signature_failures:
            console.print(sf)


if __name__ == "__main__":
    """Stdin: JSON object. Stdout: canonical UTF-8 string (sorted keys, compact separators)."""
    import sys

    raw = sys.stdin.read()
    obj = json.loads(raw)
    sys.stdout.write(canonical_json_bytes(obj).decode("utf-8"))
