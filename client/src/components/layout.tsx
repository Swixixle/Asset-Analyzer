import { Link, useLocation } from "wouter";
import { Terminal, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    document.title = "Debrief";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 group-hover:bg-primary/20 transition-all duration-300 group-hover:shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-none tracking-tight">Debrief</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Evidence-backed briefs</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 md:gap-2">
            <NavLink href="/" active={location === "/"}>
              New debrief
            </NavLink>
            <NavLink href="/projects" active={location.startsWith("/projects")}>
              Archives
            </NavLink>
            <NavLink href="/ci" active={location.startsWith("/ci")}>
              CI Feed
            </NavLink>
            <div className="w-px h-6 bg-border mx-2" />
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none -z-10 h-[600px]" />
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p className="font-mono">
            <span className="text-primary">SYSTEM:</span> ONLINE
          </p>
          <p>© 2025 Debrief. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        active 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
    >
      {children}
    </Link>
  );
}
