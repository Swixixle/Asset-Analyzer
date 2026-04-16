/**
 * Public Notion share links — best-effort HTML fetch and strip to plain text.
 * Private pages require the official API + token (not handled here).
 */
import sanitizeHtml from "sanitize-html";

const MAX_PLAIN_LENGTH = 48_000;

/** Limit fetches to Notion hostnames to reduce SSRF / open-proxy risk. */
function assertNotionPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid Notion URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Notion URL must use http or https");
  }
  const host = u.hostname.toLowerCase();
  const allowed =
    host === "notion.so" ||
    host.endsWith(".notion.so") ||
    host === "www.notion.so" ||
    host === "notion.site" ||
    host.endsWith(".notion.site");
  if (!allowed) {
    throw new Error("Notion ingest only supports notion.so and notion.site URLs");
  }
  return u;
}

export async function fetchNotionPublicAsPlainText(notionUrl: string): Promise<string> {
  const u = assertNotionPublicUrl(notionUrl);
  const res = await fetch(u.href, {
    redirect: "follow",
    headers: {
      "User-Agent": "DebriefNotionFetch/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Notion fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  // Strip tags and unsafe content without regex-based HTML "parsing" (CodeQL-friendly).
  const plain = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
  return plain
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PLAIN_LENGTH);
}
