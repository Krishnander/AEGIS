import React from "react";
import { AlertCircle, ClipboardList, Stethoscope, ListChecks } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type AnalysisResult } from "@/hooks/use-agent";

export function ClinicalSummary({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-2 border-b border-border/40">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" />
            Clinical Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ClipboardList className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-xs">Awaiting analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recommendations = result.recommendations?.length
    ? result.recommendations
    : result.differential
        ?.map((d) => d.recommendation)
        .filter(Boolean) || [];

  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="pb-2 border-b border-border/40">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5" />
          Clinical Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[420px]">
          <div className="p-4 space-y-4">
            {/* Risk Badge */}
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold capitalize",
              result.severity === "high" ? "bg-red-500/10 text-clinical-critical border border-red-500/20" :
              result.severity === "medium" ? "bg-amber-500/10 text-clinical-warning border border-amber-500/20" :
              "bg-emerald-500/10 text-clinical-success border border-emerald-500/20"
            )}>
              <AlertCircle className="w-3.5 h-3.5" />
              {result.severity} Risk
            </div>

            {/* Narrative Summary */}
            {result.summary && (
              <div>
                <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-2">Overview</p>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  {result.summary}
                </p>
              </div>
            )}

            {/* Symptoms */}
            {result.symptoms?.length > 0 && (
              <div>
                <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Stethoscope className="w-3 h-3" />
                  Presenting Symptoms ({result.symptoms.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.symptoms.map((symptom, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations from differential */}
            {recommendations.length > 0 && (
              <div>
                <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-3 h-3" />
                  Recommendations ({recommendations.length})
                </p>
                <ul className="space-y-1.5">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-2 text-xs text-foreground/80">
                      <span className="text-muted-foreground font-mono mt-0.5">{idx + 1}.</span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Differential Diagnoses */}
            {result.differential && result.differential.length > 0 && (
              <div>
                <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-2">Differential Diagnoses</p>
                <div className="space-y-1.5">
                  {result.differential.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/30">
                      <span className="text-xs text-foreground/80">{d.condition}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {d.probability <= 1 ? Math.round(d.probability * 100) : Math.round(d.probability)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
