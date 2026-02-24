import React from "react";
import { Shield } from "lucide-react";

export function InitialLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-xs mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-card rounded-lg border border-border/60 mb-5">
          <Shield className="w-6 h-6 text-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground tracking-tight mb-0.5">AEGIS</h1>
        <p className="text-muted-foreground text-2xs uppercase tracking-wider mb-5">Clinical Triage AI</p>
        <div className="w-32 mx-auto h-0.5 bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-foreground/40 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
