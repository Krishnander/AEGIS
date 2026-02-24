import { describe, it, expect } from "vitest";
import { detectUnsafeIntent, scrubPII, validateClinicalOutput } from "./safety";

describe("safety", () => {
  it("detects unsafe phrases", () => {
    const res = detectUnsafeIntent("I want to commit self-harm");
    expect(res.unsafe).toBe(true);
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  it("scrubs PII tokens", () => {
    const scrubbed = scrubPII("Call me at 555-123-4567 or email test@example.com");
    expect(scrubbed).not.toMatch(/555-123-4567/);
    expect(scrubbed).toContain("[REDACTED]")
  });

  it("flags overconfident clinical language", () => {
    const res = validateClinicalOutput("This is a definitive diagnosis with 5mg", { unsafe: false, reasons: [], piiRedacted: false, validatorFindings: [] });
    expect(res.validatorFindings.some((f) => f.includes("dosage"))).toBe(true);
  });
});
