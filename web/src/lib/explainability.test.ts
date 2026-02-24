import { describe, it, expect } from "vitest";
import {
  calculateFeatureAttributions,
  generateReasoningChain,
  generateCounterfactuals,
  generateExplanation,
} from "./explainability";

describe("explainability module", () => {
  describe("calculateFeatureAttributions", () => {
    it("extracts feature attributions from clinical text", () => {
      const text = "Patient presents with chest pain and shortness of breath";
      const attributions = calculateFeatureAttributions(text, "high");
      
      expect(attributions.length).toBeGreaterThan(0);
      expect(attributions[0]).toHaveProperty("feature");
      expect(attributions[0]).toHaveProperty("importance");
      expect(attributions[0]).toHaveProperty("direction");
    });

    it("assigns higher importance to red flag symptoms", () => {
      const text = "Chest pain with radiating pain to arm and diaphoresis";
      const attributions = calculateFeatureAttributions(text, "high");
      
      const chestPain = attributions.find(a => a.feature === "chest pain");
      const diaphoresis = attributions.find(a => a.feature === "diaphoresis");
      
      expect(chestPain).toBeDefined();
      expect(chestPain!.importance).toBeGreaterThan(0.7);
      expect(chestPain!.direction).toBe("increases");
    });

    it("assigns negative importance to low-severity indicators", () => {
      const text = "Mild sore throat with fatigue, stable condition";
      const attributions = calculateFeatureAttributions(text, "low");
      
      const lowSeverityAttrs = attributions.filter(a => a.importance < 0);
      expect(lowSeverityAttrs.length).toBeGreaterThan(0);
    });

    it("sorts attributions by absolute importance", () => {
      const text = "Chest pain, fever, sore throat, fatigue";
      const attributions = calculateFeatureAttributions(text, "medium");
      
      for (let i = 1; i < attributions.length; i++) {
        expect(Math.abs(attributions[i].importance)).toBeLessThanOrEqual(
          Math.abs(attributions[i - 1].importance)
        );
      }
    });
  });

  describe("generateReasoningChain", () => {
    it("generates complete reasoning chain", () => {
      const symptoms = ["chest pain", "shortness of breath"];
      const chain = generateReasoningChain(symptoms, "high", "High priority triage");
      
      expect(chain.length).toBeGreaterThan(0);
      expect(chain[0].type).toBe("observation");
      expect(chain[chain.length - 1].type).toBe("conclusion");
    });

    it("includes evidence step when citations provided", () => {
      const symptoms = ["chest pain"];
      const citations = [
        { id: "ref1", source: "medical_db", snippet: "Evidence text" }
      ];
      const chain = generateReasoningChain(symptoms, "high", "Summary", citations);
      
      const evidenceStep = chain.find(s => s.type === "evidence");
      expect(evidenceStep).toBeDefined();
      expect(evidenceStep?.citations).toContain("ref1");
    });

    it("includes warning step for high severity", () => {
      const symptoms = ["stroke symptoms"];
      const chain = generateReasoningChain(symptoms, "high", "Urgent");
      
      const warningStep = chain.find(s => s.type === "warning");
      expect(warningStep).toBeDefined();
    });

    it("assigns confidence values to all steps", () => {
      const chain = generateReasoningChain(["symptom"], "medium", "Summary");
      
      chain.forEach(step => {
        expect(step.confidence).toBeGreaterThan(0);
        expect(step.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("generateCounterfactuals", () => {
    it("generates counterfactual for high severity case", () => {
      const symptoms = ["chest pain", "shortness of breath", "diaphoresis"];
      const counterfactuals = generateCounterfactuals(symptoms, "high");
      
      expect(counterfactuals.length).toBeGreaterThan(0);
      expect(counterfactuals[0].originalPrediction).toBe("high");
      expect(counterfactuals[0].counterfactualPrediction).toBe("medium");
    });

    it("generates counterfactual for low severity case", () => {
      const symptoms = ["mild headache"];
      const counterfactuals = generateCounterfactuals(symptoms, "low");
      
      expect(counterfactuals.length).toBeGreaterThan(0);
      expect(counterfactuals[0].originalPrediction).toBe("low");
      expect(counterfactuals[0].counterfactualPrediction).toBe("high");
    });

    it("includes explanation for each counterfactual", () => {
      const counterfactuals = generateCounterfactuals(["chest pain"], "high");
      
      counterfactuals.forEach(cf => {
        expect(cf.explanation).toBeTruthy();
        expect(cf.explanation.length).toBeGreaterThan(20);
      });
    });
  });

  describe("generateExplanation", () => {
    it("generates complete explainability result", () => {
      const text = "Patient with chest pain and shortness of breath";
      const symptoms = ["chest pain", "shortness of breath"];
      
      const result = generateExplanation(text, symptoms, "high", "High priority case");
      
      expect(result.featureAttributions.length).toBeGreaterThan(0);
      expect(result.reasoningChain.length).toBeGreaterThan(0);
      expect(result.keyFactors.length).toBeLessThanOrEqual(3);
      expect(result.globalExplanation).toBeTruthy();
      expect(result.clinicalRationale).toBeTruthy();
    });

    it("extracts top 3 key factors", () => {
      const text = "Chest pain, fever, headache, fatigue, nausea";
      const symptoms = ["chest pain", "fever", "headache", "fatigue", "nausea"];
      
      const result = generateExplanation(text, symptoms, "medium", "Summary");
      
      expect(result.keyFactors.length).toBeLessThanOrEqual(3);
    });

    it("generates appropriate rationale for each severity", () => {
      const highResult = generateExplanation("chest pain", ["chest pain"], "high", "High");
      const lowResult = generateExplanation("headache", ["headache"], "low", "Low");
      
      expect(highResult.clinicalRationale).toContain("life-threatening");
      expect(lowResult.clinicalRationale).toContain("non-urgent");
    });
  });
});
