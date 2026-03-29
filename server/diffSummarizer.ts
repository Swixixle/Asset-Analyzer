import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

export type DepChange = { name: string; from?: string; to?: string; kind: "added" | "removed" | "version_changed" };
export type CveEntry = { id?: string; summary?: string; severity?: number; cvss?: number };
export type EndpointEntry = { path?: string; method?: string; auth?: string };
export type AuthChange = { path?: string; from?: string; to?: string };

export type StructuredDiff = {
  dependencies: DepChange[];
  newCves: CveEntry[];
  closedCves: CveEntry[];
  newEndpoints: EndpointEntry[];
  removedEndpoints: EndpointEntry[];
  authChanges: AuthChange[];
};

function readJson(p: string): Record<string, unknown> | null {
  try {
    if (!existsSync(p)) return null;
    const t = readFileSync(p, "utf8");
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packageKeys(g: Record<string, unknown> | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!g) return m;
  const pkgs = g.packages;
  if (!Array.isArray(pkgs)) return m;
  for (const p of pkgs) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const name = String(o.name || o.package || "");
    const ver = String(o.version || o.versionRequested || "");
    if (name) m.set(name, ver);
  }
  return m;
}

function cveList(g: Record<string, unknown> | null): Map<string, CveEntry> {
  const m = new Map<string, CveEntry>();
  if (!g) return m;
  const pkgs = g.packages;
  if (!Array.isArray(pkgs)) return m;
  for (const p of pkgs) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const osv = o.osv as Record<string, unknown> | undefined;
    const vulns = (osv?.vulnerabilities as unknown[]) || [];
    for (const v of vulns) {
      if (!v || typeof v !== "object") continue;
      const vu = v as Record<string, unknown>;
      const id = String(vu.id || vu.cve || Math.random());
      const sev = vu.database_specific as Record<string, unknown> | undefined;
      const cvss = typeof sev?.cvss === "number" ? sev.cvss : Number(vu.cvss || 0);
      m.set(id, { id, summary: String(vu.summary || ""), severity: cvss, cvss });
    }
  }
  return m;
}

function endpoints(api: Record<string, unknown> | null): Map<string, EndpointEntry> {
  const m = new Map<string, EndpointEntry>();
  if (!api) return m;
  const routes = (api.routes as unknown[]) || (api.endpoints as unknown[]) || [];
  if (!Array.isArray(routes)) return m;
  for (const r of routes) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const p = String(o.path || o.pattern || "");
    const method = String(o.method || o.verb || "*");
    const key = `${method} ${p}`;
    m.set(key, {
      path: p,
      method,
      auth: String(o.auth || o.authz || o.authentication || "unknown"),
    });
  }
  return m;
}

export function computeStructuredDiff(prevRunDir: string | null, newRunDir: string): StructuredDiff {
  const prevDg = prevRunDir ? readJson(path.join(prevRunDir, "dependency_graph.json")) : null;
  const newDg = readJson(path.join(newRunDir, "dependency_graph.json"));
  const prevApi = prevRunDir ? readJson(path.join(prevRunDir, "api_surface.json")) : null;
  const newApi = readJson(path.join(newRunDir, "api_surface.json"));

  const pm = packageKeys(prevDg);
  const nm = packageKeys(newDg);
  const dependencies: DepChange[] = [];
  for (const [name, ver] of nm) {
    if (!pm.has(name)) dependencies.push({ name, kind: "added", to: ver });
    else if (pm.get(name) !== ver) {
      dependencies.push({ name, kind: "version_changed", from: pm.get(name), to: ver });
    }
  }
  for (const [name, ver] of pm) {
    if (!nm.has(name)) dependencies.push({ name, kind: "removed", from: ver });
  }

  const pc = cveList(prevDg);
  const nc = cveList(newDg);
  const newCves: CveEntry[] = [];
  const closedCves: CveEntry[] = [];
  for (const [id, e] of nc) {
    if (!pc.has(id)) newCves.push(e);
  }
  for (const [id, e] of pc) {
    if (!nc.has(id)) closedCves.push(e);
  }

  const pe = endpoints(prevApi);
  const ne = endpoints(newApi);
  const newEndpoints: EndpointEntry[] = [];
  const removedEndpoints: EndpointEntry[] = [];
  const authChanges: AuthChange[] = [];
  for (const [k, e] of ne) {
    if (!pe.has(k)) newEndpoints.push(e);
    else {
      const o = pe.get(k)!;
      if (o.auth !== e.auth) {
        if (String(o.auth).toLowerCase().includes("required") && String(e.auth).toLowerCase().includes("none")) {
          authChanges.push({ path: e.path, from: o.auth, to: e.auth });
        } else if (o.auth !== e.auth) {
          authChanges.push({ path: e.path, from: o.auth, to: e.auth });
        }
      }
    }
  }
  for (const [k, e] of pe) {
    if (!ne.has(k)) removedEndpoints.push(e);
  }

  return { dependencies, newCves, closedCves, newEndpoints, removedEndpoints, authChanges };
}

export function detectAnomalies(diff: StructuredDiff): { flagged: boolean; reason: string } {
  for (const c of diff.newCves) {
    const s = Number(c.cvss || c.severity || 0);
    if (s >= 7.0) {
      return { flagged: true, reason: `New CVE with CVSS >= 7.0: ${c.id || "unknown"}` };
    }
  }
  for (const a of diff.authChanges) {
    const from = String(a.from || "").toLowerCase();
    const to = String(a.to || "").toLowerCase();
    if (from.includes("required") || from.includes("auth")) {
      if (to.includes("none") || to === "open" || to.includes("unauthenticated")) {
        return { flagged: true, reason: `Endpoint auth relaxed to none: ${a.path}` };
      }
    }
  }
  const removedNames = new Set(diff.dependencies.filter((d) => d.kind === "removed").map((d) => d.name));
  const addedNames = new Set(diff.dependencies.filter((d) => d.kind === "added").map((d) => d.name));
  if (removedNames.size && addedNames.size) {
    for (const r of removedNames) {
      const fuzzy = [...addedNames].some((a) => a.includes("unknown") || a.startsWith("@"));
      if (fuzzy) {
        return { flagged: true, reason: "Dependency removed and unknown replacement added" };
      }
    }
  }
  return { flagged: false, reason: "" };
}

export async function summarizeDiffForCompliance(
  diff: StructuredDiff,
): Promise<string> {
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    return summarizeDeterministic(diff);
  }
  const client = new OpenAI({
    apiKey,
    baseURL:
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      undefined,
  });
  const model = process.env.DEBRIEF_ANALYZER_MODEL || "gpt-4.1-mini";
  const structured = JSON.stringify(diff, null, 2);
  const user = `You are summarizing a software change for a non-technical compliance officer. Here is what changed between two analysis snapshots:\n${structured}\n\nWrite 2-3 sentences in plain English describing what changed. Be specific. If nothing significant changed, say so clearly.`;
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Plain language only. No markdown code fences." },
        { role: "user", content: user },
      ],
      max_completion_tokens: 400,
    });
    const t = res.choices[0]?.message?.content?.trim();
    return t || summarizeDeterministic(diff);
  } catch {
    return summarizeDeterministic(diff);
  }
}

function summarizeDeterministic(diff: StructuredDiff): string {
  const parts: string[] = [];
  if (diff.dependencies.length) {
    parts.push(`${diff.dependencies.length} dependency change(s).`);
  }
  if (diff.newCves.length) parts.push(`${diff.newCves.length} new CVE reference(s).`);
  if (diff.newEndpoints.length || diff.removedEndpoints.length) {
    parts.push("API surface changed.");
  }
  return parts.length
    ? parts.join(" ")
    : "No significant dependency, vulnerability, or API surface changes detected between snapshots.";
}
