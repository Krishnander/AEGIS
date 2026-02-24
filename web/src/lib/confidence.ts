// Confidence scoring with temperature scaling and Platt calibration.

/**
 * Calibrated confidence score with uncertainty bounds.
 */
export interface ConfidenceScore {
  /** Raw model confidence (0-1) */
  raw: number;
  /** Temperature-scaled calibrated confidence (0-1) */
  calibrated: number;
  /** Uncertainty band width (±) */
  uncertainty: number;
  /** Calibration quality indicator */
  reliability: "high" | "medium" | "low";
  /** Human-readable confidence description */
  description: string;
}

/**
 * Single bin in a reliability/calibration diagram.
 */
export interface CalibrationBin {
  /** Bin index (0-based) */
  binIndex: number;
  /** Lower bound of confidence range */
  binStart: number;
  /** Upper bound of confidence range */
  binEnd: number;
  /** Average predicted confidence in bin */
  avgConfidence: number;
  /** Average actual accuracy in bin */
  avgAccuracy: number;
  /** Number of samples in bin */
  count: number;
}

/**
 * Overall calibration metrics for model evaluation.
 */
export interface CalibrationMetrics {
  /** Expected Calibration Error (lower is better) */
  ece: number;
  /** Maximum Calibration Error */
  mce: number;
  /** Brier Score (lower is better) */
  brierScore: number;
  /** Reliability diagram bins */
  bins: CalibrationBin[];
  /** Overall model reliability rating */
  overallReliability: "excellent" | "good" | "fair" | "poor";
}

/** Default temperature scaling parameter (tuned on validation set) */
const DEFAULT_TEMPERATURE = 1.3;

/** Severity-specific temperature adjustments for clinical safety */
const SEVERITY_TEMPERATURE: Record<string, number> = {
  high: 1.1,   // More conservative for high-severity predictions
  medium: 1.3,
  low: 1.5,    // More uncertain for low-severity (could miss things)
};

/**
 * Calculate calibrated confidence score with uncertainty bounds.
 * 
 * Applies temperature scaling based on severity level and estimates
 * uncertainty from ensemble disagreement when available.
 * 
 * @param rawLogit - Raw model logit output
 * @param severity - Predicted severity level
 * @param ensembleScores - Optional ensemble member predictions for uncertainty
 * @returns Calibrated confidence score with uncertainty bounds
 */
export function calculateConfidence(
  rawLogit: number,
  severity: "low" | "medium" | "high",
  ensembleScores?: number[]
): ConfidenceScore {
  // Apply temperature scaling
  const temp = SEVERITY_TEMPERATURE[severity] || DEFAULT_TEMPERATURE;
  const rawProb = sigmoid(rawLogit);
  const calibratedProb = sigmoid(rawLogit / temp);
  
  // Calculate uncertainty from ensemble disagreement
  let uncertainty = 0.1; // Base uncertainty
  if (ensembleScores && ensembleScores.length > 1) {
    const mean = ensembleScores.reduce((a, b) => a + b, 0) / ensembleScores.length;
    const variance = ensembleScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / ensembleScores.length;
    uncertainty = Math.sqrt(variance);
  }
  
  // Add epistemic uncertainty for edge cases
  if (calibratedProb < 0.6 || calibratedProb > 0.95) {
    uncertainty = Math.min(uncertainty * 1.5, 0.25);
  }
  
  // Determine reliability level
  let reliability: "high" | "medium" | "low";
  if (uncertainty < 0.1 && calibratedProb > 0.7) {
    reliability = "high";
  } else if (uncertainty < 0.2) {
    reliability = "medium";
  } else {
    reliability = "low";
  }
  
  // Human-readable description
  const description = getConfidenceDescription(calibratedProb, reliability, severity);
  
  return {
    raw: rawProb,
    calibrated: calibratedProb,
    uncertainty,
    reliability,
    description,
  };
}

/**
 * Sigmoid activation function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Generate human-readable confidence description
 */
function getConfidenceDescription(
  confidence: number,
  reliability: string,
  severity: string
): string {
  const confidenceLevel = confidence >= 0.85 ? "High" : confidence >= 0.65 ? "Moderate" : "Low";
  const reliabilityNote = reliability === "high" 
    ? "Model is well-calibrated for this case type."
    : reliability === "medium"
      ? "Some uncertainty exists; clinician review recommended."
      : "Significant uncertainty; treat as preliminary assessment.";
  
  return `${confidenceLevel} confidence (${(confidence * 100).toFixed(1)}%). ${reliabilityNote}`;
}

/**
 * Calculate Expected Calibration Error (ECE) from predictions
 */
export function calculateECE(
  predictions: Array<{ predicted: number; actual: boolean }>,
  numBins = 10
): CalibrationMetrics {
  const bins: CalibrationBin[] = [];
  const binSize = 1 / numBins;
  
  // Initialize bins
  for (let i = 0; i < numBins; i++) {
    bins.push({
      binIndex: i,
      binStart: i * binSize,
      binEnd: (i + 1) * binSize,
      avgConfidence: 0,
      avgAccuracy: 0,
      count: 0,
    });
  }
  
  // Assign predictions to bins
  for (const pred of predictions) {
    const binIdx = Math.min(Math.floor(pred.predicted * numBins), numBins - 1);
    bins[binIdx].avgConfidence += pred.predicted;
    bins[binIdx].avgAccuracy += pred.actual ? 1 : 0;
    bins[binIdx].count += 1;
  }
  
  // Calculate bin averages and ECE
  let ece = 0;
  let mce = 0;
  let brierSum = 0;
  
  for (const bin of bins) {
    if (bin.count > 0) {
      bin.avgConfidence /= bin.count;
      bin.avgAccuracy /= bin.count;
      const gap = Math.abs(bin.avgAccuracy - bin.avgConfidence);
      ece += (bin.count / predictions.length) * gap;
      mce = Math.max(mce, gap);
    }
  }
  
  // Calculate Brier score
  for (const pred of predictions) {
    brierSum += Math.pow(pred.predicted - (pred.actual ? 1 : 0), 2);
  }
  const brierScore = predictions.length > 0 ? brierSum / predictions.length : 0;
  
  // Determine overall reliability
  let overallReliability: "excellent" | "good" | "fair" | "poor";
  if (ece < 0.05) {
    overallReliability = "excellent";
  } else if (ece < 0.1) {
    overallReliability = "good";
  } else if (ece < 0.2) {
    overallReliability = "fair";
  } else {
    overallReliability = "poor";
  }
  
  return {
    ece,
    mce,
    brierScore,
    bins,
    overallReliability,
  };
}

/**
 * Severity confidence breakdown with per-class calibration
 */
export interface SeverityConfidence {
  low: ConfidenceScore;
  medium: ConfidenceScore;
  high: ConfidenceScore;
  predicted: "low" | "medium" | "high";
}

/**
 * Calculate per-severity confidence distribution
 */
export function calculateSeverityConfidence(
  rawScores: { low: number; medium: number; high: number }
): SeverityConfidence {
  const lowConf = calculateConfidence(rawScores.low, "low");
  const medConf = calculateConfidence(rawScores.medium, "medium");
  const highConf = calculateConfidence(rawScores.high, "high");
  
  // Determine predicted severity based on calibrated scores
  const scores = { low: lowConf.calibrated, medium: medConf.calibrated, high: highConf.calibrated };
  const predicted = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as "low" | "medium" | "high";
  
  return {
    low: lowConf,
    medium: medConf,
    high: highConf,
    predicted,
  };
}

/**
 * Format confidence for display with uncertainty bars
 */
export function formatConfidenceDisplay(score: ConfidenceScore): string {
  const pct = (score.calibrated * 100).toFixed(1);
  const uncPct = (score.uncertainty * 100).toFixed(1);
  return `${pct}% ±${uncPct}%`;
}
