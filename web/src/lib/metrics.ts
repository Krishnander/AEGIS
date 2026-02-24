// Summary metrics for edge vs cloud A/B evaluation.

/**
 * Single evaluation sample comparing edge and cloud models.
 */
export interface ModelComparisonSample {
  /** Unique sample identifier */
  id: string;
  /** Ground truth severity label */
  expectedSeverity?: "low" | "medium" | "high";
  /** Edge model prediction */
  edgeSeverity?: "low" | "medium" | "high";
  /** Cloud model prediction */
  cloudSeverity?: "low" | "medium" | "high";
  /** Edge model inference latency (ms) */
  edgeLatencyMs?: number;
  /** Cloud model inference latency (ms) */
  cloudLatencyMs?: number;
  /** Number of citations in response */
  citations?: number;
}

/**
 * Aggregated comparison metrics across evaluation samples.
 */
export interface ModelComparisonMetrics {
  /** Total number of samples */
  total: number;
  /** Number of samples with ground truth labels */
  labeled: number;
  /** Edge model accuracy (0-1) */
  edgeAccuracy: number;
  /** Cloud model accuracy (0-1) */
  cloudAccuracy: number;
  /** Average edge model latency (ms) */
  edgeAvgLatencyMs: number;
  /** Average cloud model latency (ms) */
  cloudAvgLatencyMs: number;
  /** Average citations per response */
  citationAvg: number;
}

/**
 * Safe division helper to avoid divide-by-zero.
 */
const safeDivide = (numerator: number, denominator: number): number => {
  return denominator === 0 ? 0 : numerator / denominator;
};

/** Calculate comparison metrics from evaluation samples. */
export function summarizeComparison(samples: ModelComparisonSample[]): ModelComparisonMetrics {
  const total = samples.length;
  const labeled = samples.filter((s) => s.expectedSeverity).length;

  const edgeCorrect = samples.filter(
    (s) => s.expectedSeverity && s.edgeSeverity === s.expectedSeverity
  ).length;
  const cloudCorrect = samples.filter(
    (s) => s.expectedSeverity && s.cloudSeverity === s.expectedSeverity
  ).length;

  const edgeLatencySum = samples.reduce((sum, s) => sum + (s.edgeLatencyMs ?? 0), 0);
  const cloudLatencySum = samples.reduce((sum, s) => sum + (s.cloudLatencyMs ?? 0), 0);
  const citationSum = samples.reduce((sum, s) => sum + (s.citations ?? 0), 0);

  return {
    total,
    labeled,
    edgeAccuracy: safeDivide(edgeCorrect, labeled),
    cloudAccuracy: safeDivide(cloudCorrect, labeled),
    edgeAvgLatencyMs: safeDivide(edgeLatencySum, total),
    cloudAvgLatencyMs: safeDivide(cloudLatencySum, total),
    citationAvg: safeDivide(citationSum, total),
  };
}
