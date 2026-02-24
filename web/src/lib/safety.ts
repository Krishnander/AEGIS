// Re-exports from safety-enhanced for backward compatibility.

// Re-export legacy API from enhanced module
export {
  detectUnsafeIntent,
  scrubPII,
  validateClinicalOutput,
  type SafetyAssessment,
} from "./safety-enhanced";
