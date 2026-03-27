import { useMemo } from "react";
import type { Analysis } from "@shared/schema";
import { Button } from "@/components/ui/button";

const DEBRIEF_VERSION = "1.0";

export type DebriefProject = {
  name: string;
  url: string;
};

type DebriefReportProps = {
  project: DebriefProject;
  analysis: Analysis;
  /** Optional cryptographic signature string when a certificate exists */
  evidenceSignature?: string | null;
};

type ToolRec = {
  name: string;
  description: string;
  href: string;
};

const TOOL_RULES: { match: (s: string) => boolean; tools: ToolRec[] }[] = [
  {
    match: (s) => /observability|logging|monitoring|metrics|tracing/i.test(s),
    tools: [
      { name: "Sentry", description: "Error tracking and performance monitoring for production apps.", href: "https://sentry.io" },
      { name: "Datadog", description: "Full-stack observability, APM, and infrastructure monitoring.", href: "https://www.datadoghq.com" },
    ],
  },
  {
    match: (s) => /test|testing|coverage|e2e|unit test/i.test(s),
    tools: [
      { name: "Vitest", description: "Fast unit test runner aligned with the Vite ecosystem.", href: "https://vitest.dev" },
      { name: "Jest", description: "Popular JavaScript test framework with a rich matcher API.", href: "https://jestjs.io" },
      { name: "Playwright", description: "End-to-end testing across browsers with reliable automation.", href: "https://playwright.dev" },
    ],
  },
  {
    match: (s) => /auth|authentication|oauth|login|session|jwt/i.test(s),
    tools: [
      { name: "Auth0", description: "Identity platform for authentication and authorization.", href: "https://auth0.com" },
      { name: "Clerk", description: "Drop-in user management and SSO for modern web apps.", href: "https://clerk.com" },
      { name: "Auth.js (NextAuth)", description: "Open auth library for Next.js and other frameworks.", href: "https://authjs.dev" },
    ],
  },
  {
    match: (s) => /analytics|product analytics|funnel|event tracking/i.test(s),
    tools: [
      { name: "PostHog", description: "Product analytics, feature flags, and session replay.", href: "https://posthog.com" },
      { name: "Plausible", description: "Privacy-friendly, lightweight web analytics.", href: "https://plausible.io" },
    ],
  },
  {
    match: (s) => /documentation|docs site|readme|developer portal/i.test(s),
    tools: [
      { name: "Mintlify", description: "Beautiful developer documentation with a polished default theme.", href: "https://mintlify.com" },
      { name: "Docusaurus", description: "Static-site generator geared to product and API documentation.", href: "https://docusaurus.io" },
    ],
  },
];

function formatAnalysisTime(analysis: Analysis): string {
  const raw = analysis.createdAt as unknown as string | Date | undefined;
  if (!raw) return "—";
  const d = typeof raw === "string" ? new Date(raw) : raw;
  return isNaN(d.getTime()) ? "—" : d.toISOString();
}

function stripMdToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .trim();
}

function firstParagraphSummaries(text: string, maxSentences: number): string {
  const plain = stripMdToPlain(text).replace(/\n+/g, " ");
  const parts = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, maxSentences).join(" ") || plain.slice(0, 480) || "No summary available yet.";
}

function normalizeUnknowns(raw: unknown): string[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((u: any) =>
    typeof u === "string" ? u : u?.what_is_missing || u?.description || u?.item || JSON.stringify(u),
  );
}

function normalizeClaims(raw: unknown): { statement: string; ref: string }[] {
  if (!raw) return [];
  const arr: any[] = Array.isArray(raw) ? raw : (raw as any)?.claims && Array.isArray((raw as any).claims) ? (raw as any).claims : [];
  return arr.map((claim) => {
    const statement = claim.claim || claim.statement || "Finding";
    const evidence = claim.evidence;
    let ref = "";
    if (Array.isArray(evidence)) {
      ref = evidence.map((ev: any) => ev.display || `${ev.path}:${ev.line_start}`).filter(Boolean).join("; ");
    }
    return { statement, ref };
  });
}

function watchItemsFromOperateGaps(operate: any): { statement: string; ref: string }[] {
  if (!operate?.gaps || !Array.isArray(operate.gaps)) return [];
  return operate.gaps.map((gap: any) => ({
    statement: [gap.title, gap.recommendation || gap.action].filter(Boolean).join(" — ") || "Operational gap",
    ref: gap.evidence?.display || (Array.isArray(gap.evidence) ? gap.evidence.map((e: any) => e.display).join("; ") : "") || "",
  }));
}

function anatomyProse(operate: any): string[] {
  if (!operate) {
    return ["No structured operator profile was generated for this repository."];
  }
  const paragraphs: string[] = [];
  const mode = operate.mode ? `Analysis mode: ${operate.mode}.` : "";
  const ver = operate.tool_version ? ` Tool version: ${operate.tool_version}.` : "";
  if (mode || ver) paragraphs.push(`${mode}${ver}`.trim());

  const boot = operate.boot;
  if (boot) {
    const parts: string[] = [];
    if (boot.install?.length) parts.push(`${boot.install.length} install command(s) were detected`);
    if (boot.dev?.length) parts.push(`${boot.dev.length} dev start path(s)`);
    if (boot.prod?.length) parts.push(`${boot.prod.length} production start path(s)`);
    if (boot.ports?.length) parts.push(`port configuration noted (${boot.ports.length} item(s))`);
    if (parts.length) paragraphs.push(`Boot and runtime: ${parts.join("; ")}.`);
  }

  const integ = operate.integrate;
  if (integ) {
    const e = integ.endpoints?.length ?? 0;
    const v = integ.env_vars?.length ?? 0;
    const a = integ.auth?.length ?? 0;
    if (e + v + a > 0) {
      paragraphs.push(
        `Integrations: approximately ${e} API surface item(s), ${v} referenced environment variable(s), and ${a} auth-related signal(s) were extracted from static artifacts.`,
      );
    }
  }

  const dep = operate.deploy;
  if (dep) {
    const plat = dep.platform?.length ?? 0;
    const ci = dep.ci?.length ?? 0;
    const ctr = dep.containerization?.length ?? 0;
    if (plat + ci + ctr > 0) {
      paragraphs.push(
        `Deployment signals: ${plat} platform hint(s), ${ci} CI reference(s), ${ctr} containerization reference(s).`,
      );
    }
  }

  if (paragraphs.length === 0) paragraphs.push("Structured operator data was present but did not yield a prose summary.");
  return paragraphs;
}

function collectGapText(unknowns: string[], operate: any): string {
  const gapTitles = (operate?.gaps || []).map((g: any) => `${g.title || ""} ${g.recommendation || g.action || ""}`);
  return [...unknowns, ...gapTitles].join(" ").toLowerCase();
}

function toolRecommendationsForGaps(blob: string): ToolRec[] {
  const seen = new Set<string>();
  const out: ToolRec[] = [];
  for (const rule of TOOL_RULES) {
    if (!rule.match(blob)) continue;
    for (const t of rule.tools) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      out.push(t);
    }
  }
  return out;
}

function evidenceRows(analysis: Analysis): { path: string; hash: string; status: string }[] {
  const rows: { path: string; hash: string; status: string }[] = [];
  const raw = analysis.claims as any;
  const claims: any[] = Array.isArray(raw) ? raw : raw?.claims && Array.isArray(raw.claims) ? raw.claims : [];
  for (const c of claims) {
    const evs = Array.isArray(c.evidence) ? c.evidence : [];
    for (const ev of evs) {
      const p = ev.path || "—";
      const h = (ev.snippet_hash || "—").toString().slice(0, 16);
      const st = c.status === "evidenced" || c.verified === true ? "Anchored" : "Referenced";
      rows.push({ path: p, hash: h, status: st });
    }
  }
  const cov = analysis.coverage as Record<string, unknown> | null;
  if (rows.length === 0 && cov && typeof cov.run_id === "string") {
    rows.push({
      path: `(coverage run ${cov.run_id})`,
      hash: String(cov.run_id).slice(0, 16),
      status: `scanned ${(cov as any).scanned ?? 0} / skipped ${(cov as any).skipped ?? 0}`,
    });
  }
  if (rows.length === 0) {
    rows.push({ path: "—", hash: "—", status: "No per-file evidence rows in stored analysis" });
  }
  return rows;
}

function sectionShell(title: string, children: React.ReactNode) {
  return (
    <section className="border-l-4 border-l-slate-300 pl-6 pr-2 py-8 border-b border-slate-200 last:border-b-0">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">{title}</h2>
      <div className="text-slate-800 space-y-4">{children}</div>
    </section>
  );
}

export function DebriefReport({ project, analysis, evidenceSignature }: DebriefReportProps) {
  const narrative = (analysis as { narrative_summary?: string }).narrative_summary;
  const dossier = analysis.dossier || "";
  const summaryText = narrative?.trim()
    ? firstParagraphSummaries(narrative, 5)
    : dossier
      ? firstParagraphSummaries(dossier, 5)
      : "No narrative or dossier text was available for this analysis.";

  const operate = analysis.operate as any;
  const unknownsList = normalizeUnknowns(analysis.unknowns);
  const watchList = useMemo(() => {
    const claimItems = normalizeClaims(analysis.claims);
    const gapWatch = watchItemsFromOperateGaps(operate);
    const merged = [...claimItems, ...gapWatch];
    const seen = new Set<string>();
    return merged.filter((w) => {
      const k = `${w.statement}|${w.ref}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [analysis.claims, operate]);

  const anatomy = useMemo(() => anatomyProse(operate), [operate]);
  const blob = useMemo(() => collectGapText(unknownsList, operate), [unknownsList, operate]);
  const tools = useMemo(() => toolRecommendationsForGaps(blob), [blob]);
  const tableRows = useMemo(() => evidenceRows(analysis), [analysis]);

  const commitSha =
    (operate?.snapshot?.commit_sha as string | undefined) ||
    (operate?.commit_sha as string | undefined) ||
    (analysis.coverage as any)?.commit_sha ||
    undefined;

  const hasEvidenceRecord = Boolean(
    analysis.coverage && typeof (analysis.coverage as any).run_id === "string",
  );

  return (
    <article className="bg-white text-slate-900 rounded-lg border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-4 px-8 py-6 border-b border-slate-200 bg-white">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-1">Debrief</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Analysis report</h1>
          <p className="text-sm text-slate-600 mt-1 font-mono">{project.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="border-slate-300 text-slate-700 bg-white" disabled>
            Download as PDF
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-slate-300 text-slate-700 bg-white" disabled>
            Share
          </Button>
        </div>
      </header>

      <div className="px-4 md:px-8">
        {sectionShell(
          "Identity",
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Repository</dt>
                <dd className="font-medium text-slate-900">{project.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">URL</dt>
                <dd className="break-all">
                  <a href={project.url} className="text-slate-800 underline underline-offset-2 hover:text-slate-600">
                    {project.url}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Commit</dt>
                <dd className="font-mono text-slate-800">{commitSha || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Analyzed at</dt>
                <dd className="font-mono text-slate-800">{formatAnalysisTime(analysis)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Debrief version</dt>
                <dd className="font-mono text-slate-800">{DEBRIEF_VERSION}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500 sr-only">Evidence</dt>
                <dd>
                  {hasEvidenceRecord ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-600/40 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Signed evidence record
                    </span>
                  ) : (
                    <span className="text-slate-500 text-sm">No coverage run id on file</span>
                  )}
                </dd>
              </div>
            </dl>
          </>,
        )}

        {sectionShell(
          "60-second summary",
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">What this is</p>
            <p className="text-xl leading-relaxed text-slate-800 font-normal max-w-3xl">{summaryText}</p>
          </>,
        )}

        {sectionShell(
          "Anatomy",
          <>
            {anatomy.map((p, i) => (
              <p key={i} className="leading-relaxed text-slate-800">
                {p}
              </p>
            ))}
            <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              [ Dependency map coming soon ]
            </div>
          </>,
        )}

        {sectionShell(
          "Patterns worth attention",
          <>
            {watchList.length === 0 ? (
              <p className="text-slate-600">No patterns flagged</p>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0">
                {watchList.map((w, i) => (
                  <li key={i} className="flex gap-2 text-slate-800">
                    <span className="shrink-0" aria-hidden>
                      ⚠️
                    </span>
                    <span>
                      <span className="font-medium">{w.statement}</span>
                      {w.ref ? <span className="block text-sm text-slate-600 font-mono mt-1">{w.ref}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>,
        )}

        {sectionShell(
          "What's missing",
          <>
            {unknownsList.length === 0 ? (
              <p className="text-slate-600">No gaps detected</p>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0">
                {unknownsList.map((u, i) => (
                  <li key={i} className="flex gap-2 text-slate-800">
                    <span className="shrink-0" aria-hidden>
                      ○
                    </span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            )}
          </>,
        )}

        {sectionShell(
          "Tools worth considering",
          <>
            {tools.length === 0 ? (
              <p className="text-slate-600">No tool suggestions matched the gaps detected in this run.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tools.map((t) => (
                  <a
                    key={t.name}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 hover:border-slate-300 transition-colors block no-underline text-inherit"
                  >
                    <h3 className="font-semibold text-slate-900">{t.name}</h3>
                    <p className="text-sm text-slate-700 mt-1 leading-snug">{t.description}</p>
                    <p className="text-xs text-slate-500 mt-2 font-mono truncate">{t.href}</p>
                  </a>
                ))}
              </div>
            )}
          </>,
        )}

        {sectionShell(
          "Evidence record",
          <>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">File / scope</th>
                    <th className="px-3 py-2 font-semibold">Hash (prefix)</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono text-xs text-slate-800 break-all">{r.path}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.hash}</td>
                      <td className="px-3 py-2 text-slate-700">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {evidenceSignature ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">Signature:</span>
                <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-800">
                  {evidenceSignature.slice(0, 24)}…
                </code>
                <Button type="button" variant="outline" size="sm" className="border-slate-300" disabled>
                  Verify
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-slate-500 mt-4 leading-relaxed max-w-2xl">
              Findings are anchored to file:line evidence. Hashes verify snippet presence at time of analysis.
            </p>
          </>,
        )}
      </div>
    </article>
  );
}
