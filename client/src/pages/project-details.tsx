import { useRoute, Link } from "wouter";
import { useProject, useAnalysis } from "@/hooks/use-projects";
import { Layout } from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DebriefReport } from "@/components/DebriefReport";
import { Loader2, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ProjectDetails() {
  const [match, params] = useRoute("/projects/:id");
  const projectId = parseInt(params?.id || "0");
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: analysis, isLoading: analysisLoading } = useAnalysis(projectId);
  const [rawOpen, setRawOpen] = useState(false);

  if (projectLoading) return <LoadingScreen message="Loading project data..." />;

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-xl font-bold">Project Not Found</h2>
          <Link href="/">
            <div className="text-primary mt-4 cursor-pointer">Return Home</div>
          </Link>
        </div>
      </Layout>
    );
  }

  const isAnalyzing = project.status === "analyzing" || project.status === "pending";

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/projects">
            <div
              className="p-2 rounded-full hover-elevate text-muted-foreground cursor-pointer"
              data-testid="link-back-projects"
            >
              <ArrowLeft className="w-5 h-5" />
            </div>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-project-name">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1" data-testid="text-project-url">
              {project.url}
            </p>
          </div>
        </div>

        {isAnalyzing ? (
          <AnalyzingState />
        ) : project.status === "failed" ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6 text-center text-destructive">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Analysis Failed</h3>
              <p>Debrief could not complete analysis for this repository.</p>
            </CardContent>
          </Card>
        ) : analysisLoading ? (
          <LoadingScreen message="Loading Debrief…" />
        ) : analysis ? (
          <div className="space-y-8 pb-16">
            <DebriefReport project={{ name: project.name, url: project.url }} analysis={analysis} />

            <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setRawOpen(!rawOpen)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-mono text-muted-foreground hover:bg-secondary/30 transition-colors"
                data-testid="toggle-raw-data"
              >
                {rawOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                Raw data (developers)
              </button>
              {rawOpen && (
                <pre
                  className={cn(
                    "text-xs font-mono p-4 border-t border-border overflow-auto max-h-[480px]",
                    "text-muted-foreground bg-background/80",
                  )}
                >
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No analysis record found for this project.</p>
              <Link href="/projects">
                <Button className="mt-4" variant="outline">
                  Back to archives
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <Layout>
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-mono animate-pulse">{message}</p>
      </div>
    </Layout>
  );
}

function AnalyzingState() {
  const steps = [
    "Cloning repository…",
    "Scanning file structure…",
    "Analyzing dependencies… synthesizing brief…",
    "Anchoring evidence…",
  ];

  return (
    <div className="h-[560px] flex flex-col items-center justify-center text-center px-4">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 border-4 border-secondary rounded-full" />
        <div className="absolute inset-0 border-4 border-t-primary border-r-primary rounded-full animate-spin" />
        <div className="absolute inset-4 bg-secondary/30 rounded-full blur-xl animate-pulse" />
      </div>

      <h2 className="text-2xl font-display font-bold mb-2 text-foreground">Debrief in progress</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        We are scanning static artifacts and building your evidence-backed brief. This usually takes one to two minutes.
      </p>

      <div className="w-full max-w-sm space-y-3 font-mono text-xs text-left bg-secondary/20 p-6 rounded-lg border border-border">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary/80">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
