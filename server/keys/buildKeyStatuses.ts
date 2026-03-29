import type { KeyStatus } from "@shared/evidenceChainModel";

export function buildKeyStatuses(): KeyStatus[] {
  return [
    {
      name: "DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY",
      displayName: "Receipt signing key (Ed25519 private key)",
      status: process.env.DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY?.trim() ? "set" : "missing",
      role: "This key signs every receipt Debrief produces. The signature is mathematical proof that the receipt hasn't been altered since it was created. Anyone with your public key can verify your receipts independently — without trusting you.",
      consequence:
        "Without this key, receipts are unsigned. They still record what the analyzer found, but a buyer or auditor has no way to verify they weren't edited after the fact.",
      howToStore:
        "Never put this in your code or commit it to git. Store it in your platform's secret manager (Render environment group, 1Password, Doppler, or Infisical). Treat it like a password — if it leaks, rotate it immediately.",
      rotationSteps: [
        "Generate a new Ed25519 keypair (Debrief can log one on first boot if this var is unset — copy from logs only for development).",
        "Update DEBRIEF_CHAIN_SIGNING_PRIVATE_KEY and DEBRIEF_CHAIN_SIGNING_PUBLIC_KEY in your platform secrets.",
        "Redeploy the API and worker services.",
        "Old receipts remain valid under the old key. New receipts will use the new key. Document the rotation date.",
      ],
    },
    {
      name: "OPENAI_API_KEY",
      displayName: "OpenAI API key",
      status: (process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY)?.trim()
        ? "set"
        : "missing",
      role: "Powers the education receptionist — the plain-language explanations you get when you click a node. Without it, the graph still works but the Explain / Other Ways / Suggestions tabs return a 503 error instead of useful copy.",
      consequence:
        "The education layer works visually but the receptionist tabs will fail. The graph still shows node states, anomalies, and chain status.",
      howToStore:
        "Store in your platform secrets manager, not in .env committed to git. If you think a key was exposed, revoke it immediately at platform.openai.com/api-keys before rotating.",
      rotationSteps: [
        "Go to platform.openai.com/api-keys and revoke the exposed key.",
        "Create a new key.",
        "Update OPENAI_API_KEY in your platform secrets.",
        "Redeploy. The receptionist will resume working immediately.",
      ],
    },
    {
      name: "API_KEY",
      displayName: "Debrief API key (access control)",
      status: !process.env.API_KEY?.trim()
        ? "missing"
        : process.env.API_KEY.startsWith("dk_") && process.env.API_KEY.length >= 40
          ? "auto"
          : "set",
      role: "Controls who can submit analysis requests. Every API call and browser session uses this key. If you're running Debrief in open web mode (DEBRIEF_OPEN_WEB=1), the UI doesn't require users to enter it — but the server still uses it internally.",
      consequence:
        "If auto-generated, this key changes every time the server restarts unless you persist it. Anyone using the API with a saved key will get 401 errors after a restart. Set it permanently in your .env or platform secrets.",
      howToStore:
        "Copy it from the server logs on first boot, then add it to your platform secrets as API_KEY. Share it only with people who need API access — not in public docs or git.",
      rotationSteps: [
        "Generate a new key: node -e \"console.log('dk_' + require('crypto').randomBytes(32).toString('hex'))\"",
        "Update API_KEY in your platform secrets.",
        "Redeploy the API service.",
        "Update any clients or scripts that use the old key.",
      ],
    },
    {
      name: "SMTP_URL",
      displayName: "Email alert connection (SMTP)",
      status: (process.env.SMTP_URL || process.env.SMTP_HOST)?.trim() ? "set" : "missing",
      role: "Sends email alerts when the scheduler detects an anomaly — new CVEs, auth changes, or a gap in the evidence chain. Without it, anomalies are still recorded in the chain but nobody gets notified.",
      consequence:
        "Alerts won't send. You'll need to check the Targets page manually to see anomalies. For compliance use cases, silent anomalies are a risk.",
      howToStore:
        "Use the SMTP_URL format: smtp://user:pass@host:587. The password in the URL is your SMTP credential — store the whole URL as a single secret, not split across five fields.",
      rotationSteps: [
        "Get new SMTP credentials from your email provider.",
        "Update SMTP_URL in your platform secrets.",
        "Redeploy. Test by triggering a manual analysis with an alert_email set on a scheduled target.",
      ],
    },
  ];
}
