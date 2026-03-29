import json
import os
from pathlib import Path

import pytest

from server.analyzer.src.receipt_chain import (
    canonical_json_bytes,
    receipt_document_hash,
    sign_receipt,
    verify_receipt_signature,
    persist_receipt_to_chain_state,
    verify_chain_for_target,
)


def test_chain_hash_and_sequence(tmp_path, monkeypatch):
    monkeypatch.setenv("DEBRIEF_CHAIN_HMAC_SECRET", "pytest-secret")
    a = {
        "schema_version": "1.0",
        "run_id": "1",
        "chain_sequence": 0,
        "previous_receipt_hash": None,
        "receipt_type": "analysis",
        "scheduled": False,
        "generated_at": "2026-01-01T00:00:00Z",
    }
    h0 = receipt_document_hash(a)
    b = {
        **a,
        "run_id": "2",
        "chain_sequence": 1,
        "previous_receipt_hash": h0,
    }
    sig, alg = sign_receipt(b)
    assert alg == "HMAC-SHA256"
    b["signature"] = sig
    b["chain_signature_algorithm"] = alg
    ok, _detail = verify_receipt_signature(b)
    assert ok

    state = tmp_path / "state"
    persist_receipt_to_chain_state(state, "tid", a, 0)
    persist_receipt_to_chain_state(state, "tid", b, 1)
    rep = verify_chain_for_target(state, "tid")
    assert rep.intact
    assert rep.chain_length == 2


def test_persisted_second_receipt_links_to_first_hash(tmp_path, monkeypatch):
    monkeypatch.setenv("DEBRIEF_CHAIN_HMAC_SECRET", "pytest-secret")
    first = {
        "schema_version": "1.0",
        "run_id": "1",
        "chain_sequence": 0,
        "previous_receipt_hash": None,
        "receipt_type": "analysis",
        "scheduled": False,
        "generated_at": "2026-01-01T00:00:00Z",
    }
    h0 = receipt_document_hash(first)
    second = {
        **first,
        "run_id": "2",
        "chain_sequence": 1,
        "previous_receipt_hash": h0,
    }
    sig, alg = sign_receipt(second)
    second["signature"] = sig
    second["chain_signature_algorithm"] = alg

    state = tmp_path / "state"
    persist_receipt_to_chain_state(state, "tid", first, 0)
    persist_receipt_to_chain_state(state, "tid", second, 1)

    p0 = state / "tid" / "receipts" / "000000.json"
    p1 = state / "tid" / "receipts" / "000001.json"
    d0 = json.loads(p0.read_text(encoding="utf-8"))
    d1 = json.loads(p1.read_text(encoding="utf-8"))
    assert receipt_document_hash(d0) == h0
    assert d1["previous_receipt_hash"] == h0
    assert len(h0) > 0
    h1 = receipt_document_hash(d1)
    assert len(h1) > 0


def test_tamper_fails_signature(tmp_path, monkeypatch):
    monkeypatch.setenv("DEBRIEF_CHAIN_HMAC_SECRET", "pytest-secret")
    rec = {
        "chain_sequence": 0,
        "previous_receipt_hash": None,
        "receipt_type": "analysis",
        "generated_at": "2026-01-01T00:00:00Z",
        "run_id": "x",
    }
    sig, alg = sign_receipt(rec)
    rec["signature"] = sig
    rec["chain_signature_algorithm"] = alg
    rec["run_id"] = "y"
    ok, _ = verify_receipt_signature(rec)
    assert not ok
