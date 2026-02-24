import { describe, it, expect } from "vitest";
import {
  classifyEuAiActRisk,
  classifyFdaSaMD,
  generateRequiredDisclosures,
  assessHipaaCompliance,
  createAuditLogEntry,
  performRegulatoryAssessment,
  requiresHumanConfirmation,
} from "./regulatory-compliance";

describe("regulatory-compliance module", () => {
  describe("classifyEuAiActRisk", () => {
    it("classifies medical devices as high risk", () => {
      const result = classifyEuAiActRisk(
        "medical-devices",
        "clinical-decision-support",
        false
      );
      
      expect(result.riskCategory).toBe("high");
      expect(result.humanOversightRequired).toBe(true);
      expect(result.obligations.length).toBeGreaterThan(0);
    });
    
    it("classifies safety components as high risk", () => {
      const result = classifyEuAiActRisk(
        "generic",
        "monitoring",
        true
      );
      
      expect(result.riskCategory).toBe("high");
    });
    
    it("classifies chatbots as limited risk", () => {
      const result = classifyEuAiActRisk(
        "customer-service",
        "chatbot-assistant",
        false
      );
      
      expect(result.riskCategory).toBe("limited");
      expect(result.transparencyRequired).toBe(true);
    });
    
    it("classifies general AI as minimal risk", () => {
      const result = classifyEuAiActRisk(
        "entertainment",
        "game-ai",
        false
      );
      
      expect(result.riskCategory).toBe("minimal");
    });
  });
  
  describe("classifyFdaSaMD", () => {
    it("classifies critical treat-diagnose as Class IV", () => {
      const result = classifyFdaSaMD("treat-diagnose", "critical");
      
      expect(result.riskLevel).toBe("IV");
      expect(result.regulatoryPathway).toBe("PMA");
    });
    
    it("classifies serious drive-management as Class II", () => {
      const result = classifyFdaSaMD("drive-management", "serious");
      
      expect(result.riskLevel).toBe("II");
      expect(result.regulatoryPathway).toBe("510(k)");
    });
    
    it("classifies non-serious inform as Class I", () => {
      const result = classifyFdaSaMD("inform", "non-serious");
      
      expect(result.riskLevel).toBe("I");
      expect(result.regulatoryPathway).toBe("exempt");
    });
    
    it("enables PCCP for non-Class-IV devices", () => {
      const classII = classifyFdaSaMD("drive-management", "serious");
      const classIV = classifyFdaSaMD("treat-diagnose", "critical");
      
      expect(classII.predeterminedChangeControlApplicable).toBe(true);
      expect(classIV.predeterminedChangeControlApplicable).toBe(false);
    });
  });
  
  describe("generateRequiredDisclosures", () => {
    it("generates disclosure statements", () => {
      const modelInfo = {
        name: "TestModel",
        version: "1.0",
        provider: "TestCorp",
      };
      
      const disclosures = generateRequiredDisclosures(
        modelInfo,
        ["capability1"],
        ["limitation1"]
      );
      
      expect(disclosures.length).toBeGreaterThan(0);
      expect(disclosures.some(d => d.includes("TestModel"))).toBe(true);
      expect(disclosures.some(d => d.includes("AI"))).toBe(true);
    });
  });
  
  describe("assessHipaaCompliance", () => {
    it("requires encryption for cloud processing", () => {
      const result = assessHipaaCompliance({
        localProcessing: false,
        cloudProcessing: true,
        dataRetention: false,
        auditLogging: true,
      });
      
      expect(result.encryptionRequired).toBe(true);
      expect(result.deIdentificationRequired).toBe(true);
    });
    
    it("requires encryption for data retention", () => {
      const result = assessHipaaCompliance({
        localProcessing: true,
        cloudProcessing: false,
        dataRetention: true,
        auditLogging: true,
      });
      
      expect(result.encryptionRequired).toBe(true);
    });
  });
  
  describe("createAuditLogEntry", () => {
    it("creates a valid audit log entry", () => {
      const entry = createAuditLogEntry(
        "inference",
        "test input",
        "test output",
        0.85
      );
      
      expect(entry.eventType).toBe("inference");
      expect(entry.confidenceScore).toBe(0.85);
      expect(entry.timestamp).toBeDefined();
      expect(entry.traceId).toBeDefined();
    });
    
    it("truncates long input/output", () => {
      const longText = "a".repeat(500);
      
      const entry = createAuditLogEntry(
        "decision",
        longText,
        longText,
        0.9
      );
      
      expect(entry.inputSummary.length).toBeLessThan(250);
      expect(entry.inputSummary.endsWith("...")).toBe(true);
    });
  });
  
  describe("performRegulatoryAssessment", () => {
    it("returns comprehensive assessment", () => {
      const assessment = performRegulatoryAssessment();
      
      expect(assessment.euAiActCompliance).toBeDefined();
      expect(assessment.fdaSaMDClassification).toBeDefined();
      expect(assessment.hipaaConsiderations).toBeDefined();
      expect(assessment.complianceScore).toBeGreaterThan(0);
      expect(assessment.requiredDisclosures.length).toBeGreaterThan(0);
    });
    
    it("provides recommendations", () => {
      const assessment = performRegulatoryAssessment();
      
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe("requiresHumanConfirmation", () => {
    it("requires confirmation for high severity", () => {
      const result = requiresHumanConfirmation("high", 0.95, []);
      
      expect(result.required).toBe(true);
      expect(result.urgency).toBe("immediate");
    });
    
    it("requires confirmation for low confidence", () => {
      const result = requiresHumanConfirmation("low", 0.5, []);
      
      expect(result.required).toBe(true);
      expect(result.urgency).toBe("before-action");
    });
    
    it("requires confirmation for safety flags", () => {
      const result = requiresHumanConfirmation("medium", 0.85, ["drug-interaction"]);
      
      expect(result.required).toBe(true);
    });
    
    it("does not require confirmation for standard cases", () => {
      const result = requiresHumanConfirmation("low", 0.9, []);
      
      expect(result.required).toBe(false);
    });
  });
});
