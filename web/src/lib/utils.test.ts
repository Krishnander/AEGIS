import { describe, it, expect } from "vitest";
import {
  cn,
  parseAIResponse,
  getSeverityColor,
  getSeverityBg,
  extractSymptomsFromText,
  formatSeverityForDisplay,
  sanitizeInput,
} from "./utils";

describe("utils.ts", () => {
  describe("cn (className helper)", () => {
    it("should merge class names correctly", () => {
      expect(cn("a", "b")).toBe("a b");
    });

    it("should handle conditional classes", () => {
      expect(cn("a", true && "b", false && "c")).toBe("a b");
    });

    it("should handle tailwind merge", () => {
      expect(cn("px-2 px-4")).toBe("px-4");
    });
  });

  describe("parseAIResponse", () => {
    it("should parse valid JSON response", () => {
      const response = JSON.stringify({
        symptoms: ["Chest Pain", "Shortness of Breath"],
        severity: "high",
        summary: "Patient presents with cardiac symptoms",
      });

      const result = parseAIResponse(response);

      expect(result.symptoms).toEqual(["Chest Pain", "Shortness of Breath"]);
      expect(result.severity).toBe("high");
      expect(result.severityRaw).toBe("high");
      expect(result.summary).toBe("Patient presents with cardiac symptoms");
    });

    it("should handle JSON with different severity case", () => {
      const response = JSON.stringify({
        symptoms: ["Headache"],
        severity: "MEDIUM",
        summary: "Test",
      });

      const result = parseAIResponse(response);

      expect(result.severity).toBe("medium");
    });

    it("should extract from text format with regex", () => {
      const response = `
        Symptoms: [Chest Pain, Shortness of Breath, Nausea]
        Severity: high
        Summary: Patient needs immediate attention
      `;

      const result = parseAIResponse(response);

      expect(result.symptoms).toContain("Chest Pain");
      expect(result.symptoms).toContain("Shortness of Breath");
      expect(result.symptoms).toContain("Nausea");
      expect(result.severity).toBe("high");
      expect(result.severityRaw).toBe("high");
      expect(result.summary).toContain("Patient needs immediate attention");
    });

    it("should default to medium severity if not provided", () => {
      const response = JSON.stringify({
        symptoms: ["Test"],
        summary: "Test",
      });

      const result = parseAIResponse(response);

      expect(result.severity).toBe("medium");
    });

    it("should default to empty symptoms if not provided", () => {
      const response = JSON.stringify({
        severity: "high",
        summary: "Test",
      });

      const result = parseAIResponse(response);

      expect(result.symptoms).toEqual([]);
    });

    it("should handle invalid JSON gracefully", () => {
      const response = "This is not JSON at all";

      const result = parseAIResponse(response);

      expect(result.symptoms).toEqual([]);
      expect(result.severity).toBe("medium");
    });

    it("should handle empty response", () => {
      const result = parseAIResponse("");

      expect(result.symptoms).toEqual([]);
      expect(result.severity).toBe("medium");
    });

    it("should handle JSON with empty symptoms array", () => {
      const response = JSON.stringify({
        symptoms: [],
        severity: "low",
        summary: "No symptoms",
      });

      const result = parseAIResponse(response);

      expect(result.symptoms).toEqual([]);
      expect(result.severity).toBe("low");
    });

    it("should remove quotes from extracted symptoms", () => {
      const response = 'Symptoms: ["Chest Pain", "Shortness of Breath"]';

      const result = parseAIResponse(response);

      expect(result.symptoms).not.toContain('"');
    });
  });

  describe("getSeverityColor", () => {
    it("should return red for high severity", () => {
      expect(getSeverityColor("high")).toBe("text-red-400");
    });

    it("should return yellow for medium severity", () => {
      expect(getSeverityColor("medium")).toBe("text-yellow-400");
    });

    it("should return green for low severity", () => {
      expect(getSeverityColor("low")).toBe("text-green-400");
    });

    it("should return gray for unknown severity", () => {
      expect(getSeverityColor("unknown")).toBe("text-gray-400");
    });
  });

  describe("getSeverityBg", () => {
    it("should return red background for high severity", () => {
      expect(getSeverityBg("high")).toBe("bg-red-400/10 border-red-400/20");
    });

    it("should return yellow background for medium severity", () => {
      expect(getSeverityBg("medium")).toBe("bg-yellow-400/10 border-yellow-400/20");
    });

    it("should return green background for low severity", () => {
      expect(getSeverityBg("low")).toBe("bg-green-400/10 border-green-400/20");
    });

    it("should return gray background for unknown severity", () => {
      expect(getSeverityBg("unknown")).toBe("bg-gray-400/10 border-gray-400/20");
    });
  });

  describe("extractSymptomsFromText", () => {
    it("should extract symptoms from brackets", () => {
      const text = "Symptoms: [Chest Pain, Shortness of Breath]";
      const result = extractSymptomsFromText(text);

      expect(result).toContain("Chest Pain");
      expect(result).toContain("Shortness of Breath");
    });

    it("should return empty array if no symptoms found", () => {
      const text = "No symptoms here";
      const result = extractSymptomsFromText(text);

      expect(result).toEqual([]);
    });

    it("should handle comma-separated symptoms", () => {
      const text = "Chest Pain, Shortness of Breath, Nausea";
      const result = extractSymptomsFromText(text);

      expect(result).toContain("Chest Pain");
    });
  });

  describe("formatSeverityForDisplay", () => {
    it("should format high severity correctly", () => {
      expect(formatSeverityForDisplay("high")).toBe("HIGH PRIORITY");
    });

    it("should format medium severity correctly", () => {
      expect(formatSeverityForDisplay("medium")).toBe("MEDIUM PRIORITY");
    });

    it("should format low severity correctly", () => {
      expect(formatSeverityForDisplay("low")).toBe("LOW PRIORITY");
    });
  });

  describe("sanitizeInput", () => {
    it("should remove script tags", () => {
      const input = "<script>alert('xss')</script>Hello";
      const result = sanitizeInput(input);

      expect(result).not.toContain("<script>");
      expect(result).toContain("Hello");
    });

    it("should remove HTML tags", () => {
      const input = "<b>Bold</b> and <i>Italic</i>";
      const result = sanitizeInput(input);

      expect(result).not.toContain("<b>");
      expect(result).not.toContain("<i>");
      expect(result).toContain("Bold");
    });

    it("should handle normal text", () => {
      const input = "Normal text without tags";
      const result = sanitizeInput(input);

      expect(result).toBe("Normal text without tags");
    });

    it("should trim whitespace", () => {
      const input = "  spaces  ";
      const result = sanitizeInput(input);

      expect(result).toBe("spaces");
    });
  });
});

describe("Edge Cases", () => {
  it("should handle very long responses", () => {
    const longResponse = JSON.stringify({
      symptoms: Array(100).fill("Symptom"),
      severity: "high",
      summary: "A".repeat(10000),
    });

    const result = parseAIResponse(longResponse);

    expect(result.symptoms).toHaveLength(100);
    expect(result.summary).toHaveLength(10000);
  });

  it("should handle unicode characters", () => {
    const response = JSON.stringify({
      symptoms: ["Dolor de cabeza", "胸痛"],
      severity: "high",
      summary: "Test with unicode: 你好",
    });

    const result = parseAIResponse(response);

    expect(result.symptoms).toContain("Dolor de cabeza");
    expect(result.symptoms).toContain("胸痛");
  });

  it("should handle nested JSON structures", () => {
    const response = JSON.stringify({
      data: {
        symptoms: ["Test"],
        severity: "low",
      },
      extra: "data",
    });

    const result = parseAIResponse(response);

    expect(result.symptoms).toEqual(["Test"]);
    expect(result.severity).toBe("low");
  });
});
