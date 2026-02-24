// Simulated uncertainty estimation for clinical severity scoring (heuristic, not ML-based).

export interface UncertaintyEstimate {
  /** Overall uncertainty (0-1, higher = more uncertain) */
  totalUncertainty: number;
  /** Epistemic uncertainty (model uncertainty, reducible with more data) */
  epistemicUncertainty: number;
  /** Aleatoric uncertainty (data noise, irreducible) */
  aleatoricUncertainty: number;
  /** Whether input is out-of-distribution */
  isOutOfDistribution: boolean;
  /** OOD detection score */
  oodScore: number;
  /** Recommendation for action */
  recommendation: UncertaintyRecommendation;
  /** Detailed breakdown */
  breakdown: UncertaintyBreakdown;
}

export interface UncertaintyBreakdown {
  /** Entropy of prediction distribution */
  predictiveEntropy: number;
  /** Mutual information (epistemic component) */
  mutualInformation: number;
  /** Expected entropy (aleatoric component) */
  expectedEntropy: number;
  /** Variance across samples */
  variance: number;
  /** Standard deviation */
  standardDeviation: number;
}

export interface UncertaintyRecommendation {
  action: "proceed" | "seek-review" | "defer-to-human" | "reject";
  reason: string;
  confidenceInRecommendation: number;
}

export interface MCDropoutConfig {
  numSamples: number;
  dropoutRate: number;
  temperature: number;
}

export interface SelectivePredictionResult {
  shouldPredict: boolean;
  prediction: string | null;
  confidence: number;
  coverageRate: number;
  rejectionReason?: string;
}

export interface ConformalPredictionSet {
  predictions: string[];
  coverageGuarantee: number;
  setSize: number;
  isValid: boolean;
}

// Clinical-specific symptom embeddings for OOD detection
const KNOWN_SYMPTOM_PATTERNS = [
  "chest pain", "shortness of breath", "headache", "fever", "nausea",
  "abdominal pain", "dizziness", "fatigue", "cough", "back pain",
  "palpitations", "syncope", "weakness", "confusion", "seizure",
  "bleeding", "trauma", "rash", "swelling", "pain",
];

/**
 * Simulate Monte Carlo Dropout for uncertainty estimation
 * In production, this would be actual model inference with dropout enabled
 * 
 * @param predictions - Array of class probabilities from multiple forward passes
 * @returns Epistemic and aleatoric uncertainty estimates
 */
export function estimateMCDropoutUncertainty(
  predictions: number[][],
  config: MCDropoutConfig = { numSamples: 10, dropoutRate: 0.1, temperature: 1.0 }
): UncertaintyBreakdown {
  if (predictions.length === 0 || predictions[0].length === 0) {
    return {
      predictiveEntropy: 0,
      mutualInformation: 0,
      expectedEntropy: 0,
      variance: 0,
      standardDeviation: 0,
    };
  }
  
  const numClasses = predictions[0].length;
  const numSamples = predictions.length;
  
  // Calculate mean prediction (predictive distribution)
  const meanPrediction = new Array(numClasses).fill(0);
  for (const pred of predictions) {
    for (let i = 0; i < numClasses; i++) {
      meanPrediction[i] += pred[i] / numSamples;
    }
  }
  
  // Predictive entropy: H[p(y|x, D)]
  const predictiveEntropy = -meanPrediction.reduce((sum, p) => {
    return sum + (p > 0 ? p * Math.log2(p) : 0);
  }, 0);
  
  // Expected entropy: E[H[p(y|x, w)]] - average entropy of individual predictions
  let expectedEntropy = 0;
  for (const pred of predictions) {
    const entropy = -pred.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
    expectedEntropy += entropy / numSamples;
  }
  
  // Mutual information (epistemic uncertainty): I[y, w|x, D] = H[p(y|x, D)] - E[H[p(y|x, w)]]
  const mutualInformation = Math.max(0, predictiveEntropy - expectedEntropy);
  
  // Calculate variance across predictions
  let variance = 0;
  for (const pred of predictions) {
    for (let i = 0; i < numClasses; i++) {
      variance += Math.pow(pred[i] - meanPrediction[i], 2);
    }
  }
  variance /= (numSamples * numClasses);
  
  return {
    predictiveEntropy,
    mutualInformation,
    expectedEntropy,
    variance,
    standardDeviation: Math.sqrt(variance),
  };
}

/**
 * Ensemble-based uncertainty estimation
 * Uses disagreement between ensemble members as uncertainty measure
 */
export function estimateEnsembleUncertainty(
  ensemblePredictions: number[][],
  weights?: number[]
): { uncertainty: number; disagreement: number; consensus: string } {
  if (ensemblePredictions.length === 0) {
    return { uncertainty: 1, disagreement: 1, consensus: "unknown" };
  }
  
  const numModels = ensemblePredictions.length;
  const numClasses = ensemblePredictions[0].length;
  
  // Default to equal weights
  const modelWeights = weights || new Array(numModels).fill(1 / numModels);
  
  // Get predicted class from each model
  const predictions = ensemblePredictions.map(pred => 
    pred.indexOf(Math.max(...pred))
  );
  
  // Calculate weighted average prediction
  const avgPrediction = new Array(numClasses).fill(0);
  for (let m = 0; m < numModels; m++) {
    for (let c = 0; c < numClasses; c++) {
      avgPrediction[c] += modelWeights[m] * ensemblePredictions[m][c];
    }
  }
  
  // Disagreement: how often models disagree
  const modeClass = predictions.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const maxAgreement = Math.max(...Object.values(modeClass));
  const disagreement = 1 - (maxAgreement / numModels);
  
  // Uncertainty from average prediction entropy
  const entropy = -avgPrediction.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
  const maxEntropy = Math.log2(numClasses);
  const uncertainty = entropy / maxEntropy;
  
  const consensusClass = parseInt(Object.entries(modeClass)
    .sort((a, b) => b[1] - a[1])[0][0]);
  
  const severityLabels = ["low", "medium", "high", "critical"];
  
  return {
    uncertainty,
    disagreement,
    consensus: severityLabels[consensusClass] || "unknown",
  };
}

/**
 * Out-of-distribution detection using semantic similarity
 * Detects if input is significantly different from training distribution
 */
export function detectOutOfDistribution(
  inputText: string,
  threshold: number = 0.3
): { isOOD: boolean; score: number; matchedPatterns: string[]; novelTerms: string[] } {
  const normalizedInput = inputText.toLowerCase();
  const words = normalizedInput.split(/\s+/);
  
  // Check for known symptom patterns
  const matchedPatterns = KNOWN_SYMPTOM_PATTERNS.filter(pattern => 
    normalizedInput.includes(pattern)
  );
  
  // Find terms that don't match known patterns
  const knownWords = new Set(KNOWN_SYMPTOM_PATTERNS.flatMap(p => p.split(" ")));
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "has", "have", "with", "and", "or", "of", "to", "in", "for", "on", "at", "by", "patient", "presents", "reports", "states", "denies"]);
  
  const novelTerms = words.filter(word => 
    word.length > 2 && 
    !stopWords.has(word) && 
    !knownWords.has(word) &&
    !/^\d+$/.test(word)
  );
  
  // Calculate OOD score based on coverage
  const coverageRatio = matchedPatterns.length / Math.max(1, words.length / 3);
  const noveltyRatio = novelTerms.length / Math.max(1, words.length);
  
  // OOD score: high novelty + low coverage = likely OOD
  const oodScore = Math.min(1, Math.max(0, noveltyRatio - coverageRatio + 0.5));
  
  return {
    isOOD: oodScore > threshold,
    score: oodScore,
    matchedPatterns,
    novelTerms: novelTerms.slice(0, 5), // Return top 5 novel terms
  };
}

/**
 * Selective prediction with rejection option
 * Only makes prediction if confidence is above threshold
 */
export function selectivePrediction(
  confidence: number,
  prediction: string,
  coverageTarget: number = 0.9,
  uncertaintyEstimate?: UncertaintyEstimate
): SelectivePredictionResult {
  // Adaptive threshold based on coverage target
  // Higher coverage = lower threshold (accept more predictions)
  const baseThreshold = 1 - coverageTarget;
  
  // Adjust threshold based on uncertainty if available
  let effectiveThreshold = baseThreshold;
  if (uncertaintyEstimate) {
    // Increase threshold if epistemic uncertainty is high
    effectiveThreshold += uncertaintyEstimate.epistemicUncertainty * 0.2;
    
    // Increase threshold for OOD inputs
    if (uncertaintyEstimate.isOutOfDistribution) {
      effectiveThreshold += 0.2;
    }
  }
  
  const shouldPredict = confidence >= effectiveThreshold;
  
  return {
    shouldPredict,
    prediction: shouldPredict ? prediction : null,
    confidence,
    coverageRate: coverageTarget,
    rejectionReason: shouldPredict ? undefined : 
      confidence < baseThreshold ? "Low confidence" :
      uncertaintyEstimate?.isOutOfDistribution ? "Out-of-distribution input" :
      "High epistemic uncertainty",
  };
}

/**
 * Conformal prediction for guaranteed coverage
 * Returns a set of predictions that includes the true label with probability >= 1-alpha
 */
export function conformalPrediction(
  classProbabilities: number[],
  alpha: number = 0.1,
  calibrationScores?: number[]
): ConformalPredictionSet {
  const severityLabels = ["low", "medium", "high", "critical"];
  
  // Sort classes by probability (descending)
  const sortedIndices = classProbabilities
    .map((p, i) => ({ prob: p, idx: i }))
    .sort((a, b) => b.prob - a.prob)
    .map(x => x.idx);
  
  // Use calibrated threshold if available, otherwise use alpha directly
  const threshold = calibrationScores ? 
    calibrationScores[Math.floor(calibrationScores.length * (1 - alpha))] :
    alpha;
  
  // Build prediction set until cumulative probability exceeds 1 - alpha
  const predictions: string[] = [];
  let cumulativeProb = 0;
  
  for (const idx of sortedIndices) {
    predictions.push(severityLabels[idx]);
    cumulativeProb += classProbabilities[idx];
    
    if (cumulativeProb >= 1 - threshold) {
      break;
    }
  }
  
  return {
    predictions,
    coverageGuarantee: 1 - alpha,
    setSize: predictions.length,
    isValid: predictions.length > 0 && predictions.length <= severityLabels.length,
  };
}

/**
 * Comprehensive uncertainty estimation combining all methods
 */
export function estimateComprehensiveUncertainty(
  inputText: string,
  predictions: number[][],
  singlePrediction: number[]
): UncertaintyEstimate {
  // MC Dropout uncertainty
  const mcDropout = estimateMCDropoutUncertainty(predictions);
  
  // Ensemble uncertainty
  const ensemble = estimateEnsembleUncertainty(predictions);
  
  // OOD detection
  const ood = detectOutOfDistribution(inputText);
  
  // Calculate epistemic and aleatoric uncertainty
  const epistemicUncertainty = Math.min(1, mcDropout.mutualInformation / Math.log2(4));
  const aleatoricUncertainty = Math.min(1, mcDropout.expectedEntropy / Math.log2(4));
  
  // Total uncertainty combines both
  const totalUncertainty = Math.min(1, 
    0.6 * epistemicUncertainty + 
    0.3 * aleatoricUncertainty + 
    0.1 * (ood.isOOD ? 1 : 0)
  );
  
  // Determine recommendation
  let recommendation: UncertaintyRecommendation;
  
  if (ood.isOOD) {
    recommendation = {
      action: "defer-to-human",
      reason: "Input appears to be out-of-distribution; human review required",
      confidenceInRecommendation: 0.9,
    };
  } else if (totalUncertainty > 0.7) {
    recommendation = {
      action: "reject",
      reason: "Uncertainty too high for reliable prediction",
      confidenceInRecommendation: 0.85,
    };
  } else if (totalUncertainty > 0.4 || epistemicUncertainty > 0.5) {
    recommendation = {
      action: "seek-review",
      reason: "Moderate uncertainty; clinical review recommended",
      confidenceInRecommendation: 0.75,
    };
  } else {
    recommendation = {
      action: "proceed",
      reason: "Uncertainty within acceptable bounds",
      confidenceInRecommendation: 1 - totalUncertainty,
    };
  }
  
  return {
    totalUncertainty,
    epistemicUncertainty,
    aleatoricUncertainty,
    isOutOfDistribution: ood.isOOD,
    oodScore: ood.score,
    recommendation,
    breakdown: mcDropout,
  };
}

/**
 * Generate simulated MC Dropout predictions for demonstration
 * In production, this would be actual model inference
 */
export function simulateMCDropoutPredictions(
  basePrediction: number[],
  numSamples: number = 10,
  noiseLevel: number = 0.1
): number[][] {
  const predictions: number[][] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const noisyPred = basePrediction.map(p => {
      const noise = (Math.random() /* simulated */ - 0.5) * 2 * noiseLevel;
      return Math.max(0, Math.min(1, p + noise));
    });
    
    // Normalize to sum to 1
    const sum = noisyPred.reduce((a, b) => a + b, 0);
    predictions.push(noisyPred.map(p => p / sum));
  }
  
  return predictions;
}


