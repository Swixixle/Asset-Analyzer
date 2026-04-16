/**
 * Public Notion share links — best-effort HTML fetch and strip to plain text.
 * Private pages require the official API + token (not handled here).
 */
import sanitizeHtml from "sanitize-html";

const MAX_PLAIN_LENGTH = 48_000;
const MAX_REDIRECTS = 8;

/** Parsed-URL hostname allowlist (no substring tricks on the full URL string). */
function isNotionAllowedUrl(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  return (
    host === "notion.so" ||
    host.endsWith(".notion.so") ||
    host === "notion.site" ||
    host.endsWith(".notion.site")
  );
}

function parseNotionInitialUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid Notion URL");
  }
  if (!isNotionAllowedUrl(u)) {
    throw new Error("Notion ingest only supports notion.so and notion.site URLs");
  }
  return u;
}

/**
 * Follow redirects manually so a302 to an attacker-controlled host cannot bypass the allowlist
 * (fetch "follow" would permit SSRF off the initial notion.so URL).
 */
async function fetchNotionWithAllowlistedRedirects(startUrl: URL): Promise<Response> {
  let url = startUrl;
  const headers = {
    "User-Agent": "DebriefNotionFetch/1.0",
    Accept: "text/html,application/xhtml+xml",
  };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.href, {
      redirect: "manual",
      headers,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new Error("Notion fetch: redirect without Location");
      }
      const next = new URL(loc, url);
      if (!isNotionAllowedUrl(next)) {
        throw new Error("Notion fetch: redirect left allowed Notion hosts");
      }
      url = next;
      continue;
    }
    return res;
  }
  throw new Error("Notion fetch: too many redirects");
}

export async function fetchNotionPublicAsPlainText(notionUrl: string): Promise<string> {
  const start = parseNotionInitialUrl(notionUrl);
  const res = await fetchNotionWithAllowlistedRedirects(start);
  if (!res.ok) {
    throw new Error(`Notion fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  // Plain-text oriented: no tags preserved; sanitize-html strips markup safely (vs regex).
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
