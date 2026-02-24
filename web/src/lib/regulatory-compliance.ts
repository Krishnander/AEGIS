/**
 * AEGIS Regulatory Compliance Module
 * 
 * Implements EU AI Act and FDA SaMD compliance features for high-risk medical AI.
 * Based on:
 * - EU AI Act (Regulation 2024/1689) - High-risk AI requirements
 * - FDA AI/ML-Based SaMD Action Plan (2021)
 * - HIPAA Privacy Rule considerations
 * 
 * @see https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1689
 * @see https://www.fda.gov/medical-devices/software-medical-device-samd
 */

export interface RegulatoryAssessment {
  euAiActCompliance: EuAiActCompliance;
  fdaSaMDClassification: FdaSaMDClassification;
  hipaaConsiderations: HipaaConsiderations;
  overallRiskLevel: "minimal" | "limited" | "high" | "unacceptable" | "prohibited";
  complianceScore: number;
  recommendations: string[];
  requiredDisclosures: string[];
}

export interface EuAiActCompliance {
  riskCategory: "minimal" | "limited" | "high" | "prohibited";
  obligations: string[];
  humanOversightRequired: boolean;
  transparencyRequired: boolean;
  documentationRequired: boolean;
  postMarketMonitoringRequired: boolean;
  conformityAssessmentPath: "self" | "notified-body";
}

export interface FdaSaMDClassification {
  riskLevel: "I" | "II" | "III" | "IV";
  regulatoryPathway: "510(k)" | "De Novo" | "PMA" | "exempt";
  intendedUse: string;
  significanceOfInformation: "treat-diagnose" | "drive-management" | "inform";
  healthcareSituation: "critical" | "serious" | "non-serious";
  predeterminedChangeControlApplicable: boolean;
}

export interface HipaaConsiderations {
  phiDetected: boolean;
  deIdentificationRequired: boolean;
  minimumNecessaryApplied: boolean;
  auditTrailEnabled: boolean;
  encryptionRequired: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  eventType: "inference" | "decision" | "override" | "access" | "modification";
  userId?: string;
  sessionId: string;
  inputSummary: string;
  outputSummary: string;
  confidenceScore: number;
  humanOverrideApplied: boolean;
  modelVersion: string;
  traceId: string;
}

// EU AI Act Article 6 - Classification rules for high-risk AI systems
const HIGH_RISK_DOMAINS = [
  "medical-devices",
  "safety-components",
  "biometric-identification",
  "critical-infrastructure",
  "education",
  "employment",
  "essential-services",
  "law-enforcement",
  "migration",
  "justice",
];

/**
 * Determine EU AI Act risk category based on intended use
 */
export function classifyEuAiActRisk(
  domain: string,
  intendedUse: string,
  isSafetyComponent: boolean
): EuAiActCompliance {
  const isHighRiskDomain = HIGH_RISK_DOMAINS.some(d => domain.includes(d));
  const isMedicalDevice = domain.includes("medical") || domain.includes("clinical");
  
  let riskCategory: "minimal" | "limited" | "high" | "prohibited" = "minimal";
  const obligations: string[] = [];
  
  if (isMedicalDevice || isSafetyComponent) {
    riskCategory = "high";
    obligations.push(
      "Risk management system (Art. 9)",
      "Data governance (Art. 10)",
      "Technical documentation (Art. 11)",
      "Record-keeping (Art. 12)",
      "Transparency (Art. 13)",
      "Human oversight (Art. 14)",
      "Accuracy & robustness (Art. 15)",
      "Conformity assessment (Art. 43)"
    );
  } else if (isHighRiskDomain) {
    riskCategory = "high";
    obligations.push(
      "Risk management system",
      "Data quality requirements",
      "Documentation requirements",
      "Human oversight measures"
    );
  } else if (intendedUse.includes("chatbot") || intendedUse.includes("generated")) {
    riskCategory = "limited";
    obligations.push(
      "Transparency: Users informed of AI interaction",
      "Clear labeling of AI-generated content"
    );
  }
  
  return {
    riskCategory,
    obligations,
    humanOversightRequired: riskCategory === "high",
    transparencyRequired: riskCategory !== "minimal",
    documentationRequired: riskCategory === "high",
    postMarketMonitoringRequired: riskCategory === "high",
    conformityAssessmentPath: riskCategory === "high" ? "notified-body" : "self",
  };
}

/**
 * Classify according to FDA SaMD risk framework
 * Based on IMDRF Software as Medical Device Framework
 */
export function classifyFdaSaMD(
  significance: "treat-diagnose" | "drive-management" | "inform",
  situation: "critical" | "serious" | "non-serious"
): FdaSaMDClassification {
  // FDA SaMD Risk Matrix
  const riskMatrix: Record<string, Record<string, "I" | "II" | "III" | "IV">> = {
    "treat-diagnose": {
      "critical": "IV",
      "serious": "III",
      "non-serious": "II",
    },
    "drive-management": {
      "critical": "III",
      "serious": "II",
      "non-serious": "I",
    },
    "inform": {
      "critical": "II",
      "serious": "I",
      "non-serious": "I",
    },
  };
  
  const riskLevel = riskMatrix[significance][situation];
  
  const pathwayMap: Record<string, "510(k)" | "De Novo" | "PMA" | "exempt"> = {
    "I": "exempt",
    "II": "510(k)",
    "III": "De Novo",
    "IV": "PMA",
  };
  
  return {
    riskLevel,
    regulatoryPathway: pathwayMap[riskLevel],
    intendedUse: "Clinical decision support for emergency triage",
    significanceOfInformation: significance,
    healthcareSituation: situation,
    predeterminedChangeControlApplicable: riskLevel !== "IV",
  };
}

/**
 * Generate required disclosures for transparency compliance
 */
export function generateRequiredDisclosures(
  modelInfo: { name: string; version: string; provider: string },
  capabilities: string[],
  limitations: string[]
): string[] {
  return [
    // EU AI Act Article 13 - Transparency
    `This system uses AI (${modelInfo.name} v${modelInfo.version}) provided by ${modelInfo.provider}.`,
    
    // Intended use
    `Intended use: Clinical decision support for emergency department triage prioritization.`,
    
    // Limitations
    `AI limitations: ${limitations.join("; ")}`,
    
    // Human oversight
    `All AI recommendations require review and validation by qualified healthcare professionals.`,
    
    // Not a replacement
    `This tool is intended to support, not replace, clinical judgment.`,
    
    // Confidence disclosure
    `Confidence scores indicate model certainty but do not guarantee accuracy.`,
    
    // Data usage
    `Patient data is processed locally when possible; no PHI is stored in cloud systems.`,
  ];
}

/**
 * Check HIPAA compliance considerations
 */
export function assessHipaaCompliance(
  dataFlow: {
    localProcessing: boolean;
    cloudProcessing: boolean;
    dataRetention: boolean;
    auditLogging: boolean;
  }
): HipaaConsiderations {
  return {
    phiDetected: true, // Clinical data assumed to contain PHI
    deIdentificationRequired: dataFlow.cloudProcessing,
    minimumNecessaryApplied: true,
    auditTrailEnabled: dataFlow.auditLogging,
    encryptionRequired: dataFlow.cloudProcessing || dataFlow.dataRetention,
  };
}

/**
 * Create an audit log entry for regulatory compliance
 */
export function createAuditLogEntry(
  eventType: AuditLogEntry["eventType"],
  input: string,
  output: string,
  confidence: number,
  humanOverride: boolean = false
): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    eventType,
    sessionId: crypto.randomUUID?.() || `session-${Date.now()}`,
    inputSummary: input.substring(0, 200) + (input.length > 200 ? "..." : ""),
    outputSummary: output.substring(0, 200) + (output.length > 200 ? "..." : ""),
    confidenceScore: confidence,
    humanOverrideApplied: humanOverride,
    modelVersion: "gemma-3-1b-edge-v1.0",
    traceId: crypto.randomUUID?.() || `trace-${Date.now()}`,
  };
}

/**
 * Perform comprehensive regulatory assessment
 */
export function performRegulatoryAssessment(): RegulatoryAssessment {
  const euCompliance = classifyEuAiActRisk(
    "medical-devices",
    "clinical-decision-support",
    false
  );
  
  const fdaClassification = classifyFdaSaMD(
    "drive-management", // Triage is decision support, not direct diagnosis
    "serious" // ED triage involves serious healthcare situations
  );
  
  const hipaaConsiderations = assessHipaaCompliance({
    localProcessing: true,
    cloudProcessing: true,
    dataRetention: false, // Ephemeral processing
    auditLogging: true,
  });
  
  const modelInfo = {
    name: "MedGemma",
    version: "2B-edge",
    provider: "Google Health AI Developer Foundations",
  };
  
  const capabilities = [
    "Clinical triage prioritization",
    "Differential diagnosis suggestions",
    "Drug interaction checking",
    "Pharmacogenomic alerts",
  ];
  
  const limitations = [
    "Not intended for direct diagnosis",
    "Requires clinician review",
    "May not capture all relevant context",
    "Performance varies by patient population",
  ];
  
  const disclosures = generateRequiredDisclosures(modelInfo, capabilities, limitations);
  
  // Calculate compliance score
  let score = 100;
  
  // EU AI Act deductions
  if (euCompliance.riskCategory === "high") {
    if (!euCompliance.humanOversightRequired) score -= 20;
    if (!euCompliance.transparencyRequired) score -= 15;
    if (!euCompliance.documentationRequired) score -= 10;
  }
  
  // FDA alignment
  if (fdaClassification.riskLevel === "IV") score -= 10;
  
  // HIPAA considerations
  if (hipaaConsiderations.phiDetected && !hipaaConsiderations.encryptionRequired) {
    score -= 15;
  }
  
  const recommendations: string[] = [];
  
  if (euCompliance.riskCategory === "high") {
    recommendations.push("Complete conformity assessment before EU deployment");
    recommendations.push("Implement post-market monitoring system");
    recommendations.push("Establish quality management system (ISO 13485)");
  }
  
  if (fdaClassification.riskLevel !== "I") {
    recommendations.push(`Prepare ${fdaClassification.regulatoryPathway} submission for US market`);
    recommendations.push("Conduct clinical validation studies");
  }
  
  return {
    euAiActCompliance: euCompliance,
    fdaSaMDClassification: fdaClassification,
    hipaaConsiderations,
    overallRiskLevel: euCompliance.riskCategory,
    complianceScore: Math.max(0, score),
    recommendations,
    requiredDisclosures: disclosures,
  };
}

/**
 * Human-in-the-loop confirmation requirement check
 */
export function requiresHumanConfirmation(
  severity: string,
  confidence: number,
  flags: string[]
): { required: boolean; reason: string; urgency: "immediate" | "before-action" | "optional" } {
  // High severity always requires confirmation per EU AI Act Article 14
  if (severity === "high" || severity === "critical") {
    return {
      required: true,
      reason: "High-risk clinical decision requires human oversight (EU AI Act Art. 14)",
      urgency: "immediate",
    };
  }
  
  // Low confidence requires confirmation
  if (confidence < 0.7) {
    return {
      required: true,
      reason: "Model confidence below threshold - human review required",
      urgency: "before-action",
    };
  }
  
  // Safety flags require confirmation
  if (flags.length > 0) {
    return {
      required: true,
      reason: `Safety flags detected: ${flags.join(", ")}`,
      urgency: flags.includes("critical") ? "immediate" : "before-action",
    };
  }
  
  return {
    required: false,
    reason: "Standard case within acceptable parameters",
    urgency: "optional",
  };
}
