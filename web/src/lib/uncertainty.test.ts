import { describe, it, expect } from "vitest";
import {
  estimateMCDropoutUncertainty,
  estimateEnsembleUncertainty,
  detectOutOfDistribution,
  selectivePrediction,
  conformalPrediction,
  estimateComprehensiveUncertainty,
  simulateMCDropoutPredictions,
} from "./uncertainty";

describe("uncertainty module", () => {
  describe("estimateMCDropoutUncertainty", () => {
    it("calculates uncertainty from multiple predictions", () => {
      const predictions = [
        [0.7, 0.2, 0.1],
        [0.65, 0.25, 0.1],
        [0.72, 0.18, 0.1],
        [0.68, 0.22, 0.1],
      ];
      
      const result = estimateMCDropoutUncertainty(predictions);
      
      expect(result.predictiveEntropy).toBeGreaterThan(0);
      expect(result.mutualInformation).toBeGreaterThanOrEqual(0);
      expect(result.variance).toBeGreaterThan(0);
    });
    
    it("handles empty predictions", () => {
      const result = estimateMCDropoutUncertainty([]);
      
      expect(result.predictiveEntropy).toBe(0);
      expect(result.variance).toBe(0);
    });
    
    it("returns higher uncertainty for disagreeing predictions", () => {
      const agreeing = [
        [0.9, 0.05, 0.05],
        [0.88, 0.06, 0.06],
        [0.92, 0.04, 0.04],
      ];
      
      const disagreeing = [
        [0.8, 0.15, 0.05],
        [0.5, 0.3, 0.2],
        [0.3, 0.5, 0.2],
      ];
      
      const agreementResult = estimateMCDropoutUncertainty(agreeing);
      const disagreementResult = estimateMCDropoutUncertainty(disagreeing);
      
      expect(disagreementResult.variance).toBeGreaterThan(agreementResult.variance);
    });
  });
  
  describe("estimateEnsembleUncertainty", () => {
    it("calculates ensemble disagreement", () => {
      const predictions = [
        [0.7, 0.2, 0.1],
        [0.65, 0.25, 0.1],
        [0.6, 0.3, 0.1],
      ];
      
      const result = estimateEnsembleUncertainty(predictions);
      
      expect(result.uncertainty).toBeGreaterThan(0);
      expect(result.disagreement).toBeGreaterThanOrEqual(0);
      expect(result.consensus).toBe("low"); // Index 0 has highest prob
    });
    
    it("shows zero disagreement for unanimous predictions", () => {
      const predictions = [
        [0.9, 0.05, 0.05],
        [0.85, 0.1, 0.05],
        [0.88, 0.07, 0.05],
      ];
      
      const result = estimateEnsembleUncertainty(predictions);
      
      expect(result.disagreement).toBe(0);
    });
  });
  
  describe("detectOutOfDistribution", () => {
    it("detects in-distribution clinical input", () => {
      const input = "Patient presents with chest pain and shortness of breath";
      
      const result = detectOutOfDistribution(input);
      
      expect(result.isOOD).toBe(false);
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
    });
    
    it("detects out-of-distribution input", () => {
      const input = "quantum entanglement fluctuations in the hyperdimensional matrix";
      
      const result = detectOutOfDistribution(input);
      
      expect(result.isOOD).toBe(true);
      expect(result.score).toBeGreaterThan(0.3);
    });
    
    it("returns matched symptom patterns", () => {
      const input = "headache with fever and nausea";
      
      const result = detectOutOfDistribution(input);
      
      expect(result.matchedPatterns).toContain("headache");
      expect(result.matchedPatterns).toContain("fever");
      expect(result.matchedPatterns).toContain("nausea");
    });
  });
  
  describe("selectivePrediction", () => {
    it("accepts high confidence predictions", () => {
      const result = selectivePrediction(0.9, "high");
      
      expect(result.shouldPredict).toBe(true);
      expect(result.prediction).toBe("high");
    });
    
    it("rejects low confidence predictions", () => {
      const result = selectivePrediction(0.05, "high");
      
      expect(result.shouldPredict).toBe(false);
      expect(result.prediction).toBeNull();
      expect(result.rejectionReason).toBeDefined();
    });
    
    it("adjusts threshold based on uncertainty estimate", () => {
      const highEpistemicUncertainty = {
        totalUncertainty: 0.5,
        epistemicUncertainty: 0.8,
        aleatoricUncertainty: 0.1,
        isOutOfDistribution: false,
        oodScore: 0.1,
        recommendation: { action: "seek-review" as const, reason: "", confidenceInRecommendation: 0.5 },
        breakdown: { predictiveEntropy: 0, mutualInformation: 0, expectedEntropy: 0, variance: 0, standardDeviation: 0 },
      };
      
      const result = selectivePrediction(0.8, "medium", 0.9, highEpistemicUncertainty);
      
      // Higher threshold due to epistemic uncertainty
      expect(result.shouldPredict).toBe(true);
    });
  });
  
  describe("conformalPrediction", () => {
    it("returns prediction set with coverage guarantee", () => {
      const probs = [0.1, 0.6, 0.25, 0.05];
      
      const result = conformalPrediction(probs, 0.1);
      
      expect(result.coverageGuarantee).toBe(0.9);
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.isValid).toBe(true);
    });
    
    it("includes primary prediction first", () => {
      const probs = [0.1, 0.6, 0.25, 0.05];
      
      const result = conformalPrediction(probs);
      
      expect(result.predictions[0]).toBe("medium"); // Index 1 has highest prob
    });
    
    it("expands set for higher coverage", () => {
      const probs = [0.3, 0.3, 0.3, 0.1];
      
      const lowCoverage = conformalPrediction(probs, 0.3);
      const highCoverage = conformalPrediction(probs, 0.05);
      
      expect(highCoverage.setSize).toBeGreaterThanOrEqual(lowCoverage.setSize);
    });
  });
  
  describe("estimateComprehensiveUncertainty", () => {
    it("combines all uncertainty sources", () => {
      const input = "chest pain radiating to arm";
      const predictions = simulateMCDropoutPredictions([0.2, 0.3, 0.4, 0.1], 5);
      const singlePred = [0.2, 0.3, 0.4, 0.1];
      
      const result = estimateComprehensiveUncertainty(input, predictions, singlePred);
      
      expect(result.totalUncertainty).toBeGreaterThanOrEqual(0);
      expect(result.totalUncertainty).toBeLessThanOrEqual(1);
      expect(result.recommendation).toBeDefined();
      expect(result.breakdown).toBeDefined();
    });
    
    it("recommends human review for OOD inputs", () => {
      const input = "alien abduction symptoms with telepathic interference";
      const predictions = simulateMCDropoutPredictions([0.25, 0.25, 0.25, 0.25], 5);
      const singlePred = [0.25, 0.25, 0.25, 0.25];
      
      const result = estimateComprehensiveUncertainty(input, predictions, singlePred);
      
      expect(result.recommendation.action).toBe("defer-to-human");
    });
  });
  
  describe("simulateMCDropoutPredictions", () => {
    it("generates specified number of samples", () => {
      const base = [0.5, 0.3, 0.2];
      
      const result = simulateMCDropoutPredictions(base, 10);
      
      expect(result.length).toBe(10);
    });
    
    it("produces normalized predictions", () => {
      const base = [0.5, 0.3, 0.2];
      
      const result = simulateMCDropoutPredictions(base, 5);
      
      for (const pred of result) {
        const sum = pred.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
      }
    });
  });
});
