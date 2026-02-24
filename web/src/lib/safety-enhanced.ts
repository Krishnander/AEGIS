// Enhanced safety: PII scrubbing, unsafe intent detection, drug interaction checks, clinical output validation.

import { sanitizeInput } from "@/lib/utils";

// =============================================================================
// LEGACY SAFETY API (backward compatibility with safety.ts)
// =============================================================================

/**
 * Basic safety assessment result.
 */
export interface SafetyAssessment {
  /** Whether unsafe content was detected */
  unsafe: boolean;
  /** List of reasons content was flagged as unsafe */
  reasons: string[];
  /** Whether PII was redacted from the input */
  piiRedacted: boolean;
  /** Clinical validation findings */
  validatorFindings: string[];
}

/** Patterns for detecting unsafe/harmful intent */
const UNSAFE_PATTERNS = [
  /(suicide|kill myself|self-harm|self harm)/i,
  /(bomb|weapon|assassinate)/i,
  /(overdose|how much .*pill)/i,
  /(commit crime|illegal)/i,
];

/** Patterns for detecting PII that should be redacted */
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone with dashes
  /\b\d{10}\b/g, // Phone without dashes
  /[A-Z]{2}\d{6,}/g, // ID-like patterns
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // Email
];

/** Detect unsafe or harmful intent in user input. */
export function detectUnsafeIntent(text: string): SafetyAssessment {
  const reasons: string[] = [];
  
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`Unsafe intent matched: ${pattern}`);
    }
  }
  
  return {
    unsafe: reasons.length > 0,
    reasons,
    piiRedacted: false,
    validatorFindings: [],
  };
}

/** Remove personally identifiable information from text. */
export function scrubPII(text: string): string {
  let output = text;
  
  for (const pattern of PII_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  
  return sanitizeInput(output);
}

/**
 * Validate clinical output for safety concerns.
 * 
 * @param rawOutput - Raw AI-generated clinical output
 * @param priorAssessment - Previous safety assessment from input
 * @returns Updated safety assessment with clinical validation findings
 */
export function validateClinicalOutput(
  rawOutput: string,
  priorAssessment: SafetyAssessment
): SafetyAssessment {
  const findings = [...priorAssessment.reasons];
  
  // Flag dosage mentions for verification
  if (/\d+\s?(mg|mcg|mg\/kg)\b/i.test(rawOutput)) {
    findings.push("Contains dosage-like values; verify appropriateness.");
  }
  
  // Flag overconfident clinical claims
  if (/definitive diagnosis|guarantee cure/i.test(rawOutput)) {
    findings.push("Overconfident clinical claim detected.");
  }
  
  return {
    unsafe: priorAssessment.unsafe,
    reasons: priorAssessment.reasons,
    piiRedacted: /\[REDACTED\]/.test(rawOutput),
    validatorFindings: findings,
  };
}

// =============================================================================
// ENHANCED SAFETY TYPES
// =============================================================================

/**
 * Drug-drug interaction alert with clinical guidance.
 */
export interface DrugInteraction {
  /** First drug in the interaction pair */
  drug1: string;
  /** Second drug in the interaction pair */
  drug2: string;
  /** Interaction severity level */
  severity: "contraindicated" | "major" | "moderate" | "minor";
  /** Pharmacological mechanism of interaction */
  mechanism: string;
  /** Expected clinical effect */
  clinicalEffect: string;
  /** Clinical recommendation for managing interaction */
  recommendation: string;
}

/**
 * Pharmacogenomic (drug-gene) interaction alert.
 * Based on CPIC guidelines.
 */
export interface PharmacogenomicAlert {
  /** Drug affected by genetic variant */
  drug: string;
  /** Gene with variant */
  gene: string;
  /** Specific genetic variant */
  variant: string;
  /** Clinical significance level */
  severity: "HIGH" | "MODERATE" | "LOW";
  /** Effect of variant on drug response */
  effect: string;
  /** Clinical recommendation */
  recommendation: string;
  /** Alternative medications if applicable */
  alternativeDrugs?: string[];
}

/**
 * Contraindication alert for drug-condition combinations.
 */
export interface ContraindicationAlert {
  /** Drug that is contraindicated */
  drug: string;
  /** Condition contraindicating the drug */
  condition: string;
  /** Whether contraindication is absolute or relative */
  severity: "absolute" | "relative";
  /** Reason for contraindication */
  reason: string;
  /** Alternative medications if available */
  alternatives?: string[];
}

/**
 * Bias indicator for clinical recommendations.
 */
export interface BiasIndicator {
  /** Type of potential bias detected */
  type: "age" | "gender" | "race" | "socioeconomic";
  /** Whether bias was detected */
  detected: boolean;
  /** Level of concern */
  concernLevel: "low" | "medium" | "high";
  /** Mitigation recommendation */
  mitigation: string;
}

/**
 * Comprehensive enhanced safety assessment result.
 */
export interface EnhancedSafetyAssessment {
  // Core safety flags
  /** Whether content contains unsafe/harmful material */
  isUnsafe: boolean;
  /** Specific reasons content was flagged as unsafe */
  unsafeReasons: string[];
  /** Whether PII was detected and redacted */
  piiRedacted: boolean;
  
  // Drug safety
  /** Detected drug-drug interactions */
  drugInteractions: DrugInteraction[];
  /** Pharmacogenomic alerts based on genetic data */
  pharmacogenomicAlerts: PharmacogenomicAlert[];
  /** Drug-condition contraindications */
  contraindications: ContraindicationAlert[];
  
  // Bias monitoring
  /** Detected bias indicators */
  biasIndicators: BiasIndicator[];
  
  // Clinical guardrails
  /** Warnings about dosage mentions */
  dosageWarnings: string[];
  /** Flags for overconfident language */
  overconfidenceFlags: string[];
  /** Triggers for severity escalation */
  escalationTriggers: string[];
  
  // Overall assessment
  /** Safety score from 0-100 (higher is safer) */
  safetyScore: number;
  /** Categorical safety level */
  safetyLevel: "safe" | "caution" | "warning" | "critical";
}

// Common drug interaction database (subset for demo)
const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    drug1: "warfarin",
    drug2: "aspirin",
    severity: "major",
    mechanism: "Increased anticoagulant effect",
    clinicalEffect: "Significantly increased bleeding risk",
    recommendation: "Avoid combination unless specifically indicated. Monitor INR closely if must use together.",
  },
  {
    drug1: "clopidogrel",
    drug2: "omeprazole",
    severity: "major",
    mechanism: "CYP2C19 inhibition reduces clopidogrel activation",
    clinicalEffect: "Reduced antiplatelet effect, increased cardiovascular risk",
    recommendation: "Use pantoprazole or H2 blocker instead of omeprazole.",
  },
  {
    drug1: "metformin",
    drug2: "contrast dye",
    severity: "major",
    mechanism: "Risk of lactic acidosis",
    clinicalEffect: "Metabolic acidosis, potentially fatal",
    recommendation: "Hold metformin 48h before and after contrast administration.",
  },
  {
    drug1: "ssri",
    drug2: "maoi",
    severity: "contraindicated",
    mechanism: "Serotonin syndrome",
    clinicalEffect: "Life-threatening hyperthermia, rigidity, autonomic instability",
    recommendation: "Never combine. Requires 2-week washout between agents.",
  },
  {
    drug1: "ace inhibitor",
    drug2: "potassium",
    severity: "moderate",
    mechanism: "Potassium retention",
    clinicalEffect: "Hyperkalemia risk",
    recommendation: "Monitor potassium levels. Avoid potassium supplements unless indicated.",
  },
];

// Pharmacogenomic markers database
const PGX_MARKERS: Record<string, PharmacogenomicAlert[]> = {
  "CYP2C9": [
    {
      drug: "Warfarin",
      gene: "CYP2C9",
      variant: "*2, *3",
      severity: "HIGH",
      effect: "Reduced warfarin metabolism - bleeding risk",
      recommendation: "Reduce warfarin dose by 30-50%. Use pharmacogenetic dosing algorithm.",
      alternativeDrugs: ["Direct oral anticoagulants (DOACs) if no contraindication"],
    },
  ],
  "CYP2C19": [
    {
      drug: "Clopidogrel",
      gene: "CYP2C19",
      variant: "*2, *3",
      severity: "HIGH",
      effect: "Poor metabolizer - reduced clopidogrel activation",
      recommendation: "Consider prasugrel or ticagrelor as alternatives.",
      alternativeDrugs: ["Prasugrel", "Ticagrelor"],
    },
  ],
  "CYP2D6": [
    {
      drug: "Codeine",
      gene: "CYP2D6",
      variant: "*1/*1xN (ultra-rapid)",
      severity: "HIGH",
      effect: "Ultra-rapid conversion to morphine - toxicity risk",
      recommendation: "AVOID codeine. Use alternative analgesics.",
      alternativeDrugs: ["Morphine", "Hydromorphone", "Non-opioid alternatives"],
    },
    {
      drug: "Codeine",
      gene: "CYP2D6",
      variant: "*4, *5",
      severity: "MODERATE",
      effect: "Poor metabolizer - inadequate analgesia",
      recommendation: "Use alternative analgesic. Codeine will be ineffective.",
      alternativeDrugs: ["Morphine", "Hydromorphone"],
    },
  ],
  "VKORC1": [
    {
      drug: "Warfarin",
      gene: "VKORC1",
      variant: "-1639G>A",
      severity: "HIGH",
      effect: "Increased warfarin sensitivity",
      recommendation: "Reduce warfarin dose by 25-50%. Target lower INR range.",
    },
  ],
  "HLA-B": [
    {
      drug: "Carbamazepine",
      gene: "HLA-B",
      variant: "*1502",
      severity: "HIGH",
      effect: "Stevens-Johnson syndrome / toxic epidermal necrolysis risk",
      recommendation: "AVOID carbamazepine in HLA-B*1502 positive patients.",
      alternativeDrugs: ["Levetiracetam", "Lamotrigine (with caution)", "Valproate"],
    },
    {
      drug: "Abacavir",
      gene: "HLA-B",
      variant: "*5701",
      severity: "HIGH",
      effect: "Hypersensitivity reaction risk",
      recommendation: "Screen for HLA-B*5701 before prescribing. Avoid if positive.",
    },
  ],
};

// Contraindication database
const CONTRAINDICATIONS: ContraindicationAlert[] = [
  {
    drug: "Metformin",
    condition: "eGFR < 30",
    severity: "absolute",
    reason: "Risk of lactic acidosis with severe renal impairment",
    alternatives: ["Insulin", "SGLT2 inhibitors with renal dosing"],
  },
  {
    drug: "NSAIDs",
    condition: "Active GI bleed",
    severity: "absolute",
    reason: "Exacerbates bleeding and impairs healing",
    alternatives: ["Acetaminophen", "Topical analgesics"],
  },
  {
    drug: "Beta blockers",
    condition: "Severe bradycardia",
    severity: "absolute",
    reason: "Further slowing of heart rate",
    alternatives: ["Calcium channel blockers (dihydropyridines)"],
  },
  {
    drug: "Fluoroquinolones",
    condition: "Myasthenia gravis",
    severity: "absolute",
    reason: "May exacerbate muscle weakness",
    alternatives: ["Beta-lactams", "Macrolides"],
  },
  {
    drug: "ACE inhibitors",
    condition: "Pregnancy",
    severity: "absolute",
    reason: "Fetotoxic - renal dysgenesis, oligohydramnios",
    alternatives: ["Labetalol", "Nifedipine", "Methyldopa"],
  },
];

/**
 * Check for drug-drug interactions
 */
export function checkDrugInteractions(medications: string[]): DrugInteraction[] {
  const found: DrugInteraction[] = [];
  const normalizedMeds = medications.map(m => m.toLowerCase());
  
  for (const interaction of DRUG_INTERACTIONS) {
    const has1 = normalizedMeds.some(m => m.includes(interaction.drug1.toLowerCase()));
    const has2 = normalizedMeds.some(m => m.includes(interaction.drug2.toLowerCase()));
    
    if (has1 && has2) {
      found.push(interaction);
    }
  }
  
  return found;
}

/**
 * Check for pharmacogenomic alerts based on genetic variants
 */
export function checkPharmacogenomics(
  medications: string[],
  geneticVariants: Array<{ gene: string; variant: string }>
): PharmacogenomicAlert[] {
  const alerts: PharmacogenomicAlert[] = [];
  const normalizedMeds = medications.map(m => m.toLowerCase());
  
  for (const variant of geneticVariants) {
    const geneAlerts = PGX_MARKERS[variant.gene] || [];
    for (const alert of geneAlerts) {
      if (normalizedMeds.some(m => m.toLowerCase().includes(alert.drug.toLowerCase()))) {
        alerts.push({
          ...alert,
          variant: variant.variant,
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Check for contraindications based on patient conditions
 */
export function checkContraindications(
  medications: string[],
  conditions: string[]
): ContraindicationAlert[] {
  const alerts: ContraindicationAlert[] = [];
  const normalizedMeds = medications.map(m => m.toLowerCase());
  const normalizedConds = conditions.map(c => c.toLowerCase());
  
  for (const ci of CONTRAINDICATIONS) {
    const hasDrug = normalizedMeds.some(m => m.includes(ci.drug.toLowerCase()));
    const hasCondition = normalizedConds.some(c => c.includes(ci.condition.toLowerCase()));
    
    if (hasDrug && hasCondition) {
      alerts.push(ci);
    }
  }
  
  return alerts;
}

/**
 * Detect potential bias indicators in clinical recommendations
 */
export function detectBiasIndicators(
  text: string,
  patientContext?: { age?: number; gender?: string }
): BiasIndicator[] {
  const indicators: BiasIndicator[] = [];
  const lowerText = text.toLowerCase();
  
  // Age bias detection
  if (patientContext?.age) {
    const ageRelatedTerms = ["elderly", "geriatric", "old age", "advanced age"];
    const ageNegative = ["non-compliant", "unlikely to benefit", "limited life expectancy"];
    
    const hasAgeBias = ageRelatedTerms.some(t => lowerText.includes(t)) &&
                       ageNegative.some(t => lowerText.includes(t));
    
    indicators.push({
      type: "age",
      detected: hasAgeBias,
      concernLevel: hasAgeBias ? "medium" : "low",
      mitigation: hasAgeBias 
        ? "Age-based assumptions detected. Consider individual functional status and patient preferences."
        : "No age bias detected.",
    });
  }
  
  // Gender bias detection
  const genderStereotypes = [
    { pattern: /hysteri|emotional|anxious.*female|female.*anxious/i, concern: "high" },
    { pattern: /typical.*male|male.*pain tolerance/i, concern: "medium" },
  ];
  
  const genderBias = genderStereotypes.find(s => s.pattern.test(text));
  indicators.push({
    type: "gender",
    detected: !!genderBias,
    concernLevel: (genderBias?.concern || "low") as "low" | "medium" | "high",
    mitigation: genderBias
      ? "Gender-related stereotypes detected. Ensure assessment is based on clinical findings."
      : "No gender bias detected.",
  });
  
  return indicators;
}

/**
 * Extract medications mentioned in text
 */
export function extractMedications(text: string): string[] {
  const commonMeds = [
    "aspirin", "warfarin", "clopidogrel", "heparin", "metformin", "insulin",
    "lisinopril", "losartan", "amlodipine", "metoprolol", "atenolol",
    "omeprazole", "pantoprazole", "morphine", "codeine", "acetaminophen",
    "ibuprofen", "naproxen", "prednisone", "albuterol", "fluticasone",
    "carbamazepine", "phenytoin", "levetiracetam", "gabapentin",
    "sertraline", "fluoxetine", "escitalopram", "bupropion",
    "atorvastatin", "simvastatin", "rosuvastatin", "pravastatin",
    "levothyroxine", "methotrexate", "azithromycin", "amoxicillin",
    "ciprofloxacin", "levofloxacin", "vancomycin", "doxycycline",
    "prasugrel", "ticagrelor", "rivaroxaban", "apixaban", "dabigatran"
  ];
  
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const med of commonMeds) {
    if (lowerText.includes(med)) {
      found.push(med);
    }
  }
  
  return [...new Set(found)];
}

/**
 * Calculate overall safety score
 */
function calculateSafetyScore(assessment: Partial<EnhancedSafetyAssessment>): number {
  let score = 100;
  
  // Deduct for unsafe content
  if (assessment.isUnsafe) score -= 50;
  
  // Deduct for drug interactions
  for (const interaction of assessment.drugInteractions || []) {
    if (interaction.severity === "contraindicated") score -= 30;
    else if (interaction.severity === "major") score -= 20;
    else if (interaction.severity === "moderate") score -= 10;
    else score -= 5;
  }
  
  // Deduct for PGx alerts
  for (const alert of assessment.pharmacogenomicAlerts || []) {
    if (alert.severity === "HIGH") score -= 25;
    else if (alert.severity === "MODERATE") score -= 15;
    else score -= 5;
  }
  
  // Deduct for contraindications
  for (const ci of assessment.contraindications || []) {
    if (ci.severity === "absolute") score -= 30;
    else score -= 15;
  }
  
  // Deduct for bias
  for (const bias of assessment.biasIndicators || []) {
    if (bias.detected && bias.concernLevel === "high") score -= 15;
    else if (bias.detected && bias.concernLevel === "medium") score -= 10;
  }
  
  // Deduct for overconfidence
  score -= (assessment.overconfidenceFlags?.length || 0) * 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Comprehensive enhanced safety assessment
 */
export function performEnhancedSafetyAssessment(
  text: string,
  genomicData?: Array<{ gene: string; variant: string }>,
  patientConditions?: string[],
  patientContext?: { age?: number; gender?: string }
): EnhancedSafetyAssessment {
  const medications = extractMedications(text);
  
  // Check all safety dimensions
  const drugInteractions = checkDrugInteractions(medications);
  const pharmacogenomicAlerts = genomicData 
    ? checkPharmacogenomics(medications, genomicData)
    : [];
  const contraindications = patientConditions
    ? checkContraindications(medications, patientConditions)
    : [];
  const biasIndicators = detectBiasIndicators(text, patientContext);
  
  // Check for overconfident language
  const overconfidenceFlags: string[] = [];
  if (/definitive diagnosis|guarantee|100%|certainly|definitely/i.test(text)) {
    overconfidenceFlags.push("Overconfident language detected");
  }
  if (/will cure|guaranteed outcome/i.test(text)) {
    overconfidenceFlags.push("Unrealistic outcome claims");
  }
  
  // Check for dosage mentions
  const dosageWarnings: string[] = [];
  const dosageMatch = text.match(/\d+\s*(mg|mcg|g|ml|units?|iu)/gi);
  if (dosageMatch) {
    dosageWarnings.push(`Dosage values mentioned: ${dosageMatch.join(", ")}. Verify appropriateness.`);
  }
  
  // Check for escalation triggers
  const escalationTriggers: string[] = [];
  if (/immediate|urgent|stat|emergency|critical/i.test(text)) {
    escalationTriggers.push("Urgent terminology used - verify escalation pathway");
  }
  if (/code|arrest|crash|resuscitation/i.test(text)) {
    escalationTriggers.push("Emergency terminology - ensure rapid response protocols");
  }
  
  // Core unsafe detection
  const unsafePatterns = [
    { pattern: /suicide|self.?harm|kill myself/i, reason: "Self-harm content" },
    { pattern: /bomb|weapon|assassinate/i, reason: "Violence content" },
    { pattern: /how to (make|create|synthesize).*drug/i, reason: "Drug synthesis" },
  ];
  
  const unsafeReasons: string[] = [];
  for (const { pattern, reason } of unsafePatterns) {
    if (pattern.test(text)) {
      unsafeReasons.push(reason);
    }
  }
  
  const isUnsafe = unsafeReasons.length > 0;
  
  // Check for PII
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
  ];
  const piiRedacted = piiPatterns.some(p => p.test(text));
  
  // Calculate safety score
  const partialAssessment = {
    isUnsafe,
    drugInteractions,
    pharmacogenomicAlerts,
    contraindications,
    biasIndicators,
    overconfidenceFlags,
  };
  
  const safetyScore = calculateSafetyScore(partialAssessment);
  
  // Determine safety level
  let safetyLevel: "safe" | "caution" | "warning" | "critical";
  if (safetyScore >= 90) safetyLevel = "safe";
  else if (safetyScore >= 70) safetyLevel = "caution";
  else if (safetyScore >= 50) safetyLevel = "warning";
  else safetyLevel = "critical";
  
  return {
    isUnsafe,
    unsafeReasons,
    piiRedacted,
    drugInteractions,
    pharmacogenomicAlerts,
    contraindications,
    biasIndicators,
    dosageWarnings,
    overconfidenceFlags,
    escalationTriggers,
    safetyScore,
    safetyLevel,
  };
}

/** Module exports for external use */
const safetyEnhancedModule = {
  // Legacy API
  detectUnsafeIntent,
  scrubPII,
  validateClinicalOutput,
  // Enhanced API
  checkDrugInteractions,
  checkPharmacogenomics,
  checkContraindications,
  detectBiasIndicators,
  extractMedications,
  performEnhancedSafetyAssessment,
};

export default safetyEnhancedModule;
