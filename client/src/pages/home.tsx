import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProject, useAnalyzeReplit } from "@/hooks/use-projects";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Github, Code2, Cpu, Terminal, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [url, setUrl] = useState("");
  const [, setLocation] = useLocation();
  const createProject = useCreateProject();
  const analyzeReplit = useAnalyzeReplit();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    const name = url.split("/").pop() || "Unknown Repo";
    
    createProject.mutate(
      { url, name },
      {
        onSuccess: (project) => {
          setLocation(`/projects/${project.id}`);
        },
      }
    );
  };

  const handleAnalyzeReplit = () => {
    analyzeReplit.mutate(undefined, {
      onSuccess: (project) => {
        setLocation(`/projects/${project.id}`);
      },
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-primary/20 text-xs text-primary font-mono mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            SYSTEM READY FOR INPUT
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 pb-2">
            Debrief
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Analyze a GitHub repository or this workspace to generate a signed, evidence-anchored brief your whole team can use.
          </p>

          <Card className="p-2 mt-8 bg-background/50 backdrop-blur-sm border-white/10 shadow-2xl shadow-primary/5 max-w-2xl mx-auto w-full">
            <form onSubmit={handleSubmit} className="flex gap-2 p-1">
              <div className="relative flex-1">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  data-testid="input-github-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="pl-10 h-12 bg-secondary/30 border-transparent focus:border-primary/50 text-base font-mono placeholder:text-muted-foreground/50 transition-all"
                  autoFocus
                />
              </div>
              <Button 
                data-testid="button-analyze-github"
                type="submit" 
                disabled={createProject.isPending}
              >
                {createProject.isPending ? "Initializing..." : "Analyze"}
                {!createProject.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>
          </Card>

          <div className="flex items-center gap-4 max-w-2xl mx-auto w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button 
            data-testid="button-analyze-replit"
            variant="outline"
            disabled={analyzeReplit.isPending}
            onClick={handleAnalyzeReplit}
          >
            <Terminal className="mr-2 w-5 h-5" />
            {analyzeReplit.isPending ? "Scanning Workspace..." : "Analyze This Workspace"}
          </Button>

          <a 
            href="/portal"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover-elevate active-elevate-2 border border-primary/30 bg-primary/10 text-primary px-4 py-2 transition-all"
            data-testid="button-portal-link"
          >
            <ExternalLink className="w-4 h-4" />
            Open Portal (Direct Link)
          </a>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">
            <FeatureCard 
              icon={<Code2 className="w-6 h-6 text-primary" />}
              title="Code Synthesis"
              description="Deep static analysis of codebase architecture and patterns."
            />
            <FeatureCard 
              icon={<Search className="w-6 h-6 text-primary" />}
              title="Claim Verification"
              description="Cross-reference README claims with actual implementation details."
            />
            <FeatureCard 
              icon={<Cpu className="w-6 h-6 text-primary" />}
              title="Operational Intel"
              description="Generate step-by-step execution guides and deployment strategies."
            />
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-secondary/20 border border-white/5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-300 group">
      <div className="mb-4 p-3 rounded-lg bg-background w-fit group-hover:text-glow transition-all">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
