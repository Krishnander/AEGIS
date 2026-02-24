import { hybridRetrieve } from "@/lib/retrieval";
import { analyzeCaseCloud } from "@/lib/api";
import { runEdgeInference, EDGE_MODEL_LABEL } from "@/lib/mediapipe";
import { parseAIResponse } from "@/lib/utils";
import { buildAugmentedPrompt } from "@/lib/orchestrator";
import { summarizeComparison, type ModelComparisonSample, type ModelComparisonMetrics } from "@/lib/metrics";

export interface EvalSample {
  id: string;
  prompt: string;
  expected?: "low" | "medium" | "high";
}

export interface EvalRunResult {
  edgeModel: string;
  cloudModel: string;
  metrics: ModelComparisonMetrics;
  samples: ModelComparisonSample[];
}

export async function runEvalComparison(samples: EvalSample[]): Promise<EvalRunResult> {
  const results: ModelComparisonSample[] = [];

  for (const sample of samples) {
    const retrieval = await hybridRetrieve(sample.prompt, 5);
    const prompt = buildAugmentedPrompt(sample.prompt, retrieval, 0);

    let edgeSeverity: "low" | "medium" | "high" | undefined;
    let edgeLatencyMs: number | undefined;
    try {
      const edgeStart = performance.now();
      const edge = await runEdgeInference(prompt, { enableStreaming: false });
      edgeLatencyMs = performance.now() - edgeStart;
      // Use calibrated severity if available, otherwise fall back to parsing
      edgeSeverity = edge.severity || parseAIResponse(edge.response).severity;
    } catch {
      edgeSeverity = undefined;
    }

    let cloudSeverity: "low" | "medium" | "high" | undefined;
    let cloudLatencyMs: number | undefined;
    try {
      const cloudStart = performance.now();
      const cloud = await analyzeCaseCloud(sample.prompt);
      cloudLatencyMs = performance.now() - cloudStart;
      cloudSeverity = parseAIResponse(JSON.stringify(cloud)).severity;
    } catch {
      cloudSeverity = undefined;
    }

    results.push({
      id: sample.id,
      expectedSeverity: sample.expected,
      edgeSeverity,
      cloudSeverity,
      edgeLatencyMs,
      cloudLatencyMs,
      citations: retrieval.citations.length,
    });
  }

  return {
    edgeModel: EDGE_MODEL_LABEL,
    cloudModel: "Cloud MedGemma 1.5 4B",
    metrics: summarizeComparison(results),
    samples: results,
  };
}
