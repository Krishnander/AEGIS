import { describe, it, expect } from "vitest";
import {
  checkDrugInteractions,
  checkPharmacogenomics,
  checkContraindications,
  detectBiasIndicators,
  extractMedications,
  performEnhancedSafetyAssessment,
} from "./safety-enhanced";

describe("safety-enhanced module", () => {
  describe("extractMedications", () => {
    it("extracts common medications from text", () => {
      const text = "Patient is on warfarin 5mg and aspirin 81mg daily";
      const meds = extractMedications(text);
      
      expect(meds).toContain("warfarin");
      expect(meds).toContain("aspirin");
    });

    it("handles case-insensitive extraction", () => {
      const text = "Started METFORMIN and Lisinopril";
      const meds = extractMedications(text);
      
      expect(meds).toContain("metformin");
      expect(meds).toContain("lisinopril");
    });

    it("returns empty array for text without medications", () => {
      const text = "Patient presents with chest pain";
      const meds = extractMedications(text);
      
      expect(meds).toEqual([]);
    });
  });

  describe("checkDrugInteractions", () => {
    it("detects warfarin-aspirin interaction", () => {
      const meds = ["warfarin", "aspirin"];
      const interactions = checkDrugInteractions(meds);
      
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0].severity).toBe("major");
    });

    it("detects clopidogrel-omeprazole interaction", () => {
      const meds = ["clopidogrel", "omeprazole"];
      const interactions = checkDrugInteractions(meds);
      
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0].drug1).toBe("clopidogrel");
    });

    it("returns empty array for non-interacting drugs", () => {
      const meds = ["acetaminophen", "vitamin d"];
      const interactions = checkDrugInteractions(meds);
      
      expect(interactions).toEqual([]);
    });
  });

  describe("checkPharmacogenomics", () => {
    it("detects CYP2C9 warfarin interaction", () => {
      const meds = ["warfarin"];
      const variants = [{ gene: "CYP2C9", variant: "*2/*3" }];
      
      const alerts = checkPharmacogenomics(meds, variants);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("HIGH");
      expect(alerts[0].drug).toBe("Warfarin");
    });

    it("detects CYP2C19 clopidogrel interaction", () => {
      const meds = ["clopidogrel"];
      const variants = [{ gene: "CYP2C19", variant: "*2" }];
      
      const alerts = checkPharmacogenomics(meds, variants);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alternativeDrugs).toContain("Prasugrel");
    });

    it("returns empty for drugs without PGx markers", () => {
      const meds = ["acetaminophen"];
      const variants = [{ gene: "CYP2C9", variant: "*2" }];
      
      const alerts = checkPharmacogenomics(meds, variants);
      
      expect(alerts).toEqual([]);
    });
  });

  describe("checkContraindications", () => {
    it("detects metformin contraindication with renal impairment", () => {
      const meds = ["metformin"];
      const conditions = ["eGFR < 30", "chronic kidney disease"];
      
      const alerts = checkContraindications(meds, conditions);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("absolute");
    });

    it("detects ACE inhibitor contraindication in pregnancy", () => {
      const meds = ["ACE inhibitors lisinopril"];
      const conditions = ["Pregnancy"];
      
      const alerts = checkContraindications(meds, conditions);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alternatives).toBeDefined();
    });
  });

  describe("detectBiasIndicators", () => {
    it("detects potential age bias", () => {
      const text = "Elderly patient unlikely to benefit from treatment";
      const indicators = detectBiasIndicators(text, { age: 75 });
      
      const ageBias = indicators.find(i => i.type === "age");
      expect(ageBias).toBeDefined();
      expect(ageBias?.detected).toBe(true);
    });

    it("returns no bias for neutral text", () => {
      const text = "Patient presents with chest pain";
      const indicators = detectBiasIndicators(text);
      
      const detected = indicators.filter(i => i.detected);
      expect(detected.length).toBe(0);
    });
  });

  describe("performEnhancedSafetyAssessment", () => {
    it("performs comprehensive safety check", () => {
      const text = "Patient on warfarin and aspirin presents with chest pain";
      
      const assessment = performEnhancedSafetyAssessment(text);
      
      expect(assessment.isUnsafe).toBe(false);
      expect(assessment.drugInteractions.length).toBeGreaterThan(0);
      expect(assessment.safetyScore).toBeDefined();
      expect(["safe", "caution", "warning", "critical"]).toContain(assessment.safetyLevel);
    });

    it("detects unsafe content", () => {
      const text = "Patient mentions self-harm ideation";
      
      const assessment = performEnhancedSafetyAssessment(text);
      
      expect(assessment.isUnsafe).toBe(true);
      expect(assessment.unsafeReasons.length).toBeGreaterThan(0);
      expect(assessment.safetyScore).toBeLessThanOrEqual(50);
    });

    it("flags overconfident language", () => {
      const text = "This is a definitive diagnosis with guaranteed outcome";
      
      const assessment = performEnhancedSafetyAssessment(text);
      
      expect(assessment.overconfidenceFlags.length).toBeGreaterThan(0);
    });

    it("includes pharmacogenomic alerts when variants provided", () => {
      const text = "Prescribing warfarin 5mg daily";
      const variants = [{ gene: "CYP2C9", variant: "*2/*3" }];
      
      const assessment = performEnhancedSafetyAssessment(text, variants);
      
      expect(assessment.pharmacogenomicAlerts.length).toBeGreaterThan(0);
    });

    it("calculates safety score correctly", () => {
      const safeText = "Patient with mild headache, stable vitals";
      const riskyText = "warfarin and aspirin with definitive diagnosis";
      
      const safeAssessment = performEnhancedSafetyAssessment(safeText);
      const riskyAssessment = performEnhancedSafetyAssessment(riskyText);
      
      expect(safeAssessment.safetyScore).toBeGreaterThan(riskyAssessment.safetyScore);
    });
  });
});
