import { generateKeyPairSync, randomBytes } from "crypto";

/** PEM-encoded keys for Python `cryptography` + Node `createPrivateKey` compatibility. */
export function ensureSigningKeys(): void {
  const priv = process.env.DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY?.trim();
  const pub = process.env.DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY?.trim();
  if (priv && pub) return;

  console.log(
    "[keys] DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY / PUBLIC_KEY not set — generating ephemeral Ed25519 keypair (PEM).",
  );
  console.log(
    "[keys] Persist by setting both vars in your environment (see logs below; use quoted multiline PEM or \\n escapes).",
  );

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  process.env.DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY = privPem;
  process.env.DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY = pubPem;

  const esc = (s: string) => s.replace(/\n/g, "\\n");
  console.log(`DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY=${esc(privPem)}`);
  console.log(`DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY=${esc(pubPem)}`);
}

export function ensureAccessKeys(): void {
  if (!process.env.API_KEY?.trim()) {
    const key = `dk_${randomBytes(32).toString("hex")}`;
    process.env.API_KEY = key;
    console.log("[keys] API_KEY not set — generated for this session:");
    console.log(`API_KEY=${key}`);
    console.log("[keys] Add this to your .env to make it permanent.");
  }

  if (!process.env.ADMIN_KEY?.trim()) {
    const key = `admin_${randomBytes(32).toString("hex")}`;
    process.env.ADMIN_KEY = key;
    console.log("[keys] ADMIN_KEY not set — generated for this session:");
    console.log(`ADMIN_KEY=${key}`);
    console.log("[keys] Add this to your .env to make it permanent.");
  }
}
