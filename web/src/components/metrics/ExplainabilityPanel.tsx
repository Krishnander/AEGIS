"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  GitBranch, 
  BarChart3, 
  Lightbulb,
  ArrowRight,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  type FeatureAttribution, 
  type ReasoningStep,
  type CounterfactualExplanation 
} from "@/lib/explainability";

interface ExplainabilityPanelProps {
  featureAttributions?: FeatureAttribution[];
  reasoningChain?: ReasoningStep[];
  counterfactuals?: CounterfactualExplanation[];
  globalExplanation?: string;
  clinicalRationale?: string;
  severity?: "low" | "medium" | "high";
  className?: string;
}

// Demo data
const DEMO_ATTRIBUTIONS: FeatureAttribution[] = [
  { feature: "chest pain", importance: 0.85, direction: "increases", confidence: 0.92, evidence: "Classic symptom of ACS" },
  { feature: "radiating pain", importance: 0.75, direction: "increases", confidence: 0.88, evidence: "Suggests cardiac origin" },
  { feature: "diaphoresis", importance: 0.70, direction: "increases", confidence: 0.85, evidence: "Autonomic response to ischemia" },
  { feature: "shortness of breath", importance: 0.65, direction: "increases", confidence: 0.82, evidence: "Pulmonary congestion indicator" },
  { feature: "nausea", importance: 0.40, direction: "increases", confidence: 0.75, evidence: "Vagal response" },
];

const DEMO_REASONING: ReasoningStep[] = [
  { id: "1", type: "observation", content: "Patient presents with: chest pain, shortness of breath, diaphoresis, radiating pain to left arm, nausea", supports: "neutral", confidence: 1.0 },
  { id: "2", type: "inference", content: "Critical findings identified: chest pain, radiating pain, diaphoresis. These are recognized red flags requiring urgent evaluation.", supports: "high", confidence: 0.9 },
  { id: "3", type: "evidence", content: "Supporting evidence retrieved from 3 clinical knowledge sources.", supports: "high", confidence: 0.85, citations: ["cardiac-001", "stemi-guidelines"] },
  { id: "4", type: "inference", content: "Symptom constellation suggests possible acute coronary syndrome. Differential includes STEMI, NSTEMI, aortic dissection, pulmonary embolism.", supports: "high", confidence: 0.88 },
  { id: "5", type: "warning", content: "Red flag symptoms present - immediate clinical evaluation required.", supports: "high", confidence: 0.95 },
  { id: "6", type: "conclusion", content: "HIGH priority triage. Immediate cardiac workup including ECG, cardiac enzymes, and possible cath lab activation recommended.", supports: "high", confidence: 0.92 },
];

const DEMO_COUNTERFACTUALS: CounterfactualExplanation[] = [
  {
    original: "Chest pain, shortness of breath, diaphoresis, radiating pain",
    counterfactual: "Shortness of breath, diaphoresis",
    changedFeatures: ["chest pain", "radiating pain"],
    originalPrediction: "high",
    counterfactualPrediction: "medium",
    explanation: "If the patient did NOT have chest pain and radiating pain, the triage priority would likely be MEDIUM. These symptoms are key drivers of the urgent classification.",
  },
];

export default function ExplainabilityPanel({
  featureAttributions = [],
  reasoningChain = [],
  counterfactuals = [],
  globalExplanation,
  clinicalRationale,
  severity = "high",
  className,
}: ExplainabilityPanelProps) {
  const [activeTab, setActiveTab] = useState("features");

  const getStepIcon = (type: ReasoningStep["type"]) => {
    switch (type) {
      case "observation": return Info;
      case "inference": return Brain;
      case "evidence": return BookOpen;
      case "warning": return AlertTriangle;
      case "conclusion": return CheckCircle;
      default: return ChevronRight;
    }
  };

  const getStepColor = (type: ReasoningStep["type"]) => {
    switch (type) {
      case "observation": return "text-muted-foreground";
      case "inference": return "text-clinical-info";
      case "evidence": return "text-foreground";
      case "warning": return "text-clinical-warning";
      case "conclusion": return "text-clinical-success";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card className={cn("bg-card border-border/60", className)}>
      <CardHeader className="pb-2 border-b border-border/40">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" />
            Clinical Reasoning
          </span>
          <Badge variant="outline" className="text-2xs font-mono">AI</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Global Explanation */}
        <div className="p-2.5 rounded bg-muted/40 border border-border/30">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-clinical-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">Why this classification?</p>
              <p className="text-2xs text-muted-foreground">{globalExplanation || "Analyzing input to determine key factors..."}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 bg-muted/30 h-7">
            <TabsTrigger value="features" className="text-2xs h-6">
              <BarChart3 className="w-3 h-3 mr-1" />
              Features
            </TabsTrigger>
            <TabsTrigger value="reasoning" className="text-2xs h-6">
              <GitBranch className="w-3 h-3 mr-1" />
              Reasoning
            </TabsTrigger>
            <TabsTrigger value="counterfactual" className="text-2xs h-6">
              <Lightbulb className="w-3 h-3 mr-1" />
              What-If
            </TabsTrigger>
          </TabsList>

          {/* Feature Attributions Tab */}
          <TabsContent value="features" className="space-y-2 mt-3">
            <p className="text-2xs text-muted-foreground">
              Feature importance — how each symptom contributed:
            </p>
            {featureAttributions.length === 0 ? (
              <p className="text-2xs text-muted-foreground italic py-4 text-center">No feature data available</p>
            ) : (
            <div className="space-y-1.5">
              {featureAttributions.map((attr, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-between text-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground capitalize">{attr.feature}</span>
                      <span className={cn(
                        "font-mono",
                        attr.direction === "increases" ? "text-clinical-critical" : attr.direction === "decreases" ? "text-clinical-success" : "text-muted-foreground"
                      )}>
                        {attr.direction === "increases" ? "\u2191" : attr.direction === "decreases" ? "\u2193" : "\u2212"}
                      </span>
                    </div>
                    <span className={cn(
                      "font-mono",
                      attr.importance > 0 ? "text-clinical-critical" : "text-clinical-success"
                    )}>
                      {attr.importance > 0 ? "+" : ""}{(attr.importance * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          attr.importance > 0 ? "bg-clinical-critical/70" : "bg-clinical-success/70"
                        )}
                        style={{ width: `${Math.abs(attr.importance) * 100}%` }}
                      />
                    </div>
                    <span className="text-2xs text-muted-foreground font-mono w-10 text-right">
                      {(attr.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </TabsContent>

          {/* Reasoning Chain Tab */}
          <TabsContent value="reasoning" className="space-y-2 mt-3">
            <p className="text-2xs text-muted-foreground">
              Step-by-step reasoning trace:
            </p>
            {reasoningChain.length === 0 ? (
              <p className="text-2xs text-muted-foreground italic py-4 text-center">No reasoning data available</p>
            ) : (
            <div className="relative">
              <div className="absolute left-[9px] top-3 bottom-3 w-px bg-border/60" />
              <div className="space-y-2">
                {reasoningChain.map((step) => {
                  const Icon = getStepIcon(step.type);
                  const color = getStepColor(step.type);
                  return (
                    <div key={step.id} className="relative flex gap-2">
                      <div className={cn(
                        "relative z-10 p-1 rounded-full bg-background border",
                        step.type === "warning" ? "border-clinical-warning/50" :
                        step.type === "conclusion" ? "border-clinical-success/50" :
                        "border-border/60"
                      )}>
                        <Icon className={cn("w-2.5 h-2.5", color)} />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">{step.type}</span>
                          <span className="text-2xs text-muted-foreground font-mono">{(step.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-2xs text-foreground leading-relaxed">{step.content}</p>
                        {step.citations && step.citations.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <BookOpen className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className="text-2xs font-mono text-muted-foreground">{step.citations.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </TabsContent>

          {/* Counterfactual Tab */}
          <TabsContent value="counterfactual" className="space-y-2 mt-3">
            <p className="text-2xs text-muted-foreground">
              How different symptoms would change the classification:
            </p>
            {counterfactuals.length === 0 ? (
              <p className="text-2xs text-muted-foreground italic py-4 text-center">No counterfactual data available</p>
            ) : (
            <>
            {counterfactuals.map((cf, idx) => (
              <div key={idx} className="p-2.5 rounded bg-muted/30 border border-border/30 space-y-2">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                  <div className="p-1.5 rounded bg-background border border-border/40">
                    <Badge variant="outline" className={cn(
                      "mb-1 text-2xs",
                      cf.originalPrediction === "high" ? "border-clinical-critical/40 text-clinical-critical" :
                      cf.originalPrediction === "medium" ? "border-clinical-warning/40 text-clinical-warning" :
                      "border-clinical-success/40 text-clinical-success"
                    )}>
                      {cf.originalPrediction.toUpperCase()}
                    </Badge>
                    <p className="text-2xs text-muted-foreground">Original</p>
                    <p className="text-2xs text-foreground">{cf.original}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <div className="p-1.5 rounded bg-background border border-border/40">
                    <Badge variant="outline" className={cn(
                      "mb-1 text-2xs",
                      cf.counterfactualPrediction === "high" ? "border-clinical-critical/40 text-clinical-critical" :
                      cf.counterfactualPrediction === "medium" ? "border-clinical-warning/40 text-clinical-warning" :
                      "border-clinical-success/40 text-clinical-success"
                    )}>
                      {cf.counterfactualPrediction.toUpperCase()}
                    </Badge>
                    <p className="text-2xs text-muted-foreground">If changed</p>
                    <p className="text-2xs text-foreground">{cf.counterfactual}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-2xs text-muted-foreground">Removed:</span>
                  {cf.changedFeatures.map((f, fidx) => (
                    <span key={fidx} className="text-2xs font-mono text-clinical-critical">&minus; {f}</span>
                  ))}
                </div>
                <p className="text-2xs text-muted-foreground italic">{cf.explanation}</p>
              </div>
            ))}
            </>
            )}
          </TabsContent>
        </Tabs>

        {/* Clinical Rationale Footer */}
        {clinicalRationale && (
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn(
              "w-3 h-3 mt-0.5 flex-shrink-0",
              severity === "high" ? "text-clinical-critical" :
              severity === "medium" ? "text-clinical-warning" : "text-clinical-success"
            )} />
            <p className="text-2xs text-muted-foreground leading-relaxed">{clinicalRationale}</p>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
