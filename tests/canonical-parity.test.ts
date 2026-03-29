import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { canonicalReceiptJson } from "../server/chain/receiptCanonical";

/**
 * Parity with Python `server/analyzer/src/receipt_chain.canonical_json_bytes` (decoded UTF-8).
 * Run from repo root: npm run test:unit
 */
describe("canonical JSON Node ↔ Python", () => {
  it("matches canonical_json_bytes output for the same object", () => {
    const fixture = {
      id: "run-parity-1",
      timestamp: "2026-03-29T12:00:00Z",
      repo_url: "https://github.com/o/r",
      receipt_hash: "deadbeef",
      previous_receipt_hash: null as string | null,
      nested: { z: 1, a: { m: 2, b: 3 } },
    };

    const nodeOut = canonicalReceiptJson(fixture);

    const pythonOut = execSync(
      `python3 -c "import json,sys; from server.analyzer.src.receipt_chain import canonical_json_bytes; obj=json.loads(sys.stdin.read()); sys.stdout.write(canonical_json_bytes(obj).decode())"`,
      {
        input: JSON.stringify(fixture),
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: process.cwd() },
        encoding: "utf-8",
      },
    );

    expect(
      pythonOut === nodeOut,
      `Canonical JSON mismatch.\nNode:\n${nodeOut}\nPython:\n${pythonOut}`,
    ).toBe(true);
  });
});
