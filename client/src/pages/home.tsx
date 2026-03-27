import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProject, triggerProjectAnalysis } from "@/hooks/use-projects";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useDebriefApiKey } from "@/contexts/DebriefApiKeyContext";

function validateRepoUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return "Enter a GitHub repository URL.";
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return "That doesn't look like a valid URL.";
  }
  const host = u.hostname.replace(/^www\./i, "");
  if (host !== "github.com") return "Only github.com URLs are supported.";
  const parts = u.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  if (parts.length < 2) return "Use a URL like https://github.com/username/repo";
  return null;
}

function normalizeRepoUrl(url: string): string {
  const u = new URL(url.trim());
  const parts = u.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  return `https://github.com/${parts[0]}/${parts[1]}`;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [label, setLabel] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const { setApiKey } = useDebriefApiKey();
  const [, setLocation] = useLocation();
  const createProject = useCreateProject();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const syncKeyToContext = () => {
    setApiKey(apiKeyInput);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    const key = apiKeyInput.trim();
    if (!key) {
      setInlineError("An API key is required. Contact us to get access.");
      return;
    }
    syncKeyToContext();
    const name = label.trim() || repoUrl.trim().split("/").filter(Boolean).pop() || "Repository";
    const urlErr = validateRepoUrl(repoUrl);
    if (urlErr) {
      setInlineError(urlErr);
      return;
    }
    const normalizedUrl = normalizeRepoUrl(repoUrl);

    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({
        url: normalizedUrl,
        name,
        mode: "github",
        apiKey: key,
      });
      await triggerProjectAnalysis(project.id, key);
      setLocation(`/projects/${project.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setInlineError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout variant="light">
      <div className="max-w-3xl mx-auto text-center px-4">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
          Know exactly what you&apos;re working with.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Debrief analyzes any codebase and produces a signed, evidence-anchored brief you can act on.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <ValueProp text="30 minutes. Not 30 days." />
          <ValueProp text="Plain language. Not developer jargon." />
          <ValueProp text={'Signed evidence. Not someone\'s opinion.'} />
        </div>

        <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/80 p-8 md:p-10 text-left shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Settings</p>
          <Label htmlFor="api-key" className="text-slate-800 text-sm font-medium">
            Enter your API key to get started
          </Label>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="mt-2 h-11 bg-white border-slate-300 text-slate-900"
            placeholder="Your API key"
          />
          {!apiKeyInput.trim() && (
            <p className="mt-2 text-sm text-slate-600">An API key is required. Contact us to get access.</p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <Label htmlFor="repo-url" className="text-slate-800 text-sm font-medium">
                GitHub repository
              </Label>
              <Input
                id="repo-url"
                data-testid="input-github-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="mt-2 h-12 text-base bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div>
              <Label htmlFor="repo-label" className="text-slate-800 text-sm font-medium">
                Name / label
              </Label>
              <Input
                id="repo-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My project"
                className="mt-2 h-12 text-base bg-white border-slate-300 text-slate-900"
              />
            </div>

            {inlineError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
                {inlineError}
              </p>
            )}

            <Button
              type="submit"
              data-testid="button-run-debrief"
              disabled={submitting || createProject.isPending}
              className="w-full h-12 text-base font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              {submitting || createProject.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Debrief on your repo…
                </span>
              ) : (
                "Run Debrief"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-8 text-sm text-slate-500">Supports any public GitHub repository</p>
      </div>
    </Layout>
  );
}

function ValueProp({ text }: { text: string }) {
  return (
    <p className="text-base md:text-lg font-medium text-slate-800 leading-snug border-l-4 border-slate-300 pl-4">
      {text}
    </p>
  );
}
