import React from "react";
import dynamic from "next/dynamic";
import { GitBranch, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent, type AnalysisResult } from "@/hooks/use-agent";
import { ClinicalSummary } from "./ClinicalSummary";
import ExplainabilityPanel from "@/components/metrics/ExplainabilityPanel";

const ChatInterface = dynamic(
  () => import("@/components/chat/ChatInterface"),
  { ssr: false }
);

const CausalMap = dynamic(
  () => import("@/components/graph/CausalMap"),
  { ssr: false }
);

function getCausalMapData(result: AnalysisResult | null) {
  if (!result) return undefined;
  return {
    nodes: [
      { id: "patient", label: "Patient", type: "patient" as const },
      ...result.symptoms?.map((s: string, i: number) => ({
        id: `symptom-${i}`,
        label: s,
        type: "symptom" as const,
      })) || [],
      {
        id: "risk",
        label: result.severity === "high" ? "High Risk" : result.severity === "medium" ? "Medium Risk" : "Low Risk",
        type: "risk" as const,
        severity: result.severity,
      },
    ],
    edges: [
      ...result.symptoms?.map((_: string, i: number) => ({
        id: `e-patient-${i}`,
        source: "patient",
        target: `symptom-${i}`,
      })) || [],
      ...result.symptoms?.map((_: string, i: number) => ({
        id: `e-${i}-risk`,
        source: `symptom-${i}`,
        target: "risk",
        label: "Contributes",
      })) || [],
    ],
  };
}

export function DashboardContent() {
  const { result, status, analyze, reset, error } = useAgent();

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top Bar ─── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 h-12">
          {/* Left: Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded bg-primary/10 border border-primary/20">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">AEGIS</span>
              <span className="text-2xs text-muted-foreground font-medium hidden sm:inline">Clinical Triage AI</span>
            </div>
          </div>


        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-12 gap-4">

          {/* ─── Left Column: Chat (spans 5 cols) ─── */}
          <div className="col-span-12 xl:col-span-5">
            <div className="sticky top-16">
              <Card className="bg-card border-border/60 h-[calc(100vh-5.5rem)] flex flex-col overflow-hidden">
                <ChatInterface status={status} error={error} analyze={analyze} reset={reset} />
              </Card>
            </div>
          </div>

          {/* ─── Right Column: Clinical Intelligence (spans 7 cols) ─── */}
          <div className="col-span-12 xl:col-span-7 space-y-4">

            {/* Clinical Summary */}
            <ClinicalSummary result={result} />

            {/* Row 3: Causal Graph */}
            <Card className="bg-card border-border/60">
              <CardHeader className="pb-2 border-b border-border/40">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5" />
                  Causal Reasoning Graph
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {result ? (
                  <CausalMap data={getCausalMapData(result)} className="h-[300px]" />
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-muted-foreground text-xs">
                    Submit symptoms to generate the causal reasoning graph
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Row 5: Advanced Analysis Panels */}
            {result && (
              <ExplainabilityPanel
                featureAttributions={result.explainability?.featureAttributions}
                reasoningChain={result.explainability?.reasoningChain}
                counterfactuals={result.explainability?.counterfactuals}
                globalExplanation={result.explainability?.globalExplanation}
                clinicalRationale={result.explainability?.clinicalRationale}
                severity={result.severity}
              />
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <footer className="mt-6 pb-4 text-center">
          <p className="text-2xs text-muted-foreground/60">
            AEGIS · Powered by Google MedGemma · For research purposes only · Not for clinical use
          </p>
        </footer>
      </main>
    </div>
  );
}
