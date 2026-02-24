// Tests for hybrid edge/cloud orchestration with fallback.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeHybrid,
  calculateConfidenceScore,
  isEdgeConfident,
  parseEdgeResponse,
  parseCloudResponse,
  predictAnalysisSource,
} from "./hybrid-orchestrator";
import { runEdgeInference } from "./mediapipe";
import { analyzeCaseCloud } from "./api";

// Mock dependencies
vi.mock("./mediapipe", () => ({
  runEdgeInference: vi.fn(),
}));

vi.mock("./api", () => ({
  analyzeCaseCloud: vi.fn(),
}));

describe("Hybrid Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateConfidenceScore", () => {
    it("should return high confidence for HIGH severity with red flags", () => {
      const confidence = calculateConfidenceScore(
        "high",
        ["chest pain", "shortness of breath", "sweating"],
        "Patient with acute chest pain",
        false
      );
      expect(confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("should return medium confidence for HIGH severity without red flags", () => {
      const confidence = calculateConfidenceScore(
        "high",
        ["mild discomfort", "fatigue"],
        "Patient feels unwell",
        false
      );
      expect(confidence).toBeLessThan(0.70);
    });

    it("should return high confidence for LOW severity with minor symptoms", () => {
      const confidence = calculateConfidenceScore(
        "low",
        ["sore throat", "mild headache"],
        "Patient with viral URI symptoms",
        false
      );
      expect(confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("should return low confidence for MEDIUM severity", () => {
      const confidence = calculateConfidenceScore(
        "medium",
        ["abdominal pain", "nausea"],
        "Unclear presentation",
        false
      );
      expect(confidence).toBeLessThanOrEqual(0.60);
    });

    it("should boost confidence when calibration was applied", () => {
      const uncalibrated = calculateConfidenceScore(
        "high",
        ["chest pain", "shortness of breath"],
        "Patient with chest pain",
        false
      );
      const calibrated = calculateConfidenceScore(
        "high",
        ["chest pain", "shortness of breath"],
        "Patient with chest pain",
        true
      );
      expect(calibrated).toBeGreaterThan(uncalibrated);
    });

    it("should cap confidence at 0.95 even with calibration", () => {
      const confidence = calculateConfidenceScore(
        "low",
        ["sore throat"],
        "Minor symptoms",
        true
      );
      expect(confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe("isEdgeConfident", () => {
    it("should return false for MEDIUM severity regardless of confidence", () => {
      const isConfident = isEdgeConfident(
        "medium",
        0.95,
        ["symptom"],
        "summary"
      );
      expect(isConfident).toBe(false);
    });

    it("should return false when confidence is below 0.70", () => {
      const isConfident = isEdgeConfident(
        "high",
        0.65,
        ["chest pain"],
        "summary"
      );
      expect(isConfident).toBe(false);
    });

    it("should return false for HIGH severity without red flags", () => {
      const isConfident = isEdgeConfident(
        "high",
        0.85,
        ["mild fatigue"],
        "Patient tired"
      );
      expect(isConfident).toBe(false);
    });

    it("should return false for LOW severity with red flags", () => {
      const isConfident = isEdgeConfident(
        "low",
        0.85,
        ["chest pain", "shortness of breath"],
        "Patient with cardiac symptoms"
      );
      expect(isConfident).toBe(false);
    });

    it("should return true for HIGH severity with red flags and high confidence", () => {
      const isConfident = isEdgeConfident(
        "high",
        0.90,
        ["chest pain", "shortness of breath"],
        "Acute MI presentation"
      );
      expect(isConfident).toBe(true);
    });

    it("should return true for LOW severity with only minor symptoms", () => {
      const isConfident = isEdgeConfident(
        "low",
        0.85,
        ["sore throat", "mild headache"],
        "Viral URI"
      );
      expect(isConfident).toBe(true);
    });
  });

  describe("parseEdgeResponse", () => {
    it("should parse valid JSON response correctly", () => {
      const response = JSON.stringify({
        severity: "high",
        summary: "Acute chest pain",
        symptoms: ["chest pain", "shortness of breath"],
        differential: [
          { condition: "MI", probability: 80, recommendation: "ECG" },
        ],
        recommendations: ["ECG", "Troponins"],
        reasoning: "Classic presentation",
        confidence: 0.9,
      });

      const parsed = parseEdgeResponse(response);

      expect(parsed).not.toBeNull();
      expect(parsed?.severity).toBe("high");
      expect(parsed?.summary).toBe("Acute chest pain");
      expect(parsed?.symptoms).toHaveLength(2);
      expect(parsed?.differential).toHaveLength(1);
    });

    it("should handle lowercase severity", () => {
      const response = JSON.stringify({
        severity: "HIGH",
        summary: "Test",
        symptoms: [],
      });

      const parsed = parseEdgeResponse(response);
      expect(parsed?.severity).toBe("high");
    });

    it("should return null for invalid JSON without extractable fields", () => {
      const response = "This is not a valid response";
      const parsed = parseEdgeResponse(response);
      expect(parsed).toBeNull();
    });

    it("should extract data from non-JSON text format", () => {
      const response = `severity: high
summary: Patient with chest pain
Some other text`;

      const parsed = parseEdgeResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed?.severity).toBe("high");
      expect(parsed?.summary).toBe("Patient with chest pain");
    });

    it("should handle missing optional fields", () => {
      const response = JSON.stringify({
        severity: "low",
        summary: "Minor issue",
      });

      const parsed = parseEdgeResponse(response);
      expect(parsed?.symptoms).toEqual([]);
      expect(parsed?.differential).toEqual([]);
      expect(parsed?.recommendations).toEqual([]);
    });
  });

  describe("parseCloudResponse", () => {
    it("should parse cloud result correctly", () => {
      const cloudResult = {
        symptoms: "Chest pain and shortness of breath",
        diagnosis_draft: "Possible MI",
        critique: "Good differential",
        final_output: JSON.stringify({
          severity: "high",
          summary: "Acute coronary syndrome",
          symptoms: ["chest pain", "shortness of breath"],
        }),
      };

      const result = parseCloudResponse(cloudResult, 1500);

      expect(result.source).toBe("cloud");
      expect(result.severity).toBe("high");
      expect(result.confidence).toBe(0.75);
      expect(result.inferenceTime).toBe(1500);
    });

    it("should handle non-JSON final_output", () => {
      const cloudResult = {
        symptoms: "Symptoms here",
        diagnosis_draft: "Draft",
        critique: "Critique",
        final_output: "Plain text summary",
      };

      const result = parseCloudResponse(cloudResult, 1000);

      expect(result.summary).toBe("Plain text summary");
      expect(result.symptoms).toEqual(["Symptoms here"]);
    });
  });

  describe("analyzeHybrid - Edge-only path", () => {
    it("should return edge result when confident (HIGH with red flags)", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const edgeResponse = {
        response: JSON.stringify({
          severity: "high",
          summary: "Acute MI presentation",
          symptoms: ["chest pain", "shortness of breath", "diaphoresis"],
          differential: [{ condition: "MI", probability: 85, recommendation: "ECG" }],
          recommendations: ["ECG", "Troponins"],
          reasoning: "Classic presentation",
        }),
        tokensGenerated: 150,
        inferenceTime: 800,
        severity: "high" as const,
        calibrated: false,
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);

      const result = await analyzeHybrid("Patient with chest pain and shortness of breath");

      expect(result.source).toBe("edge");
      expect(result.severity).toBe("high");
      expect(result.confidence).toBeGreaterThanOrEqual(0.70);
      expect(vi.mocked(analyzeCaseCloud)).not.toHaveBeenCalled();
    });

    it("should return edge result when confident (LOW with minor symptoms)", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const edgeResponse = {
        response: JSON.stringify({
          severity: "low",
          summary: "Viral URI",
          symptoms: ["sore throat", "mild cough"],
          differential: [{ condition: "Viral URI", probability: 90, recommendation: "Supportive care" }],
          recommendations: ["Rest", "Fluids"],
          reasoning: "Minor symptoms",
        }),
        tokensGenerated: 100,
        inferenceTime: 500,
        severity: "low" as const,
        calibrated: false,
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);

      const result = await analyzeHybrid("Sore throat and mild cough");

      expect(result.source).toBe("edge");
      expect(result.severity).toBe("low");
      expect(vi.mocked(analyzeCaseCloud)).not.toHaveBeenCalled();
    });
  });

  describe("analyzeHybrid - Fallback path", () => {
    it("should fallback to cloud when edge returns MEDIUM severity", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "medium",
          summary: "Uncertain presentation",
          symptoms: ["abdominal pain"],
          differential: [],
          recommendations: [],
          reasoning: "Unclear",
        }),
        tokensGenerated: 120,
        inferenceTime: 600,
        severity: "medium" as const,
        calibrated: false,
      };

      const cloudResult = {
        symptoms: "Abdominal pain",
        diagnosis_draft: "Possible appendicitis",
        critique: "Consider imaging",
        final_output: JSON.stringify({
          severity: "high",
          summary: "Possible appendicitis",
          symptoms: ["abdominal pain", "fever"],
        }),
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);
      mockAnalyzeCaseCloud.mockResolvedValueOnce(cloudResult);

      const result = await analyzeHybrid("Abdominal pain");

      expect(result.source).toBe("cloud");
      expect(result.fallbackReason).toContain("uncertain");
      expect(result.fallbackReason).toContain("medium");
    });

    it("should fallback to cloud when edge confidence is low", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "high", // High but without red flags = low confidence
          summary: "Unclear",
          symptoms: ["fatigue"],
          differential: [],
          recommendations: [],
          reasoning: "",
        }),
        tokensGenerated: 80,
        inferenceTime: 400,
        severity: "high" as const,
        calibrated: false,
      };

      const cloudResult = {
        symptoms: "Fatigue",
        diagnosis_draft: "Fatigue workup",
        critique: "More info needed",
        final_output: JSON.stringify({
          severity: "low",
          summary: "Fatigue, likely benign",
          symptoms: ["fatigue"],
        }),
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);
      mockAnalyzeCaseCloud.mockResolvedValueOnce(cloudResult);

      const result = await analyzeHybrid("Feeling tired");

      expect(result.source).toBe("cloud");
      expect(mockAnalyzeCaseCloud).toHaveBeenCalled();
    });

    it("should include fallback reason when using cloud", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "medium",
          summary: "Uncertain",
          symptoms: ["pain"],
          differential: [],
          recommendations: [],
          reasoning: "",
        }),
        tokensGenerated: 50,
        inferenceTime: 300,
        severity: "medium" as const,
        calibrated: false,
      };

      const cloudResult = {
        symptoms: "Pain",
        diagnosis_draft: "Pain",
        critique: "Critique",
        final_output: JSON.stringify({ severity: "low", summary: "Minor" }),
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);
      mockAnalyzeCaseCloud.mockResolvedValueOnce(cloudResult);

      const result = await analyzeHybrid("Pain");

      expect(result.fallbackReason).toBeDefined();
      expect(result.fallbackReason?.length).toBeGreaterThan(0);
    });
  });

  describe("analyzeHybrid - Failure path", () => {
    it("should fallback to cloud when edge throws error", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      mockRunEdgeInference.mockRejectedValueOnce(new Error("Model not loaded"));

      const cloudResult = {
        symptoms: "Symptoms",
        diagnosis_draft: "Draft",
        critique: "Critique",
        final_output: JSON.stringify({
          severity: "medium",
          summary: "Summary",
          symptoms: ["symptom"],
        }),
      };

      mockAnalyzeCaseCloud.mockResolvedValueOnce(cloudResult);

      const result = await analyzeHybrid("Test symptoms");

      expect(result.source).toBe("cloud");
      expect(result.fallbackReason).toContain("Edge failed");
    });

    it("should return edge result as last resort when both fail", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "medium",
          summary: "Uncertain but only option",
          symptoms: ["symptom"],
          differential: [],
          recommendations: [],
          reasoning: "",
        }),
        tokensGenerated: 100,
        inferenceTime: 500,
        severity: "medium" as const,
        calibrated: false,
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);
      mockAnalyzeCaseCloud.mockRejectedValueOnce(new Error("Cloud unavailable"));

      const result = await analyzeHybrid("Test");

      expect(result.source).toBe("edge");
      expect(result.fallbackReason).toContain("Cloud failed");
    });

    it("should throw error when both edge and cloud fail with no edge result", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      mockRunEdgeInference.mockRejectedValueOnce(new Error("Edge crashed"));
      mockAnalyzeCaseCloud.mockRejectedValueOnce(new Error("Cloud down"));

      await expect(analyzeHybrid("Test")).rejects.toThrow("Hybrid analysis failed");
    });
  });

  describe("predictAnalysisSource", () => {
    it("should predict cloud for complex presentations", async () => {
      const prediction = await predictAnalysisSource(
        "Patient has a complex history of multiple chronic conditions including diabetes, hypertension, and a previous myocardial infarction with recurring symptoms"
      );

      expect(prediction.likelySource).toBe("cloud");
    });

    it("should predict edge for clear red flags", async () => {
      const prediction = await predictAnalysisSource(
        "Chest pain, shortness of breath, sweating"
      );

      expect(prediction.likelySource).toBe("edge");
    });

    it("should predict edge for minor symptoms", async () => {
      const prediction = await predictAnalysisSource(
        "Sore throat, mild headache, runny nose"
      );

      expect(prediction.likelySource).toBe("edge");
    });

    it("should predict cloud for uncertain presentations", async () => {
      const prediction = await predictAnalysisSource(
        "Atypical neurological episodes with visual disturbances and occasional tingling in extremities"
      );

      expect(prediction.likelySource).toBe("cloud");
    });
  });

  describe("Integration - Full workflow", () => {
    it("should complete full hybrid workflow and return consistent result structure", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "low",
          summary: "Viral URI",
          symptoms: ["sore throat", "cough"],
          differential: [
            { condition: "Viral URI", probability: 85, recommendation: "Rest" },
          ],
          recommendations: ["Rest", "Fluids"],
          reasoning: "Minor symptoms",
        }),
        tokensGenerated: 120,
        inferenceTime: 500,
        severity: "low" as const,
        calibrated: false,
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);

      const result = await analyzeHybrid("Sore throat and cough");

      // Verify result structure
      expect(result).toHaveProperty("symptoms");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("differential");
      expect(result).toHaveProperty("recommendations");
      expect(result).toHaveProperty("reasoning");
      expect(result).toHaveProperty("fullResponse");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("wasCalibrated");
      expect(result).toHaveProperty("inferenceTime");

      // Verify types
      expect(Array.isArray(result.symptoms)).toBe(true);
      expect(["low", "medium", "high"]).toContain(result.severity);
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should track latency correctly in fallback scenario", async () => {
      const mockRunEdgeInference = vi.mocked(runEdgeInference);
      const mockAnalyzeCaseCloud = vi.mocked(analyzeCaseCloud);

      const edgeResponse = {
        response: JSON.stringify({
          severity: "medium",
          summary: "Uncertain",
          symptoms: ["pain"],
          differential: [],
          recommendations: [],
          reasoning: "",
        }),
        tokensGenerated: 50,
        inferenceTime: 200,
        severity: "medium" as const,
        calibrated: false,
      };

      const cloudResult = {
        symptoms: "Pain",
        diagnosis_draft: "Diagnosis",
        critique: "Critique",
        final_output: JSON.stringify({ severity: "low", summary: "Minor pain" }),
      };

      mockRunEdgeInference.mockResolvedValueOnce(edgeResponse);
      mockAnalyzeCaseCloud.mockResolvedValueOnce(cloudResult);

      const result = await analyzeHybrid("Pain");

      expect(result.source).toBe("cloud");
      // Verify that inference time is tracked (non-negative number)
      expect(result.inferenceTime).toBeGreaterThanOrEqual(0);
      // Verify cloudLatency is set (edge latency is not present in cloud result)
      expect(result.cloudLatency).toBeDefined();
    });
  });
});
