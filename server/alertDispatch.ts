import nodemailer from "nodemailer";

function getSmtpTransport(): nodemailer.Transporter | null {
  const smtpUrl = process.env.SMTP_URL?.trim();
  if (smtpUrl) {
    return nodemailer.createTransport(smtpUrl);
  }
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendAnomalyEmail(opts: {
  to: string;
  targetLabel: string;
  targetId: string;
  timestamp: string;
  diffSummary: string;
  receiptHash: string;
  anomalyReason: string;
  appUrl?: string;
}): Promise<void> {
  const transporter = getSmtpTransport();
  if (!transporter) {
    console.warn("[alert] SMTP_URL or SMTP_HOST not set — skipping email");
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@localhost";
  const linkBase = process.env.APP_URL || "http://localhost:5000";
  const body = [
    `Anomaly: ${opts.anomalyReason}`,
    "",
    opts.diffSummary,
    "",
    `Receipt hash: ${opts.receiptHash}`,
    `Time: ${opts.timestamp}`,
    "",
    `Timeline: ${linkBase}/timeline/${encodeURIComponent(opts.targetId)}`,
  ].join("\n");
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: `[Debrief Alert] Anomaly detected in ${opts.targetLabel} — ${opts.timestamp}`,
    text: body,
  });
}

export async function postAnomalyWebhook(
  url: string,
  payload: {
    target_id: string;
    target_label: string;
    timestamp: string;
    anomaly_reason: string;
    diff_summary: string;
    receipt_hash: string;
  },
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("[alert] webhook failed", res.status, await res.text().catch(() => ""));
  }
}
