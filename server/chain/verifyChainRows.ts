import { createHmac, createPublicKey, verify } from "node:crypto";
import { receiptDocumentSha256, signingPayloadBytes } from "./receiptCanonical";
import type { ReceiptChainRow } from "@shared/schema";

export type VerificationStep = {
  chainSequence: number;
  ok: boolean;
  detail: string;
};

export type ChainVerifyNodeResult = {
  chainIntact: boolean;
  verificationLog: VerificationStep[];
  brokenAtSequence: number | null;
  gapsCount: number;
  anomaliesCount: number;
};

// Ed25519 takes precedence over HMAC when both env vars are configured.
// HMAC is for internal use only. Use Ed25519 for any buyer-facing verification.
export function verifyReceiptSignatureSync(doc: Record<string, unknown>): { ok: boolean; detail: string } {
  const sig = doc.signature;
  const alg = doc.chain_signature_algorithm;
  if (sig == null || sig === "") {
    return { ok: true, detail: "no_signature" };
  }
  const msg = signingPayloadBytes(doc);
  if (alg === "Ed25519") {
    const pem = process.env.DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY?.trim();
    if (!pem) {
      return { ok: false, detail: "missing_DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY" };
    }
    try {
      const key = createPublicKey({ key: pem, format: "pem" });
      const ok = verify(null, msg, key, Buffer.from(String(sig), "hex"));
      return ok ? { ok: true, detail: "ed25519_ok" } : { ok: false, detail: "ed25519_bad" };
    } catch (e: any) {
      return { ok: false, detail: `ed25519_err:${e?.message || e}` };
    }
  }
  if (alg === "HMAC-SHA256") {
    const secret = process.env.DEBRIEF_CHAIN_HMAC_SECRET?.trim();
    if (!secret) {
      return { ok: false, detail: "missing_DEBRIEF_CHAIN_HMAC_SECRET" };
    }
    const expected = createHmac("sha256", secret).update(msg).digest("hex");
    return expected === String(sig)
      ? { ok: true, detail: "hmac_ok" }
      : { ok: false, detail: "hmac_mismatch" };
  }
  return { ok: false, detail: `unknown_alg:${alg}` };
}

export function verifyChainRowsOrdered(rows: ReceiptChainRow[]): ChainVerifyNodeResult {
  const log: VerificationStep[] = [];
  let intact = true;
  let brokenAt: number | null = null;
  const sorted = [...rows].sort((a, b) => a.chainSequence - b.chainSequence);
  let prevDoc: Record<string, unknown> | null = null;
  let expectedSeq = 0;

  const gapsCount = sorted.filter((r) => r.receiptType === "gap").length;
  const anomaliesCount = sorted.filter((r) => r.anomalyFlagged).length;

  for (const row of sorted) {
    const doc = (row.receiptDocument || {}) as Record<string, unknown>;
    if (row.chainSequence !== expectedSeq) {
      log.push({
        chainSequence: row.chainSequence,
        ok: false,
        detail: `sequence_expected_${expectedSeq}`,
      });
      return { chainIntact: false, verificationLog: log, brokenAtSequence: row.chainSequence, gapsCount, anomaliesCount };
    }
    const prevHash = (doc.previous_receipt_hash as string | null) ?? null;
    if (expectedSeq === 0) {
      if (prevHash != null) {
        log.push({ chainSequence: 0, ok: false, detail: "genesis_must_have_null_prev" });
        return { chainIntact: false, verificationLog: log, brokenAtSequence: 0, gapsCount, anomaliesCount };
      }
    } else if (prevDoc) {
      const want = receiptDocumentSha256(prevDoc);
      if (prevHash !== want) {
        log.push({
          chainSequence: row.chainSequence,
          ok: false,
          detail: `prev_hash_mismatch`,
        });
        return {
          chainIntact: false,
          verificationLog: log,
          brokenAtSequence: row.chainSequence,
          gapsCount,
          anomaliesCount,
        };
      }
    }
    const sigRes = verifyReceiptSignatureSync(doc);
    log.push({ chainSequence: row.chainSequence, ok: sigRes.ok, detail: sigRes.detail });
    if (!sigRes.ok) {
      return {
        chainIntact: false,
        verificationLog: log,
        brokenAtSequence: row.chainSequence,
        gapsCount,
        anomaliesCount,
      };
    }
    prevDoc = doc;
    expectedSeq += 1;
  }

  return {
    chainIntact: intact,
    verificationLog: log,
    brokenAtSequence: brokenAt,
    gapsCount,
    anomaliesCount,
  };
}
