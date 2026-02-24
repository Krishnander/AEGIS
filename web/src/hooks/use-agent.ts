// Clinical analysis state management hook.

import { useState, useCallback, useEffect } from "react";
import { initEdgeAI, subscribeToLoadProgress, type ModelLoadState } from "@/lib/mediapipe";
import { isDemoMode } from "@/lib/api";
import { orchestrateAnalysis } from "@/lib/orchestrator";
import { scrubPII } from "@/lib/safety-enhanced";
import { saveCase, getRecentCases, type Case, type GraphNode } from "@/lib/db";
import { Telemetry } from "@/lib/telemetry";

export type AnalysisStatus = "idle" | "loading" | "initializing" | "streaming" | "complete" | "error";

export interface DemoCase {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  symptoms: string[];
  severity: "low" | "medium" | "high";
  summary: string;
  differential: Array<{
    condition: string;
    probability: number;
    recommendation: string;
  }>;
  graph_data: {
    nodes: Array<{
      id: string;
      label: string;
      type: "patient" | "symptom" | "history" | "risk" | "diagnosis";
      severity?: "low" | "medium" | "high";
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
}

export interface AnalysisResult {
  symptoms: string[];
  severity: "low" | "medium" | "high";
  summary: string;
  fullResponse: string;
  source: "edge" | "cloud" | "demo";
  citations?: Array<{
    id: string;
    source: string;
    snippet: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  reasoningTrace?: string[];
  safety?: {
    unsafe: boolean;
    reasons: string[];
    piiRedacted: boolean;
    validatorFindings: string[];
  };
  enhancedSafety?: {
    isUnsafe: boolean;
    drugInteractions: Array<{
      drug1: string;
      drug2: string;
      severity: "contraindicated" | "major" | "moderate" | "minor";
      recommendation: string;
    }>;
    pharmacogenomicAlerts: Array<{
      drug: string;
      gene: string;
      severity: "HIGH" | "MODERATE" | "LOW";
      recommendation: string;
      alternativeDrugs?: string[];
    }>;
    safetyScore: number;
    safetyLevel: "safe" | "caution" | "warning" | "critical";
  };
  confidence?: {
    raw: number;
    calibrated: number;
    uncertainty: number;
    reliability: "high" | "medium" | "low";
    description: string;
  };
  explainability?: {
    featureAttributions: Array<{
      feature: string;
      importance: number;
      direction: "increases" | "decreases" | "neutral";
      confidence: number;
      evidence?: string;
    }>;
    reasoningChain: Array<{
      id: string;
      type: "observation" | "inference" | "evidence" | "conclusion" | "warning";
      content: string;
      supports: "low" | "medium" | "high" | "neutral";
      confidence: number;
      citations?: string[];
    }>;
    counterfactuals: Array<{
      original: string;
      counterfactual: string;
      changedFeatures: string[];
      originalPrediction: "low" | "medium" | "high";
      counterfactualPrediction: "low" | "medium" | "high";
      explanation: string;
    }>;
    keyFactors: string[];
    globalExplanation: string;
    clinicalRationale: string;
  };
  latency?: {
    retrievalMs: number;
    generationMs: number;
    totalMs: number;
  };
  differential?: Array<{
    condition: string;
    probability: number;
    recommendation: string;
  }>;
  recommendations?: string[];
  inferenceTime?: number;
  tokensGenerated?: number;
  demoCaseId?: string;
}

export interface ModelStatus {
  loadState: ModelLoadState;
  recommendations: string[];
}

export function useAgent() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);

  // Load recent cases on mount
  useEffect(() => {
    loadRecentCases();

    // Eagerly preload the edge model so first inference is fast
    initEdgeAI().catch(() => {});

    // Subscribe to model loading progress
    const unsubscribe = subscribeToLoadProgress((loadState) => {
      setModelStatus(prev => ({
        ...(prev || {}),
        loadState,
        recommendations: prev?.recommendations || [],
      }));
      
      // Update status based on load state (functional updates avoid stale closure)
      if (loadState.status === "loading") {
        setStatus("initializing");
      } else if (loadState.status === "ready") {
        setStatus(prev => prev === "initializing" ? "idle" : prev);
      } else if (loadState.status === "error") {
        setError("Failed to load AI model. Please refresh the page.");
        setStatus(prev => prev === "initializing" ? "error" : prev);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load recent cases
  const loadRecentCases = useCallback(async () => {
    try {
      const cases = await getRecentCases(10);
      setRecentCases(cases);
    } catch (err) {
    }
  }, []);

  const analyze = useCallback(async (symptoms: string, demoCaseId?: string): Promise<AnalysisResult | null> => {
    setStatus("loading");
    setError(null);
    setResult(null);
    
    const analysisSpan = Telemetry.startSpan("useAgent.analyze", { demoCaseId });

    try {
      // Check for demo mode - either by trigger word or explicit case ID
      if (demoCaseId || isDemoMode(symptoms)) {
        const demoSpan = Telemetry.startSpan("demoDataLoad");
        const demoData = await loadDemoData(demoCaseId);
        demoSpan.end({ caseId: demoData.id });

        const demoResult: AnalysisResult = {
          ...demoData,
          fullResponse: JSON.stringify(demoData),
          source: "demo",
          demoCaseId: demoData.id,
        };
        setResult(demoResult);
        setStatus("complete");
        
        await saveCase({
          symptoms,
          severity: demoResult.severity,
          summary: demoResult.summary,
          analysis: JSON.stringify(demoResult),
          graphData: generateGraphData(demoData.graph_data),
          timestamp: new Date(),
          source: "demo",
        });
        
        await loadRecentCases();
        analysisSpan.end({ source: "demo", severity: demoResult.severity });
        return demoResult;
      }

      const cleaned = scrubPII(symptoms);
      const orchestrated = await orchestrateAnalysis(cleaned);

      const analysisResult: AnalysisResult = {
        symptoms: orchestrated.symptoms,
        severity: orchestrated.severity,
        summary: orchestrated.summary,
        fullResponse: orchestrated.fullResponse,
        source: orchestrated.source,
        citations: orchestrated.citations,
        reasoningTrace: orchestrated.reasoningTrace,
        safety: orchestrated.safety,
        enhancedSafety: orchestrated.enhancedSafety,
        confidence: orchestrated.confidence,
        explainability: orchestrated.explainability,
        recommendations: orchestrated.recommendations,
        latency: orchestrated.latency,
      };

      setResult(analysisResult);
      setStatus("complete");

      await saveCase({
        ...analysisResult,
        symptoms,
        analysis: orchestrated.fullResponse,
        graphData: generateGraphDataFromParsed(analysisResult),
        timestamp: new Date(),
        source: analysisResult.source,
      });

      await loadRecentCases();
      analysisSpan.end({
        source: analysisResult.source,
        severity: analysisResult.severity,
        latencyMs: orchestrated.latency?.totalMs,
      });
      return analysisResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      Telemetry.captureError(err, { component: "useAgent", action: "analyze" });
      analysisSpan.end({ error: true, errorMessage });
      setError(errorMessage);
      setStatus("error");
      return null;
    }
  }, [loadRecentCases]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  const initializeModel = useCallback(async () => {
    const span = Telemetry.startSpan("initializeModel");
    try {
      setStatus("initializing");
      await initEdgeAI({ forceReload: true });
      setStatus("idle");
      span.end({ success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize model";
      Telemetry.captureError(err, { component: "useAgent", action: "initializeModel" });
      span.end({ error: true, errorMessage });
      setError(errorMessage);
      setStatus("error");
    }
  }, []);

  return {
    status,
    result,
    error,
    modelStatus,
    recentCases,
    analyze,
    reset,
    initializeModel,
    refreshCases: loadRecentCases,
  };
}

function generateGraphDataFromParsed(parsed: { symptoms: string[]; severity: "low" | "medium" | "high"; }): GraphNode[] {
  const nodes: GraphNode[] = [
    {
      id: "patient",
      label: "Patient",
      type: "patient",
    },
  ];

  const edges: Array<{ id: string; source: string; target: string; label?: string }> = [];

  // Add symptom nodes
  parsed.symptoms.forEach((symptom, index) => {
    nodes.push({
      id: `symptom-${index}`,
      label: symptom,
      type: "symptom" as const,
    });
    edges.push({
      id: `e-patient-symptom-${index}`,
      source: "patient",
      target: `symptom-${index}`,
    });
  });

  // Add risk node based on severity
  const riskLabel =
    parsed.severity === "high"
      ? "High Risk"
      : parsed.severity === "medium"
        ? "Medium Risk"
        : "Low Risk";

  nodes.push({
    id: "risk",
    label: riskLabel,
    type: "risk" as const,
    severity: parsed.severity,
  });

  // Connect all symptoms to risk
  parsed.symptoms.forEach((_, index) => {
    edges.push({
      id: `e-symptom-risk-${index}`,
      source: `symptom-${index}`,
      target: "risk",
      label: "Contributes to",
    });
  });

  return nodes;
}

async function loadDemoData(caseId?: string): Promise<DemoCase> {
  try {
    const response = await fetch("/demo_data.json");
    const data = await response.json();
    
    // If specific case ID provided, find it
    if (caseId && data.cases) {
      const specificCase = data.cases.find((c: DemoCase) => c.id === caseId);
      if (specificCase) {
        return specificCase;
      }
    }
    
    // Otherwise return the first case (or random one for variety)
    if (data.cases && data.cases.length > 0) {
      // Return a random case for demo variety
      const randomIndex = Math.floor(Math.random() * data.cases.length);
      return data.cases[randomIndex];
    }
    
    // Fallback to old format
    return {
      id: "fallback",
      name: "Fallback Case",
      category: "cardiac",
      difficulty: "high",
      symptoms: data.symptoms || [],
      severity: data.severity || "medium",
      summary: data.summary || "",
      differential: data.differential || [],
      graph_data: data.graph_data || { nodes: [], edges: [] },
    };
  } catch {
    // Fallback demo data
    return {
      id: "emergency-fallback",
      name: "Emergency Cardiac",
      category: "cardiac",
      difficulty: "high",
      symptoms: ["Chest Pain", "Shortness of Breath", "Sweating"],
      severity: "high",
      summary:
        "Patient presents with classic cardiac symptoms. High suspicion for acute coronary syndrome. Immediate cardiac workup recommended.",
      differential: [
        {
          condition: "Myocardial Infarction",
          probability: 75,
          recommendation: "Immediate ECG, cardiac enzymes, consider cath lab",
        },
        {
          condition: "Unstable Angina",
          probability: 15,
          recommendation: "Risk stratification, antiplatelet therapy",
        },
        {
          condition: "Aortic Dissection",
          probability: 10,
          recommendation: "CT angiogram, blood pressure control",
        },
      ],
      graph_data: {
        nodes: [
          { id: "patient", label: "Patient", type: "patient" },
          { id: "symptom1", label: "Chest Pain", type: "symptom" },
          { id: "symptom2", label: "Shortness of Breath", type: "symptom" },
          { id: "symptom3", label: "Sweating", type: "symptom" },
          { id: "risk1", label: "High Risk: Cardiac", type: "risk", severity: "high" },
        ],
        edges: [
          { id: "e1-2", source: "patient", target: "symptom1" },
          { id: "e1-3", source: "patient", target: "symptom2" },
          { id: "e1-4", source: "patient", target: "symptom3" },
          { id: "e2-5", source: "symptom1", "target": "risk1", label: "Indicates" },
          { id: "e3-5", source: "symptom2", "target": "risk1", label: "Supports" },
          { id: "e4-5", source: "symptom3", "target": "risk1", label: "Classic for" },
        ],
      },
    };
  }
}

function generateGraphData(graphData: DemoCase["graph_data"]): GraphNode[] {
  if (!graphData || !graphData.nodes) {
    return [];
  }

  return graphData.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type as "patient" | "symptom" | "history" | "risk" | "diagnosis",
    severity: node.severity,
  }));
}

// Export demo case loading for external use
export async function getDemoCases(): Promise<DemoCase[]> {
  try {
    const response = await fetch("/demo_data.json");
    const data = await response.json();
    return data.cases || [];
  } catch {
    return [];
  }
}
