import { describe, it, expect } from "vitest";
import {
  calibrateSeverity,
  hasRedFlags,
  hasOnlyMinorSymptoms,
  countRedFlags,
  calibrateSeverityBatch,
  getCalibrationStats,
  RED_FLAG_KEYWORDS,
  MINOR_SYMPTOM_KEYWORDS,
  URGENT_BUT_STABLE_KEYWORDS,
  type SeverityLevel,
} from "./calibration";

describe("calibration module", () => {
  describe("hasRedFlags", () => {
    it("detects red flags in symptoms array", () => {
      expect(hasRedFlags(["chest pain", "shortness of breath"])).toBe(true);
      expect(hasRedFlags(["stroke", "facial droop"])).toBe(true);
      expect(hasRedFlags(["unconscious", "not responding"])).toBe(true);
    });

    it("detects red flags in summary text", () => {
      expect(hasRedFlags([], "Patient presents with chest pain radiating to arm")).toBe(true);
      expect(hasRedFlags([], "Suspected stroke with slurred speech")).toBe(true);
    });

    it("returns false for minor symptoms only", () => {
      expect(hasRedFlags(["sore throat", "mild headache"])).toBe(false);
      expect(hasRedFlags(["rash", "itching"])).toBe(false);
      expect(hasRedFlags(["runny nose", "sneezing"])).toBe(false);
    });

    it("is case insensitive", () => {
      expect(hasRedFlags(["CHEST PAIN"])).toBe(true);
      expect(hasRedFlags(["STROKE"])).toBe(true);
      expect(hasRedFlags([], "Patient has SEVERE ALLERGIC REACTION")).toBe(true);
    });

    it("handles empty input", () => {
      expect(hasRedFlags([])).toBe(false);
      expect(hasRedFlags([], "")).toBe(false);
    });

    it("detects multiple red flag keywords", () => {
      const symptoms = ["chest pain", "shortness of breath", "sweating"];
      expect(hasRedFlags(symptoms)).toBe(true);
    });
  });

  describe("hasOnlyMinorSymptoms", () => {
    it("returns true for minor symptoms only", () => {
      expect(hasOnlyMinorSymptoms(["sore throat", "mild headache"])).toBe(true);
      expect(hasOnlyMinorSymptoms(["rash", "itching"])).toBe(true);
      expect(hasOnlyMinorSymptoms(["runny nose", "nasal congestion"])).toBe(true);
    });

    it("returns false when red flags present", () => {
      expect(hasOnlyMinorSymptoms(["sore throat", "chest pain"])).toBe(false);
      expect(hasOnlyMinorSymptoms(["mild headache", "stroke"])).toBe(false);
    });

    it("returns false when urgent-but-stable symptoms present", () => {
      expect(hasOnlyMinorSymptoms(["sore throat", "fracture"])).toBe(false);
      expect(hasOnlyMinorSymptoms(["mild headache", "broken bone"])).toBe(false);
    });

    it("handles empty input", () => {
      expect(hasOnlyMinorSymptoms([])).toBe(false);
    });

    it("checks summary text as well", () => {
      expect(hasOnlyMinorSymptoms(["sore throat"], "Patient has mild headache")).toBe(true);
      expect(hasOnlyMinorSymptoms(["sore throat"], "Patient has chest pain")).toBe(false);
    });
  });

  describe("countRedFlags", () => {
    it("counts matching red flag keywords", () => {
      expect(countRedFlags(["chest pain", "shortness of breath"])).toBe(2);
      expect(countRedFlags(["stroke", "facial droop", "slurred speech"])).toBe(3);
    });

    it("returns 0 for no red flags", () => {
      expect(countRedFlags(["sore throat", "mild headache"])).toBe(0);
    });

    it("counts unique keywords only (not duplicates)", () => {
      // Note: Each keyword is checked independently, so this tests the actual matching
      expect(countRedFlags(["chest pain", "chest tightness"])).toBe(2);
    });
  });

  describe("calibrateSeverity", () => {
    describe("HIGH severity calibration", () => {
      it("downgrades HIGH to MEDIUM when no red flags but urgent symptoms present", () => {
        const result = calibrateSeverity("high", ["fracture", "severe localized pain"]);
        
        expect(result.severity).toBe("medium");
        expect(result.originalSeverity).toBe("high");
        expect(result.wasCalibrated).toBe(true);
        expect(result.note).toContain("calibrated-down");
        expect(result.note).toContain("urgent but stable");
      });

      it("downgrades HIGH to LOW when only minor symptoms", () => {
        const result = calibrateSeverity("high", ["sore throat", "mild headache"]);
        
        expect(result.severity).toBe("low");
        expect(result.originalSeverity).toBe("high");
        expect(result.wasCalibrated).toBe(true);
        expect(result.note).toContain("calibrated-down");
        expect(result.note).toContain("only minor symptoms");
      });

      it("keeps HIGH when red flags are present", () => {
        const result = calibrateSeverity("high", ["chest pain", "shortness of breath"]);
        
        expect(result.severity).toBe("high");
        expect(result.originalSeverity).toBe("high");
        expect(result.wasCalibrated).toBe(false);
        expect(result.note).toBeUndefined();
      });

      it("keeps HIGH for stroke symptoms", () => {
        const result = calibrateSeverity("high", ["facial droop", "slurred speech"]);
        
        expect(result.severity).toBe("high");
        expect(result.wasCalibrated).toBe(false);
      });

      it("checks summary text for red flags", () => {
        const result = calibrateSeverity(
          "high",
          ["some symptoms"],
          "Patient presents with stroke-like symptoms"
        );
        
        expect(result.severity).toBe("high");
        expect(result.wasCalibrated).toBe(false);
      });
    });

    describe("MEDIUM severity calibration", () => {
      it("downgrades MEDIUM to LOW when only minor symptoms", () => {
        const result = calibrateSeverity("medium", ["sore throat", "mild headache"]);
        
        expect(result.severity).toBe("low");
        expect(result.originalSeverity).toBe("medium");
        expect(result.wasCalibrated).toBe(true);
        expect(result.note).toContain("calibrated-down");
        expect(result.note).toContain("only minor symptoms");
      });

      it("keeps MEDIUM when red flags present (never upgrades)", () => {
        // Even with red flags, we don't upgrade from medium
        const result = calibrateSeverity("medium", ["chest pain", "sore throat"]);
        
        expect(result.severity).toBe("medium");
        expect(result.wasCalibrated).toBe(false);
      });

      it("keeps MEDIUM for urgent-but-stable symptoms", () => {
        const result = calibrateSeverity("medium", ["fracture", "sprain"]);
        
        expect(result.severity).toBe("medium");
        expect(result.wasCalibrated).toBe(false);
      });
    });

    describe("LOW severity (never upgrades)", () => {
      it("keeps LOW even with red flags (conservative approach)", () => {
        const result = calibrateSeverity("low", ["chest pain", "shortness of breath"]);
        
        expect(result.severity).toBe("low");
        expect(result.wasCalibrated).toBe(false);
      });

      it("keeps LOW for minor symptoms", () => {
        const result = calibrateSeverity("low", ["sore throat"]);
        
        expect(result.severity).toBe("low");
        expect(result.wasCalibrated).toBe(false);
      });
    });

    describe("Edge cases", () => {
      it("handles empty symptoms array", () => {
        const result = calibrateSeverity("high", []);
        
        expect(result.severity).toBe("low"); // No symptoms = downgraded
        expect(result.wasCalibrated).toBe(true);
      });

      it("handles symptoms with mixed cases", () => {
        const result = calibrateSeverity("high", ["CHEST PAIN", "Shortness of Breath"]);
        
        expect(result.severity).toBe("high");
        expect(result.wasCalibrated).toBe(false);
      });

      it("is case insensitive for matching", () => {
        const result = calibrateSeverity("high", ["STROKE", "Facial Droop"]);
        
        expect(result.severity).toBe("high");
      });
    });
  });

  describe("calibrateSeverityBatch", () => {
    it("processes multiple cases at once", () => {
      const cases = [
        { predictedSeverity: "high" as SeverityLevel, symptoms: ["chest pain"] },
        { predictedSeverity: "high" as SeverityLevel, symptoms: ["sore throat"] },
        { predictedSeverity: "medium" as SeverityLevel, symptoms: ["mild headache"] },
      ];

      const results = calibrateSeverityBatch(cases);

      expect(results).toHaveLength(3);
      expect(results[0].severity).toBe("high"); // chest pain = red flag
      expect(results[0].wasCalibrated).toBe(false);
      expect(results[1].severity).toBe("low"); // sore throat = minor, downgraded
      expect(results[1].wasCalibrated).toBe(true);
      expect(results[2].severity).toBe("low"); // mild headache = minor, downgraded
      expect(results[2].wasCalibrated).toBe(true);
    });

    it("handles empty batch", () => {
      const results = calibrateSeverityBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe("getCalibrationStats", () => {
    it("calculates statistics correctly", () => {
      const results = [
        { severity: "high", originalSeverity: "high", wasCalibrated: false },
        { severity: "low", originalSeverity: "high", wasCalibrated: true },
        { severity: "low", originalSeverity: "medium", wasCalibrated: true },
        { severity: "medium", originalSeverity: "medium", wasCalibrated: false },
      ];

      const stats = getCalibrationStats(results);

      expect(stats.total).toBe(4);
      expect(stats.calibrated).toBe(2);
      expect(stats.downgraded).toBe(2);
      expect(stats.calibrationRate).toBe(50);
      expect(stats.downgradeRate).toBe(50);
      expect(stats.severityDistribution).toEqual({
        low: 2,
        medium: 1,
        high: 1,
      });
    });

    it("handles empty results", () => {
      const stats = getCalibrationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.calibrationRate).toBe(0);
      expect(stats.downgradeRate).toBe(0);
    });

    it("calculates 100% calibration rate when all calibrated", () => {
      const results = [
        { severity: "low", originalSeverity: "high", wasCalibrated: true },
        { severity: "medium", originalSeverity: "high", wasCalibrated: true },
      ];

      const stats = getCalibrationStats(results);

      expect(stats.calibrationRate).toBe(100);
      expect(stats.downgradeRate).toBe(100);
    });
  });

  describe("keyword lists", () => {
    it("RED_FLAG_KEYWORDS contains expected critical conditions", () => {
      expect(RED_FLAG_KEYWORDS).toContain("stroke");
      expect(RED_FLAG_KEYWORDS).toContain("chest pain");
      expect(RED_FLAG_KEYWORDS).toContain("unconscious");
      expect(RED_FLAG_KEYWORDS).toContain("severe trauma");
      expect(RED_FLAG_KEYWORDS.length).toBeGreaterThan(20);
    });

    it("MINOR_SYMPTOM_KEYWORDS contains expected minor conditions", () => {
      expect(MINOR_SYMPTOM_KEYWORDS).toContain("sore throat");
      expect(MINOR_SYMPTOM_KEYWORDS).toContain("mild headache");
      expect(MINOR_SYMPTOM_KEYWORDS).toContain("rash");
      expect(MINOR_SYMPTOM_KEYWORDS.length).toBeGreaterThan(10);
    });

    it("URGENT_BUT_STABLE_KEYWORDS contains expected medium conditions", () => {
      expect(URGENT_BUT_STABLE_KEYWORDS).toContain("fracture");
      expect(URGENT_BUT_STABLE_KEYWORDS).toContain("broken bone");
      expect(URGENT_BUT_STABLE_KEYWORDS).toContain("asthma");
      expect(URGENT_BUT_STABLE_KEYWORDS.length).toBeGreaterThan(5);
    });
  });

  describe("real-world scenarios", () => {
    it("handles cardiac emergency correctly", () => {
      const result = calibrateSeverity(
        "high",
        ["chest pain", "shortness of breath", "sweating"],
        "55-year-old male with chest pain radiating to left arm"
      );

      expect(result.severity).toBe("high");
      expect(result.wasCalibrated).toBe(false);
    });

    it("handles stroke symptoms correctly", () => {
      const result = calibrateSeverity(
        "high",
        ["facial droop", "slurred speech", "arm weakness"],
        "Sudden onset of neurological symptoms"
      );

      expect(result.severity).toBe("high");
      expect(result.wasCalibrated).toBe(false);
    });

    it("handles common cold symptoms correctly", () => {
      const result = calibrateSeverity(
        "high",
        ["sore throat", "runny nose", "mild cough"],
        "Patient reports cold-like symptoms for 2 days"
      );

      expect(result.severity).toBe("low");
      expect(result.wasCalibrated).toBe(true);
      expect(result.note).toContain("only minor symptoms");
    });

    it("handles fracture correctly", () => {
      const result = calibrateSeverity(
        "high",
        ["fracture", "severe localized pain"],
        "Fall resulting in suspected arm fracture"
      );

      expect(result.severity).toBe("medium");
      expect(result.wasCalibrated).toBe(true);
      expect(result.note).toContain("urgent but stable");
    });

    it("handles allergic reaction without anaphylaxis", () => {
      const result = calibrateSeverity(
        "high",
        ["rash", "itching"],
        "Localized rash after contact with plant"
      );

      expect(result.severity).toBe("low");
      expect(result.wasCalibrated).toBe(true);
    });

    it("handles anaphylaxis correctly", () => {
      const result = calibrateSeverity(
        "high",
        ["anaphylaxis", "difficulty breathing"],
        "Severe allergic reaction with respiratory distress"
      );

      expect(result.severity).toBe("high");
      expect(result.wasCalibrated).toBe(false);
    });
  });
});
