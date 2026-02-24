// Calibration pipeline for clinical severity scoring with temperature scaling.

/**
 * Severity levels supported by the calibration system
 */
export type SeverityLevel = "low" | "medium" | "high";

/**
 * Result of severity calibration
 */
export interface CalibrationResult {
  /** The calibrated severity level */
  severity: SeverityLevel;
  /** Original severity before calibration */
  originalSeverity: SeverityLevel;
  /** Whether calibration was applied */
  wasCalibrated: boolean;
  /** Human-readable explanation of calibration decision */
  note?: string;
}

// Red flag keywords indicating high-severity conditions.
export const RED_FLAG_KEYWORDS: string[] = [
  // Cardiovascular emergencies
  "stroke",
  "stemi",
  "myocardial infarction",
  "heart attack",
  "cardiac arrest",
  "chest pain",
  "chest tightness",
  "chest pressure",
  "radiating chest pain",
  "chest pain with radiation",
  
  // Respiratory emergencies
  "severe respiratory distress",
  "cannot breathe",
  "unable to breathe",
  "cyanosis",
  "blue lips",
  "blue fingers",
  "stridor",
  "anaphylaxis",
  "severe allergic reaction",
  "shortness of breath",
  "difficulty breathing",
  
  // Neurological emergencies
  "unconscious",
  "unresponsive",
  "seizure",
  "facial droop",
  "slurred speech",
  "acute weakness",
  "sudden weakness",
  "paralysis",
  "altered mental status",
  "confusion sudden onset",
  
  // Trauma and bleeding
  "severe trauma",
  "uncontrolled bleeding",
  "hemorrhage",
  "severe bleeding",
  "head trauma",
  "spinal injury",
  "amputation",
  "penetrating wound",
  
  // Shock states
  "shock",
  "hypotension",
  "low blood pressure",
  "septic shock",
  
  // Other critical conditions
  "overdose",
  "poisoning",
  "suicidal",
  "active labor",
  "choking",
  "drowning",
];

// Tier 1 Red Flags: always HIGH severity (life-threatening).
export const RED_FLAGS_TIER_1: string[] = [
  "cardiac arrest",
  "stroke",
  "unconscious",
  "severe bleeding",
  "anaphylaxis",
  "seizure",
];

// Tier 2 Red Flags: usually HIGH severity (serious conditions).
export const RED_FLAGS_TIER_2: string[] = [
  "chest pain with radiation",
  "severe trauma",
  "respiratory distress",
  "altered mental status",
  "high fever with toxic appearance",
];

// Tier 3 Red Flags: MEDIUM unless other factors.
export const RED_FLAGS_TIER_3: string[] = [
  "chest pain",
  "shortness of breath",
  "abdominal pain",
  "severe pain",
];

// Low severity markers (negative predictors).
export const LOW_SEVERITY_MARKERS: string[] = [
  "improving",
  "tolerating fluids",
  "afebrile",
  "stable",
  "self-limited",
  "chronic",
  "well-appearing",
  "no distress",
];

// Minor symptom keywords indicating non-urgent conditions.
export const MINOR_SYMPTOM_KEYWORDS: string[] = [
  // Mild pain and discomfort
  "sore throat",
  "mild headache",
  "minor headache",
  "tension headache",
  "muscle ache",
  "muscle soreness",
  "minor pain",
  "mild pain",
  "discomfort",
  
  // Skin conditions
  "rash",
  "itching",
  "minor cut",
  "scratch",
  "bruise",
  "minor bruise",
  "skin irritation",
  
  // Minor respiratory
  "runny nose",
  "nasal congestion",
  "sneezing",
  "mild cough",
  "dry cough",
  
  // General minor symptoms
  "mild fever",
  "low grade fever",
  "fatigue",
  "tiredness",
  "dizziness mild",
  "mild nausea",
  "upset stomach",
  "indigestion",
  "heartburn",
  "constipation",
  "diarrhea mild",
];

// Urgent-but-stable keywords indicating MEDIUM severity conditions.
export const URGENT_BUT_STABLE_KEYWORDS: string[] = [
  "fracture",
  "broken bone",
  "sprain",
  "severe localized pain",
  "kidney stone",
  "kidney stones",
  "persistent fever",
  "high fever",
  "cellulitis",
  "moderate wheezing",
  "asthma",
  "vomiting",
  "diarrhea",
  "dehydration",
  "ear infection",
  "sinus infection",
  "urinary tract infection",
  "uti",
];

/** Check if symptoms contain any red flags (high-severity indicators). */
export function hasRedFlags(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  
  return RED_FLAG_KEYWORDS.some((keyword) => 
    textToCheck.includes(keyword.toLowerCase())
  );
}

/** Check if symptoms contain ONLY minor symptoms (no red flags, no urgent symptoms). */
export function hasOnlyMinorSymptoms(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  
  // If red flags present, not minor
  if (hasRedFlags(symptoms, summaryText)) {
    return false;
  }
  
  // If urgent-but-stable present, not minor
  const hasUrgent = URGENT_BUT_STABLE_KEYWORDS.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
  
  if (hasUrgent) {
    return false;
  }
  
  // Check if at least one minor symptom is present
  const hasMinor = MINOR_SYMPTOM_KEYWORDS.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
  
  return hasMinor;
}

/**
 * Count how many red flag keywords are matched in the symptoms/summary.
 * Useful for determining confidence in high-severity classification.
 * 
 * @param symptoms - Array of symptom strings
 * @param summaryText - Optional clinical summary text
 * @returns Number of unique red flag matches
 */
export function countRedFlags(symptoms: string[], summaryText?: string): number {
  const textToCheck = buildSearchText(symptoms, summaryText);
  
  return RED_FLAG_KEYWORDS.filter((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  ).length;
}

/**
 * Check for Tier 1 red flags (life-threatening conditions).
 * 
 * @param symptoms - Array of symptom strings
 * @param summaryText - Optional clinical summary text
 * @returns True if any Tier 1 red flags are present
 */
export function hasTier1Flags(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  return RED_FLAGS_TIER_1.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
}

/**
 * Check for Tier 2 red flags (serious conditions).
 * 
 * @param symptoms - Array of symptom strings
 * @param summaryText - Optional clinical summary text
 * @returns True if any Tier 2 red flags are present
 */
export function hasTier2Flags(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  return RED_FLAGS_TIER_2.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
}

/**
 * Check for Tier 3 red flags (moderate risk conditions).
 * 
 * @param symptoms - Array of symptom strings
 * @param summaryText - Optional clinical summary text
 * @returns True if any Tier 3 red flags are present
 */
export function hasTier3Flags(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  return RED_FLAGS_TIER_3.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
}

/**
 * Check for low severity markers (negative predictors).
 * 
 * @param symptoms - Array of symptom strings
 * @param summaryText - Optional clinical summary text
 * @returns True if any low severity markers are present
 */
export function hasLowSeverityMarkers(symptoms: string[], summaryText?: string): boolean {
  const textToCheck = buildSearchText(symptoms, summaryText);
  return LOW_SEVERITY_MARKERS.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
}

/**
 * Extract age from text using common patterns.
 * Returns null if no age found.
 * 
 * @param text - Text to search for age
 * @returns Age as number or null
 */
export function extractAge(text: string): number | null {
  // Pattern: "X-year-old", "X year old", "age X", "aged X"
  const patterns = [
    /(\d+)[-\s]?year[-\s]?old/i,
    /(\d+)[-\s]yo\b/i,
    /\bage[:\s]*(\d+)\b/i,
    /\baged[:\s]*(\d+)\b/i,
    /(\d+)[-\s]year[-\s]old/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const age = parseInt(match[1], 10);
      if (age > 0 && age < 150) {
        return age;
      }
    }
  }
  return null;
}

/**
 * Get age-based risk adjustment factor.
 * 
 * Age risk adjustments:
 * - Under 2: +2 (very high risk - pediatric)
 * - 2-5: +1 (moderate risk - young pediatric)
 * - 65-74: +1 (moderate risk - older adult)
 * - 75+: +2 (high risk - elderly)
 * - Default: 0 (no adjustment)
 * 
 * @param age - Age in years
 * @returns Risk adjustment factor (-2 to +2)
 */
export function getAgeRiskAdjustment(age: number | null): number {
  if (age === null) return 0;
  
  if (age < 2) return 2;     // Infant - very high risk
  if (age <= 5) return 1;    // Young child - moderate risk
  if (age >= 75) return 2;   // Elderly - high risk
  if (age >= 65) return 1;   // Older adult - moderate risk
  
  return 0;  // Default - no adjustment
}

/**
 * Check if confidence threshold is met.
 * If confidence is below threshold, should abstain (return MEDIUM).
 * 
 * @param confidence - Confidence score (0.0 - 1.0)
 * @param threshold - Minimum confidence threshold (default: 0.90)
 * @returns True if confidence is sufficient
 */
export function checkConfidenceThreshold(
  confidence: number,
  threshold: number = 0.90
): boolean {
  return confidence >= threshold;
}

/**
 * Main calibration function that adjusts severity based on symptom analysis.
 * 
 * CALIBRATION RULES (Tiered System):
 * 1. If confidence < 0.90 → Abstain to MEDIUM (ensemble threshold)
 * 2. If Tier 1 flags present → Always HIGH (life-threatening)
 * 3. If Tier 2 flags present → HIGH unless strong LOW markers present
 * 4. If Tier 3 flags present → MEDIUM unless Tier 1/2 present
 * 5. If LOW_SEVERITY_MARKERS present → Downgrade one level
 * 6. Apply age-based risk adjustments
 * 
 */
export function calibrateSeverity(
  predictedSeverity: SeverityLevel,
  symptoms: string[],
  summaryText?: string,
  confidence?: number,
  patientAge?: number
): CalibrationResult {
  const textToCheck = buildSearchText(symptoms, summaryText);
  
  // Extract age from text if not provided
  const extractedAge = patientAge ?? extractAge(textToCheck);
  const ageAdjustment = getAgeRiskAdjustment(extractedAge);
  
  // Check tiered red flags
  const tier1Present = hasTier1Flags(symptoms, summaryText);
  const tier2Present = hasTier2Flags(symptoms, summaryText);
  const tier3Present = hasTier3Flags(symptoms, summaryText);
  const lowMarkersPresent = hasLowSeverityMarkers(symptoms, summaryText);
  const hasUrgent = URGENT_BUT_STABLE_KEYWORDS.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );
  const redFlagCount = countRedFlags(symptoms, summaryText);
  const hasAnyRedFlag = redFlagCount > 0;
  
  // Rule 1: Confidence check - abstain if confidence < 0.90
  if (confidence !== undefined && !checkConfidenceThreshold(confidence)) {
    return {
      severity: "medium",
      originalSeverity: predictedSeverity,
      wasCalibrated: true,
      note: `calibrated-abstain: confidence ${(confidence * 100).toFixed(1)}% below 90% threshold`,
    };
  }
  
  // Determine base severity from tiered flags and original logic
  let calibratedSeverity: SeverityLevel = predictedSeverity;
  let calibrationReason = "";
  let wasCalibrated = false;
  
  // === HIGH severity calibration ===
  if (predictedSeverity === "high") {
    // Tier 1 flags = Always HIGH (life-threatening, no downgrade)
    if (tier1Present) {
      calibratedSeverity = "high";
      calibrationReason = "Tier 1 life-threatening flags present";
    }
    // Tier 2 flags = HIGH unless strong LOW markers present
    else if (tier2Present) {
      if (lowMarkersPresent && ageAdjustment <= 0) {
        // Strong LOW markers without high age risk - downgrade to MEDIUM
        calibratedSeverity = "medium";
        wasCalibrated = true;
        calibrationReason = "Tier 2 flags with strong LOW markers";
      } else {
        calibratedSeverity = "high";
        calibrationReason = "Tier 2 serious flags present";
      }
    }
    // Has any red flag or urgent symptoms - keep HIGH (backward compatibility)
    else if (hasAnyRedFlag) {
      calibratedSeverity = "high";
      calibrationReason = tier3Present ? "Tier 3 flags present" : "Red flags detected";
    }
    // Urgent but stable - downgrade to MEDIUM
    else if (hasUrgent) {
      calibratedSeverity = "medium";
      wasCalibrated = true;
      calibrationReason = "calibrated-down: no red flags detected, urgent but stable symptoms present";
    }
    // Tier 3 flags with LOW markers - downgrade to LOW
    else if (tier3Present && lowMarkersPresent) {
      calibratedSeverity = "low";
      wasCalibrated = true;
      calibrationReason = "Tier 3 flags with LOW severity markers";
    }
    // Only minor symptoms - downgrade to LOW
    else if (hasOnlyMinorSymptoms(symptoms, summaryText)) {
      calibratedSeverity = "low";
      wasCalibrated = true;
      calibrationReason = "calibrated-down: only minor symptoms detected";
    }
    // No red flags - downgrade to LOW
    else {
      calibratedSeverity = "low";
      wasCalibrated = true;
      calibrationReason = "calibrated-down: no red flags detected";
    }
  }
  
  // === MEDIUM severity calibration ===
  else if (predictedSeverity === "medium") {
    // Tier 1 or 2 flags - upgrade to HIGH
    if (tier1Present || tier2Present) {
      calibratedSeverity = "high";
      wasCalibrated = true;
      calibrationReason = tier1Present ? "Tier 1 life-threatening flags" : "Tier 2 serious flags";
    }
    // Only minor symptoms - downgrade to LOW
    else if (hasOnlyMinorSymptoms(symptoms, summaryText)) {
      calibratedSeverity = "low";
      wasCalibrated = true;
      calibrationReason = "calibrated-down: only minor symptoms detected";
    }
    // LOW markers present - downgrade to LOW
    else if (lowMarkersPresent && !tier3Present) {
      calibratedSeverity = "low";
      wasCalibrated = true;
      calibrationReason = "LOW severity markers present";
    }
  }
  
  // === LOW severity calibration ===
  else {
    // Tier 1 life-threatening flags - always upgrade to HIGH
    if (tier1Present) {
      calibratedSeverity = "high";
      wasCalibrated = true;
      calibrationReason = "Tier 1 life-threatening flags override LOW";
    }
    // Tier 2 flags - upgrade to MEDIUM (or HIGH with age risk)
    else if (tier2Present) {
      calibratedSeverity = ageAdjustment > 0 ? "high" : "medium";
      wasCalibrated = true;
      calibrationReason = "Tier 2 serious flags override LOW";
    }
    // Keep LOW otherwise (conservative approach)
  }
  
  // Build final result
  if (calibratedSeverity !== predictedSeverity) {
    wasCalibrated = true;
  }
  
  return {
    severity: calibratedSeverity,
    originalSeverity: predictedSeverity,
    wasCalibrated,
    note: wasCalibrated ? `calibrated${calibrationReason ? ": " + calibrationReason : ""}` : undefined,
  };
}

/**
 * Batch calibration for multiple cases.
 * Useful for processing evaluation datasets.
 * 
 * @param cases - Array of cases with severity, symptoms, and optional summary
 * @returns Array of calibration results
 */
export function calibrateSeverityBatch(
  cases: Array<{
    predictedSeverity: SeverityLevel;
    symptoms: string[];
    summaryText?: string;
  }>
): CalibrationResult[] {
  return cases.map((c) => calibrateSeverity(c.predictedSeverity, c.symptoms, c.summaryText));
}

/**
 * Get calibration statistics for a set of results.
 * Useful for analyzing calibration impact.
 * 
 * @param results - Array of calibration results
 * @returns Statistics object with counts and percentages
 */
export function getCalibrationStats(results: CalibrationResult[]) {
  const total = results.length;
  const calibrated = results.filter((r) => r.wasCalibrated).length;
  const downgraded = results.filter(
    (r) => r.wasCalibrated && 
    (r.originalSeverity === "high" || r.originalSeverity === "medium")
  ).length;
  
  const severityCounts = {
    low: results.filter((r) => r.severity === "low").length,
    medium: results.filter((r) => r.severity === "medium").length,
    high: results.filter((r) => r.severity === "high").length,
  };
  
  return {
    total,
    calibrated,
    downgraded,
    calibrationRate: total > 0 ? (calibrated / total) * 100 : 0,
    downgradeRate: total > 0 ? (downgraded / total) * 100 : 0,
    severityDistribution: severityCounts,
  };
}

/**
 * Helper function to build normalized search text from symptoms and summary.
 */
function buildSearchText(symptoms: string[], summaryText?: string): string {
  const symptomsText = Array.isArray(symptoms) ? symptoms.join(" ") : "";
  const normalizedSummary = summaryText || "";
  return `${symptomsText} ${normalizedSummary}`.toLowerCase();
}

/**
 * Export all keyword lists for external use or customization.
 */
export const CALIBRATION_KEYWORDS = {
  redFlags: RED_FLAG_KEYWORDS,
  redFlagsTier1: RED_FLAGS_TIER_1,
  redFlagsTier2: RED_FLAGS_TIER_2,
  redFlagsTier3: RED_FLAGS_TIER_3,
  lowSeverityMarkers: LOW_SEVERITY_MARKERS,
  minorSymptoms: MINOR_SYMPTOM_KEYWORDS,
  urgentButStable: URGENT_BUT_STABLE_KEYWORDS,
};
