// Hybrid orchestrator: edge-first inference with cloud fallback and candidate ranking.

import { runEdgeInference } from "./mediapipe";
import { analyzeCaseCloud, CaseAnalysis } from "./api";
import { hasRedFlags, hasOnlyMinorSymptoms, countRedFlags } from "./calibration";

/**
 * Severity levels for triage
 */
export type SeverityLevel = "low" | "medium" | "high";

/**
 * Source of the analysis result
 */
export type AnalysisSource = "edge" | "cloud";

/**
 * Differential diagnosis entry
 */
export interface DifferentialEntry {
  condition: string;
  probability: number;
  recommendation: string;
}

/**
 * Unified hybrid analysis result
 */
export interface HybridAnalysisResult {
  // Core analysis fields (from CaseAnalysis)
  symptoms: string[];
  severity: SeverityLevel;
  summary: string;
  differential: DifferentialEntry[];
  recommendations: string[];
  reasoning: string;

  // Full raw response for debugging
  fullResponse: string;

  // Metadata about the analysis
  source: AnalysisSource;
  confidence: number;
  wasCalibrated: boolean;
  fallbackReason?: string;

  // Performance metrics
  inferenceTime: number;
  tokensGenerated?: number;
  edgeLatency?: number;
  cloudLatency?: number;
}

/**
 * Edge inference result parsed from response
 */
interface ParsedEdgeResult {
  severity: SeverityLevel;
  summary: string;
  symptoms: string[];
  differential: DifferentialEntry[];
  recommendations: string[];
  reasoning: string;
  confidence?: number;
}

/**
 * Calculate confidence score for edge inference result.
 *
 * Confidence logic:
 * - HIGH severity with red flags = high confidence (0.85-0.95)
 * - LOW severity with minor symptoms = high confidence (0.80-0.90)
 * - MEDIUM severity = low confidence (0.40-0.60) - triggers fallback
 * - HIGH severity without red flags = medium confidence (0.60-0.70)
 * - Calibration applied = slight confidence boost for correction
 */
export function calculateConfidenceScore(
  severity: SeverityLevel,
  symptoms: string[],
  summary: string,
  wasCalibrated: boolean
): number {
  const redFlagCount = countRedFlags(symptoms, summary);
  const hasMinorOnly = hasOnlyMinorSymptoms(symptoms, summary);

  let baseConfidence: number;

  switch (severity) {
    case "high":
      // High severity needs red flags for high confidence
      if (redFlagCount >= 2) {
        baseConfidence = 0.92;
      } else if (redFlagCount === 1) {
        baseConfidence = 0.85;
      } else {
        // High severity without red flags is suspicious
        baseConfidence = 0.65;
      }
      break;

    case "low":
      // Low severity needs minor symptoms only for high confidence
      if (hasMinorOnly) {
        baseConfidence = 0.88;
      } else if (redFlagCount === 0) {
        baseConfidence = 0.75;
      } else {
        // Low severity with red flags is concerning
        baseConfidence = 0.55;
      }
      break;

    case "medium":
    default:
      // Medium severity is inherently uncertain
      baseConfidence = 0.50;
      break;
  }

  // Boost confidence if calibration was applied (correction made)
  if (wasCalibrated) {
    baseConfidence = Math.min(0.95, baseConfidence + 0.05);
  }

  return Math.round(baseConfidence * 100) / 100;
}

/**
 * Check if edge result is confident enough to use without fallback.
 *
 * Rules:
 * - severity !== 'medium' AND confidence >= 0.70
 * - OR severity === 'high' with multiple red flags
 * - OR severity === 'low' with only minor symptoms
 */
export function isEdgeConfident(
  severity: SeverityLevel,
  confidence: number,
  symptoms: string[],
  summary: string
): boolean {
  // Medium severity is almost always uncertain
  if (severity === "medium") {
    return false;
  }

  // Must meet minimum confidence threshold
  if (confidence < 0.70) {
    return false;
  }

  // High severity needs red flags
  if (severity === "high" && !hasRedFlags(symptoms, summary)) {
    return false;
  }

  // Low severity should not have red flags
  if (severity === "low" && hasRedFlags(symptoms, summary)) {
    return false;
  }

  return true;
}

/** Parse edge inference response into structured format. */
export function parseEdgeResponse(response: string): ParsedEdgeResult | null {
  try {
    const parsed = JSON.parse(response);

    return {
      severity: (parsed.severity || "medium").toLowerCase() as SeverityLevel,
      summary: parsed.summary || "",
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      differential: Array.isArray(parsed.differential) ? parsed.differential : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      reasoning: parsed.reasoning || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
    };
  } catch {
    // Try to extract from non-JSON response
    const severityMatch = response.match(/severity["\']?\s*[:=]\s*["\']?(low|medium|high)/i);
    const summaryMatch = response.match(/summary["\']?\s*[:=]\s*["\']?([^"\'\n]+)/i);

    if (severityMatch && summaryMatch) {
      return {
        severity: severityMatch[1].toLowerCase() as SeverityLevel,
        summary: summaryMatch[1],
        symptoms: [],
        differential: [],
        recommendations: [],
        reasoning: "",
      };
    }

    return null;
  }
}

/** Parse cloud analysis response into hybrid result format. */
export function parseCloudResponse(
  cloudResult: CaseAnalysis,
  fullLatency: number
): HybridAnalysisResult {
  // Try to parse the final_output as JSON for structured data
  let parsedOutput: Partial<ParsedEdgeResult> = {};
  try {
    parsedOutput = JSON.parse(cloudResult.final_output);
  } catch {
    // If not JSON, treat final_output as summary
    parsedOutput = { summary: cloudResult.final_output };
  }

  return {
    symptoms: parsedOutput.symptoms || [cloudResult.symptoms],
    severity: (parsedOutput.severity || "medium") as SeverityLevel,
    summary: parsedOutput.summary || cloudResult.final_output,
    differential: parsedOutput.differential || [],
    recommendations: parsedOutput.recommendations || [],
    reasoning: parsedOutput.reasoning || cloudResult.critique || "",
    fullResponse: JSON.stringify(cloudResult),
    source: "cloud",
    confidence: 0.75, // Cloud model has higher baseline confidence
    wasCalibrated: false,
    inferenceTime: fullLatency,
    cloudLatency: fullLatency,
  };
}

/**
 * Main hybrid analysis function.
 *
 * Attempts edge inference first, then falls back to cloud if:
 * - Edge fails completely
 * - Edge returns uncertain result (medium severity or low confidence)
 * - Edge response cannot be parsed
 */
export async function analyzeHybrid(
  symptoms: string
): Promise<HybridAnalysisResult> {
  const startTime = Date.now();

  // Attempt 1: Edge inference
  let edgeResult: Awaited<ReturnType<typeof runEdgeInference>> | null = null;
  let edgeParsed: ParsedEdgeResult | null = null;
  let edgeError: Error | null = null;

  try {
    edgeResult = await runEdgeInference(symptoms, { enableStreaming: false });
    edgeParsed = parseEdgeResponse(edgeResult.response);

    if (!edgeParsed) {
      throw new Error("Failed to parse edge response");
    }

    // Calculate confidence for edge result
    const confidence = calculateConfidenceScore(
      edgeParsed.severity,
      edgeParsed.symptoms,
      edgeParsed.summary,
      edgeResult.calibrated || false
    );

    // Check if edge result is confident enough
    const isConfident = isEdgeConfident(
      edgeParsed.severity,
      confidence,
      edgeParsed.symptoms,
      edgeParsed.summary
    );

    if (isConfident) {
      // Edge result is confident - return it
      const inferenceTime = Date.now() - startTime;

      return {
        symptoms: edgeParsed.symptoms,
        severity: edgeParsed.severity,
        summary: edgeParsed.summary,
        differential: edgeParsed.differential,
        recommendations: edgeParsed.recommendations,
        reasoning: edgeParsed.reasoning,
        fullResponse: edgeResult.response,
        source: "edge",
        confidence,
        wasCalibrated: edgeResult.calibrated || false,
        inferenceTime,
        tokensGenerated: edgeResult.tokensGenerated,
        edgeLatency: edgeResult.inferenceTime,
      };
    }

    // Edge result is not confident - will fallback to cloud
    // Continue to cloud fallback
  } catch (err) {
    edgeError = err instanceof Error ? err : new Error(String(err));
    // Edge failed - will fallback to cloud
  }

  // Attempt 2: Cloud fallback
  try {
    const cloudStartTime = Date.now();
    const cloudResult = await analyzeCaseCloud(symptoms);
    const fullLatency = Date.now() - startTime;

    const result = parseCloudResponse(cloudResult, fullLatency);

    // Add fallback reason
    if (edgeError) {
      result.fallbackReason = `Edge failed: ${edgeError.message}`;
    } else if (edgeParsed) {
      const confidence = calculateConfidenceScore(
        edgeParsed.severity,
        edgeParsed.symptoms,
        edgeParsed.summary,
        edgeResult?.calibrated || false
      );
      result.fallbackReason = `Edge uncertain: severity=${edgeParsed.severity}, confidence=${confidence}`;
    } else {
      result.fallbackReason = "Edge returned unparsable response";
    }

    return result;
  } catch (cloudErr) {
    // Both edge and cloud failed
    const cloudError = cloudErr instanceof Error ? cloudErr : new Error(String(cloudErr));

    // If we have an edge result (even if uncertain), return it as last resort
    if (edgeParsed && edgeResult) {
      const inferenceTime = Date.now() - startTime;
      const confidence = calculateConfidenceScore(
        edgeParsed.severity,
        edgeParsed.symptoms,
        edgeParsed.summary,
        edgeResult.calibrated || false
      );

      return {
        symptoms: edgeParsed.symptoms,
        severity: edgeParsed.severity,
        summary: edgeParsed.summary,
        differential: edgeParsed.differential,
        recommendations: edgeParsed.recommendations,
        reasoning: edgeParsed.reasoning,
        fullResponse: edgeResult.response,
        source: "edge",
        confidence,
        wasCalibrated: edgeResult.calibrated || false,
        fallbackReason: `Cloud failed (${cloudError.message}), using uncertain edge result`,
        inferenceTime,
        tokensGenerated: edgeResult.tokensGenerated,
        edgeLatency: edgeResult.inferenceTime,
      };
    }

    // Both failed and no edge result - throw error
    throw new Error(
      `Hybrid analysis failed. Edge: ${edgeError?.message || "unknown"}, Cloud: ${cloudError.message}`
    );
  }
}

/**
 * Quick check to determine if hybrid analysis would use cloud fallback
 * Useful for UI indicators
 *
 * @param symptoms - Patient symptoms
 * @returns Object indicating likely source and reason
 */
export async function predictAnalysisSource(
  symptoms: string
): Promise<{
  likelySource: AnalysisSource;
  reason: string;
}> {
  // Quick heuristic based on symptom complexity
  const wordCount = symptoms.split(/\s+/).length;
  const hasComplexIndicators =
    /(multiple|complex|history of|chronic|recurring|unclear|ambiguous)/i.test(
      symptoms
    );

  if (wordCount > 50 || hasComplexIndicators) {
    return {
      likelySource: "cloud",
      reason: "Complex presentation likely requires cloud analysis",
    };
  }

  // Check for clear red flags or minor symptoms
  const symptomsList = symptoms.split(/[,;]/).map((s) => s.trim());
  const hasClearRedFlags = hasRedFlags(symptomsList, symptoms);
  const hasClearMinorOnly = hasOnlyMinorSymptoms(symptomsList, symptoms);

  if (hasClearRedFlags || hasClearMinorOnly) {
    return {
      likelySource: "edge",
      reason: hasClearRedFlags
        ? "Clear red flags detected - edge can handle confidently"
        : "Minor symptoms only - edge sufficient",
    };
  }

  return {
    likelySource: "cloud",
    reason: "Uncertain presentation - likely needs cloud fallback",
  };
}

// Export types for external use
export type { CaseAnalysis };
