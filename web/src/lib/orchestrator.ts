// Analysis pipeline: retrieval, multi-candidate generation, ranking, calibration, and safety.

import { hybridRetrieve, summarizeCitations, type HybridRetrievalResult, type Citation } from "@/lib/retrieval";
import { runEdgeInference } from "@/lib/mediapipe";
import { analyzeCaseCloud } from "@/lib/api";
import { analyzeMedGemma } from "@/lib/medgemma";
import { parseAIResponse, extractSymptomsFromText, isHighSeverityAllowed } from "@/lib/utils";
import {
  detectUnsafeIntent,
  scrubPII,
  validateClinicalOutput,
  performEnhancedSafetyAssessment,
  type SafetyAssessment,
  type EnhancedSafetyAssessment,
} from "@/lib/safety-enhanced";
import { Telemetry } from "@/lib/telemetry";
import { calculateConfidence, type ConfidenceScore } from "@/lib/confidence";
import { generateExplanation, type ExplainabilityResult } from "@/lib/explainability";

export interface GenerationCandidate {
  id: string;
  raw: string;
  parsed: {
    symptoms: string[];
    severity: "low" | "medium" | "high";
    summary: string;
    recommendations: string[];
  };
  latencyMs: number;
  confidence?: ConfidenceScore;
}

export interface OrchestratorResult {
  summary: string;
  severity: "low" | "medium" | "high";
  symptoms: string[];
  recommendations: string[];
  fullResponse: string;
  source: "edge" | "cloud";
  citations: Citation[];
  reasoningTrace: string[];
  safety: SafetyAssessment;
  enhancedSafety?: EnhancedSafetyAssessment;
  confidence?: ConfidenceScore;
  explainability?: ExplainabilityResult;
  latency: {
    retrievalMs: number;
    generationMs: number;
    totalMs: number;
  };
}

const SYSTEM_INSTRUCTION = `You are AEGIS, a clinical triage AI. Analyze symptoms and respond with ONLY valid JSON.

Example for "headache and fever for 3 days":
{"symptoms":["headache","fever"],"severity":"low","summary":"Likely viral illness. Monitor temperature.","recommendations":["Monitor temperature","Stay hydrated","Seek care if worsening"],"confidence":0.7}

Be cautious. Focus on triage. Express calibrated uncertainty.`;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// Response cache — returns instant results for identical queries
const responseCache = new Map<string, OrchestratorResult>();
function normalizeQueryKey(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function generateDefaultRecommendations(severity: "low" | "medium" | "high", symptoms: string[]): string[] {
  if (severity === "high") {
    return [
      "Seek immediate emergency medical care",
      "Call emergency services (911) if symptoms worsen",
      "Do not drive — have someone take you or call an ambulance",
    ];
  }
  if (severity === "medium") {
    return [
      "Schedule urgent medical evaluation within 24 hours",
      "Monitor symptoms carefully for any worsening",
      "Seek emergency care if condition deteriorates rapidly",
    ];
  }
  return [
    "Monitor symptoms and rest",
    "Schedule non-urgent medical appointment if symptoms persist",
    "Stay hydrated and maintain regular activity as tolerated",
  ];
}

export function buildAugmentedPrompt(query: string, retrieval: HybridRetrievalResult, variation: number): string {
  // Limit context to top 3 citations and truncate snippets for edge model token budget
  const topCitations = retrieval.citations.slice(0, 3);
  const context = topCitations.length
    ? topCitations.map(c => `[${c.id}]: ${c.snippet.slice(0, 200)}`).join("\n")
    : "";

  const contextBlock = context ? `\nRelevant context:\n${context}\n` : "";

  return `${SYSTEM_INSTRUCTION}
${contextBlock}
Now analyze this patient: "${query}"
Respond with ONLY a JSON object, no other text:`;
}

async function generateCandidates(prompt: string, count = 3): Promise<GenerationCandidate[]> {
  const attempts: GenerationCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const start = now();
    const result = await runEdgeInference(prompt, { enableStreaming: false });
    const latency = now() - start;
    attempts.push({
      id: `edge-${i}`,
      raw: result.response,
      parsed: parseAIResponse(result.response),
      latencyMs: latency,
    });
  }
  return attempts;
}

function scoreCandidate(c: GenerationCandidate, query: string, citations: Citation[]): number {
  const querySymptoms = new Set(extractSymptomsFromText(query).map((s) => s.toLowerCase()));
  const overlap = c.parsed.symptoms.filter((s) => querySymptoms.has(s.toLowerCase())).length;
  const severityScore = c.parsed.severity === "high" ? 1 : c.parsed.severity === "medium" ? 0.6 : 0.3;
  const citationBoost = citations.length ? 0.2 : 0;
  return overlap * 1.5 + severityScore + citationBoost;
}

async function fallbackMedGemma(query: string, prompt: string): Promise<GenerationCandidate> {
  const start = now();
  const result = await analyzeMedGemma(query, prompt);
  const latency = now() - start;
  const parsed = parseAIResponse(result.response);
  return {
    id: "medgemma-cloud",
    raw: result.response,
    parsed,
    latencyMs: latency,
  };
}

async function fallbackCloud(query: string, retrieval: HybridRetrievalResult): Promise<GenerationCandidate> {
  const start = now();
  const cloud = await analyzeCaseCloud(query);
  const latency = now() - start;
  return {
    id: "cloud",
    raw: JSON.stringify(cloud),
    parsed: {
      symptoms: [query],
      severity: "medium",
      summary: cloud.final_output,
      recommendations: [],
    },
    latencyMs: latency,
  };
}

export async function orchestrateAnalysis(query: string): Promise<OrchestratorResult> {
  // Cache hit — instant response for repeated queries
  const cacheKey = normalizeQueryKey(query);
  const cached = responseCache.get(cacheKey);
  if (cached) return { ...cached };

  const orchestratorSpan = Telemetry.startSpan("orchestrateAnalysis");

  const cleanQuery = scrubPII(query);

  // Track retrieval phase
  const retrievalSpan = Telemetry.startSpan("retrieval");
  const retrieval = await hybridRetrieve(cleanQuery, 5);
  const retrievalMs = retrievalSpan.end({ citationCount: retrieval.citations.length });

  const unsafe = detectUnsafeIntent(cleanQuery);
  unsafe.piiRedacted = cleanQuery !== query;
  const prompt = buildAugmentedPrompt(cleanQuery, retrieval, 0);

  let candidates: GenerationCandidate[] = [];
  const generationSpan = Telemetry.startSpan("generation");

  // Primary: MedGemma cloud — Google HAI-DEF competition model (Kaggle T4 GPU via ngrok, or HF fallback)
  try {
    const medgemmaCandidate = await fallbackMedGemma(cleanQuery, prompt);
    candidates = [medgemmaCandidate];
    generationSpan.end({ candidateCount: 1, source: "medgemma" });
  } catch (medgemmaErr) {
    Telemetry.captureError(medgemmaErr, { component: "orchestrator", phase: "medgemma" });
    // Fallback: edge inference — Gemma 3 1B in-browser via MediaPipe (works fully offline)
    try {
      candidates = await generateCandidates(prompt, 1);
      generationSpan.end({ candidateCount: 1, source: "edge" });
    } catch (edgeErr) {
      generationSpan.end({ error: true });
      Telemetry.captureError(edgeErr, { component: "orchestrator", phase: "edge" });
      throw new Error("All inference backends unavailable. Ensure the Kaggle notebook is running.");
    }
  }

  // Rerank candidates
  const scored = candidates
    .map((c) => ({ c, score: scoreCandidate(c, cleanQuery, retrieval.citations) }))
    .sort((a, b) => b.score - a.score);

  let best = scored[0].c;
  const highAllowed = isHighSeverityAllowed(best.parsed.symptoms, best.parsed.summary, best.raw);
  if (best.parsed.severity === "high" && !highAllowed) {
    const downgraded = scored.find((s) => s.c.parsed.severity !== "high");
    if (downgraded) {
      best = downgraded.c;
    }
  }
  const safetyAssessment = validateClinicalOutput(best.raw, unsafe);

  // Ensure symptoms are populated — 1B models often return empty symptoms arrays
  let symptoms = best.parsed.symptoms;
  if (symptoms.length === 0) {
    symptoms = extractSymptomsFromText(cleanQuery);
  }

  // Ensure recommendations are populated
  let recommendations = best.parsed.recommendations || [];
  if (recommendations.length === 0) {
    recommendations = generateDefaultRecommendations(best.parsed.severity, symptoms);
  }

  // SOTA: Enhanced safety assessment with drug interactions, PGx, contraindications
  const enhancedSafety = performEnhancedSafetyAssessment(best.raw);

  // SOTA: Calculate calibrated confidence score
  const rawConfidence = (best.parsed as { confidence?: number }).confidence || 0.75;
  const confidenceLogit = Math.log(rawConfidence / (1 - rawConfidence + 0.01));
  const confidenceScore = calculateConfidence(confidenceLogit, best.parsed.severity);

  // SOTA: Generate explainability result
  const explainability = generateExplanation(
    cleanQuery,
    symptoms,
    best.parsed.severity,
    best.parsed.summary,
    retrieval.citations
  );

  const reasoningTrace = Array.isArray((best.parsed as { reasoning?: string[] }).reasoning)
    ? ((best.parsed as { reasoning?: string[] }).reasoning as string[])
    : explainability.reasoningChain.map(step => step.content);

  const totalMs = orchestratorSpan.end({
    source: best.id.startsWith("cloud") || best.id.startsWith("medgemma") ? "cloud" : "edge",
    severity: best.parsed.severity,
    confidence: confidenceScore.calibrated,
    safetyScore: enhancedSafety.safetyScore,
  });

  const result: OrchestratorResult = {
    summary: best.parsed.summary,
    severity: best.parsed.severity,
    symptoms,
    recommendations,
    fullResponse: best.raw,
    source: best.id.startsWith("cloud") || best.id.startsWith("medgemma") ? "cloud" : "edge",
    citations: retrieval.citations,
    reasoningTrace,
    safety: safetyAssessment,
    enhancedSafety,
    confidence: confidenceScore,
    explainability,
    latency: {
      retrievalMs: Math.round(retrievalMs),
      generationMs: Math.round(best.latencyMs),
      totalMs: Math.round(totalMs),
    },
  };

  // Store in cache for instant repeated queries
  responseCache.set(cacheKey, result);
  return result;
}
