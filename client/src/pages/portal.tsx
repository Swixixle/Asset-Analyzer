import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Portal page - provides a stable entry point that redirects to the analyzer
 * This allows sharing a consistent /portal URL even if the analyzer route changes
 */
export default function Portal() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to the home page (analyzer entry point)
    setLocation("/", { replace: true });
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 text-sm text-muted-foreground animate-pulse">
        Redirecting to Debrief…
      </div>
    </div>
  );
}
