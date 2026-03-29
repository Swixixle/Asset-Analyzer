import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test" });
  const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });
  return { mockSendMail, mockCreateTransport };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

import { sendAnomalyEmail } from "../server/alertDispatch";

describe("sendAnomalyEmail", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "587";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
  });

  it("invokes sendMail with expected recipients and body", async () => {
    const repoUrl = "https://github.com/acme/widget";
    await sendAnomalyEmail({
      to: "ops@example.com",
      targetLabel: "widget",
      targetId: "target-uuid-1",
      timestamp: "2026-03-29T12:00:00Z",
      diffSummary: `Repo: ${repoUrl}\nauth change detected`,
      receiptHash: "abc123def456",
      anomalyReason: "endpoint_auth_delta",
    });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const arg = mockSendMail.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
    };
    expect(arg.to).toBe("ops@example.com");
    expect(arg.subject.trim().length).toBeGreaterThan(0);
    expect(arg.text).toContain(repoUrl);
    expect(arg.text.trim().length).toBeGreaterThan(0);
  });
});
