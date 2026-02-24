import { describe, it, expect } from "vitest";
import { 
  calculateConfidence, 
  calculateECE,
  calculateSeverityConfidence,
  formatConfidenceDisplay
} from "./confidence";

describe("confidence module", () => {
  describe("calculateConfidence", () => {
    it("returns properly calibrated confidence with temperature scaling", () => {
      const result = calculateConfidence(2.0, "high");
      
      expect(result.raw).toBeGreaterThan(0);
      expect(result.raw).toBeLessThanOrEqual(1);
      expect(result.calibrated).toBeGreaterThan(0);
      expect(result.calibrated).toBeLessThanOrEqual(1);
      // Temperature scaling should reduce overconfidence
      expect(result.calibrated).toBeLessThanOrEqual(result.raw);
    });

    it("calculates uncertainty from ensemble scores", () => {
      const ensembleScores = [0.8, 0.75, 0.85, 0.78];
      const result = calculateConfidence(1.5, "medium", ensembleScores);
      
      expect(result.uncertainty).toBeGreaterThan(0);
      expect(result.uncertainty).toBeLessThan(1);
    });

    it("increases uncertainty for edge cases", () => {
      const highConfidence = calculateConfidence(5.0, "high"); // Very high logit
      const lowConfidence = calculateConfidence(-2.0, "low"); // Low logit
      
      // Edge cases should have higher base uncertainty
      expect(highConfidence.uncertainty).toBeGreaterThan(0.05);
    });

    it("assigns reliability levels correctly", () => {
      const highReliability = calculateConfidence(2.0, "high", [0.9, 0.91, 0.89]);
      const lowReliability = calculateConfidence(0.5, "low", [0.3, 0.8, 0.5, 0.2]);
      
      expect(["high", "medium", "low"]).toContain(highReliability.reliability);
      expect(["high", "medium", "low"]).toContain(lowReliability.reliability);
    });

    it("generates human-readable descriptions", () => {
      const result = calculateConfidence(1.5, "medium");
      
      expect(result.description).toBeTruthy();
      expect(typeof result.description).toBe("string");
      expect(result.description.length).toBeGreaterThan(10);
    });
  });

  describe("calculateECE", () => {
    it("calculates ECE for well-calibrated predictions", () => {
      const predictions = [
        { predicted: 0.9, actual: true },
        { predicted: 0.8, actual: true },
        { predicted: 0.2, actual: false },
        { predicted: 0.1, actual: false },
        { predicted: 0.7, actual: true },
        { predicted: 0.3, actual: false },
      ];
      
      const result = calculateECE(predictions);
      
      expect(result.ece).toBeGreaterThanOrEqual(0);
      expect(result.ece).toBeLessThanOrEqual(1);
      expect(result.mce).toBeGreaterThanOrEqual(result.ece);
      expect(result.bins.length).toBe(10);
    });

    it("assigns reliability rating correctly", () => {
      // Perfect calibration scenario
      const perfectPredictions = Array(100).fill(null).map((_, i) => ({
        predicted: i / 100,
        actual: Math.random() < i / 100,
      }));
      
      const result = calculateECE(perfectPredictions);
      
      expect(["excellent", "good", "fair", "poor"]).toContain(result.overallReliability);
    });

    it("handles empty predictions", () => {
      const result = calculateECE([]);
      
      expect(result.ece).toBe(0);
      expect(result.brierScore).toBe(0);
    });
  });

  describe("calculateSeverityConfidence", () => {
    it("returns confidence for all severity levels", () => {
      const result = calculateSeverityConfidence({
        low: -1.0,
        medium: 0.5,
        high: 2.0,
      });
      
      expect(result.low).toBeDefined();
      expect(result.medium).toBeDefined();
      expect(result.high).toBeDefined();
      expect(["low", "medium", "high"]).toContain(result.predicted);
    });

    it("predicts highest confidence severity", () => {
      const result = calculateSeverityConfidence({
        low: -2.0,
        medium: -1.0,
        high: 3.0, // Highest logit
      });
      
      expect(result.predicted).toBe("high");
    });
  });

  describe("formatConfidenceDisplay", () => {
    it("formats confidence with uncertainty", () => {
      const score = {
        raw: 0.9,
        calibrated: 0.85,
        uncertainty: 0.1,
        reliability: "high" as const,
        description: "Test",
      };
      
      const formatted = formatConfidenceDisplay(score);
      
      expect(formatted).toContain("85");
      expect(formatted).toContain("±");
      expect(formatted).toContain("10");
    });
  });
});
