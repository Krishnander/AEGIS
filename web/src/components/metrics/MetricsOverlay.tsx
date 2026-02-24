"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricsOverlayProps {
  totalMs?: number;
  retrievalMs?: number;
  generationMs?: number;
  citations?: number;
  source?: "edge" | "cloud" | "demo";
}

export default function MetricsOverlay({ totalMs, retrievalMs, generationMs, citations, source }: MetricsOverlayProps) {
  if (!totalMs && !generationMs && !retrievalMs) return null;

  return (
    <Card className="bg-card border-border/60">
      <CardContent className="p-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">Metrics</span>
          <div className="flex-1 h-px bg-border/40" />
          {source && (
            <span className={cn(
              "text-2xs font-mono uppercase px-1.5 py-0.5 rounded",
              source === "edge" && "bg-emerald-500/8 text-emerald-400",
              source === "cloud" && "bg-primary/8 text-primary",
              source === "demo" && "bg-purple-500/8 text-purple-400"
            )}>
              {source === "demo" ? "scenario" : source}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3 mt-2">
          <div>
            <p className="text-2xs text-muted-foreground">Total</p>
            <p className="text-sm font-mono font-medium text-foreground">{totalMs ? `${totalMs}ms` : "--"}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">Retrieval</p>
            <p className="text-sm font-mono font-medium text-foreground">{retrievalMs ? `${retrievalMs}ms` : "--"}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">Generation</p>
            <p className="text-sm font-mono font-medium text-foreground">{generationMs ? `${generationMs}ms` : "--"}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">Citations</p>
            <p className="text-sm font-mono font-medium text-foreground">{citations ?? "--"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
