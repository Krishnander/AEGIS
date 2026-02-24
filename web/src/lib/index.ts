// Barrel exports for lib/ modules.

// =============================================================================
// CORE UTILITIES
// =============================================================================

export {
  cn,
  parseAIResponse,
  extractSymptomsFromText,
  isHighSeverityAllowed,
  sanitizeInput,
} from "./utils";

// =============================================================================
// AI CONFIDENCE & CALIBRATION
// =============================================================================

export {
  calculateConfidence,
  calculateECE,
  calculateSeverityConfidence,
  formatConfidenceDisplay,
  type ConfidenceScore,
  type CalibrationBin,
  type CalibrationMetrics,
} from "./confidence";

// =============================================================================
// SAFETY & COMPLIANCE
// =============================================================================

export {
  // Legacy API (backward compatibility)
  detectUnsafeIntent,
  scrubPII,
  validateClinicalOutput,
  type SafetyAssessment,
  
  // Enhanced safety
  performEnhancedSafetyAssessment,
  checkDrugInteractions,
  checkPharmacogenomics,
  checkContraindications,
  detectBiasIndicators,
  extractMedications,
  type EnhancedSafetyAssessment,
  type DrugInteraction,
  type PharmacogenomicAlert,
  type ContraindicationAlert,
  type BiasIndicator,
} from "./safety-enhanced";

// =============================================================================
// UNCERTAINTY QUANTIFICATION
// =============================================================================

export {
  estimateMCDropoutUncertainty,
  estimateEnsembleUncertainty,
  detectOutOfDistribution,
  selectivePrediction,
  conformalPrediction,
  estimateComprehensiveUncertainty,
  simulateMCDropoutPredictions,
  type UncertaintyEstimate,
  type UncertaintyBreakdown,
  type UncertaintyRecommendation,
  type MCDropoutConfig,
  type SelectivePredictionResult,
  type ConformalPredictionSet,
} from "./uncertainty";

// =============================================================================
// EXPLAINABILITY
// =============================================================================

export {
  generateExplanation,
  calculateFeatureAttributions,
  generateReasoningChain,
  generateCounterfactuals,
  type ExplainabilityResult,
  type FeatureAttribution,
  type ReasoningStep,
  type CounterfactualExplanation,
} from "./explainability";

// =============================================================================
// REGULATORY COMPLIANCE
// =============================================================================

export {
  classifyEuAiActRisk,
  classifyFdaSaMD,
  generateRequiredDisclosures,
  assessHipaaCompliance,
  performRegulatoryAssessment,
  createAuditLogEntry,
  requiresHumanConfirmation,
  type RegulatoryAssessment,
  type EuAiActCompliance,
  type FdaSaMDClassification,
  type HipaaConsiderations,
  type AuditLogEntry,
} from "./regulatory-compliance";

// =============================================================================
// RESEARCH CITATIONS
// =============================================================================

export {
  ACADEMIC_CITATIONS,
  formatCitation,
  generateBibTeX,
  getCitationsForModule,
  type Citation,
} from "./research-citations";

// =============================================================================
// ORCHESTRATION & PIPELINE
// =============================================================================

export {
  orchestrateAnalysis,
  buildAugmentedPrompt,
  type OrchestratorResult,
  type GenerationCandidate,
} from "./orchestrator";

// =============================================================================
// METRICS & EVALUATION
// =============================================================================

export {
  summarizeComparison,
  type ModelComparisonSample,
  type ModelComparisonMetrics,
} from "./metrics";

// =============================================================================
// TELEMETRY
// =============================================================================

export { Telemetry } from "./telemetry";

// =============================================================================
// DATABASE
// =============================================================================

export {
  saveCase,
  getRecentCases,
  type Case,
  type GraphNode,
} from "./db";

// =============================================================================
// RETRIEVAL
// =============================================================================

export {
  hybridRetrieve,
  summarizeCitations,
  type HybridRetrievalResult,
} from "./retrieval";

// =============================================================================
// EDGE AI (MediaPipe)
// =============================================================================

export {
  initEdgeAI,
  runEdgeInference,
  subscribeToLoadProgress,
  type ModelLoadState,
} from "./mediapipe";

// =============================================================================
// API CLIENT
// =============================================================================

export {
  analyzeCaseCloud,
  isDemoMode,
} from "./api";
