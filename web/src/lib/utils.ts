// Shared utility functions.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind CSS classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Parsed AI response structure */
export interface ParsedAIResponse {
  /** Extracted symptoms list */
  symptoms: string[];
  /** Calibrated severity level */
  severity: "low" | "medium" | "high";
  /** Clinical summary */
  summary: string;
  /** Extracted recommendations */
  recommendations: string[];
  /** Original severity before calibration */
  severityRaw?: "low" | "medium" | "high";
  /** Note about severity calibration applied */
  calibrationNote?: string;
}

/**
 * Parse AI-generated response into structured format.
 * Handles both JSON and text-based responses with fallback parsing.
 * 
 * @param response - Raw AI response string
 * @returns Parsed and calibrated response data
 */
export function parseAIResponse(response: string): ParsedAIResponse {
  try {
    // Extract JSON from response — handle code fences, leading text, etc.
    let cleaned = response.trim();

    // Try extracting from code fences first
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    // Fallback: find first { to last } if not already clean JSON
    if (!cleaned.startsWith("{")) {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }

    // Try to parse as JSON — with repair attempt for common 1B model errors
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Common 1B model errors: missing ] before }, trailing commas
      const repaired = cleaned
        .replace(/,\s*}/g, "}")           // trailing comma before }
        .replace(/,\s*]/g, "]")           // trailing comma before ]
        .replace(/"\s*,\s*"confidence/g, '"],"confidence')  // missing ] before confidence field
        .replace(/(["\d])\s*}\s*$/g, '$1}}') // ensure proper closing
        ;
      parsed = JSON.parse(repaired);
    }
    
    // Handle nested structures — 1B models sometimes nest all fields under symptoms[0]
    let symptoms = parsed.symptoms || parsed.data?.symptoms || [];
    let severity = (parsed.severity || parsed.data?.severity || "").toLowerCase();
    let summary = parsed.summary || parsed.data?.summary || parsed.clinical_summary || "";
    let reasoning = parsed.reasoning || "";

    // If symptoms is an array of objects (e.g. [{symptom: "chest pain", severity: "high", ...}]),
    // extract fields from the first object and flatten symptom names
    if (Array.isArray(symptoms) && symptoms.length > 0 && typeof symptoms[0] === "object") {
      const first = symptoms[0];
      if (!severity) severity = (first.severity || "medium").toLowerCase();
      if (!summary) summary = first.summary || first.reasoning || "";
      if (!reasoning) reasoning = first.reasoning || "";
      symptoms = symptoms.map((s: { symptom?: string }) => s.symptom || JSON.stringify(s)).filter(Boolean);
    }

    if (!severity) severity = "medium";
    const rationaleText = `${summary} ${reasoning}`.trim();

    // Extract recommendations from parsed JSON
    let recommendations: string[] = [];
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.filter((r: unknown) => typeof r === "string" && r.length > 0);
    }
    
    // Normalize severity
    const normalizedSeverity = ["high", "medium", "low"].includes(severity) 
      ? severity as "low" | "medium" | "high" 
      : "medium";
    
    const calibration = calibrateSeverity(
      normalizedSeverity,
      Array.isArray(symptoms) ? symptoms : [],
      typeof summary === "string" ? summary : JSON.stringify(summary),
      rationaleText
    );

    return {
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      severity: calibration.severity,
      severityRaw: normalizedSeverity,
      calibrationNote: calibration.note,
      summary: typeof summary === "string" ? summary : JSON.stringify(summary),
      recommendations,
    };
  } catch {
    // Fallback: extract fields from JSON-like text using quoted-value-aware regexes
    const symptomsMatch = response.match(/symptoms?:\s*\[(.*?)\]/i);
    const severityMatch = response.match(/"severity"\s*:\s*"(low|medium|high)"/i)
      || response.match(/severity:\s*(low|medium|high)/i);
    // Extract quoted string value for summary
    const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/i)
      || response.match(/summary:\s*(.+?)(?:\n|$)/i);
    
    const extractedSymptoms = symptomsMatch
      ? symptomsMatch[1]
          .split(/[,\n]/)
          .map((s) => s.trim().replace(/["'\[\]]/g, ""))
          .filter(Boolean)
      : [];

    const fallbackSeverity = (severityMatch?.[1] as "low" | "medium" | "high") || "medium";
    const summaryText = summaryMatch?.[1] || response.slice(0, 500);
    const calibration = calibrateSeverity(fallbackSeverity, extractedSymptoms, summaryText, response);
    return {
      symptoms: extractedSymptoms,
      severity: calibration.severity,
      severityRaw: fallbackSeverity,
      calibrationNote: calibration.note,
      summary: summaryText,
      recommendations: [],
    };
  }
}

function calibrateSeverity(
  severity: "low" | "medium" | "high",
  symptoms: string[],
  summaryText: string,
  rationaleText?: string
): { severity: "low" | "medium" | "high"; note?: string } {
  const text = `${summaryText} ${rationaleText || ""} ${symptoms.join(" ")}`.toLowerCase();
  const redFlags = /(facial droop|slurred speech|acute weakness|stroke|stemi|chest pain with radiation|radiating chest pain|chest pain|severe respiratory distress|cyanosis|stridor|shock|hypotension|uncontrolled bleeding|anaphylaxis|shortness of breath)/;
  const urgentButStable = /(fracture|severe localized pain|kidney stone|persistent fever|cellulitis|moderate wheezing|asthma|vomiting|diarrhea)/;
  const redFlagHits = (text.match(redFlags) || []).length;

  if (severity === "high" && redFlagHits < 1) {
    return {
      severity: urgentButStable.test(text) ? "medium" : "low",
      note: "calibrated-down: no red flags",
    };
  }
  if ((severity === "medium" || severity === "low") && redFlags.test(text)) {
    return { severity: "high", note: "calibrated-up: red flags detected" };
  }
  return { severity };
}

export function isHighSeverityAllowed(
  symptoms: string[],
  summaryText: string,
  rationaleText?: string
): boolean {
  const text = `${summaryText} ${rationaleText || ""} ${symptoms.join(" ")}`.toLowerCase();
  const redFlags = /(facial droop|slurred speech|acute weakness|stroke|stemi|chest pain with radiation|radiating chest pain|chest pain|severe respiratory distress|cyanosis|stridor|shock|hypotension|uncontrolled bleeding|anaphylaxis|shortness of breath)/;
  return redFlags.test(text);
}

export function getSeverityColor(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "low":
      return "text-green-400";
    case "medium":
      return "text-yellow-400";
    case "high":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

export function getSeverityBg(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "low":
      return "bg-green-400/10 border-green-400/20";
    case "medium":
      return "bg-yellow-400/10 border-yellow-400/20";
    case "high":
      return "bg-red-400/10 border-red-400/20";
    default:
      return "bg-gray-400/10 border-gray-400/20";
  }
}

// Helper function to extract symptoms from text
export function extractSymptomsFromText(text: string): string[] {
  // Try bracket format: [Symptom1, Symptom2]
  const bracketMatch = text.match(/\[(.*?)\]/);
  if (bracketMatch) {
    return bracketMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/["'\[\]]/g, ""))
      .filter(Boolean);
  }
  
  // Try "Symptoms:" format
  const symptomsMatch = text.match(/symptoms?:\s*(.+?)(?:\n|$)/i);
  if (symptomsMatch) {
    return symptomsMatch[1]
      .split(/[,;]/)
      .map((s) => s.trim().replace(/["'\[\]]/g, ""))
      .filter(Boolean);
  }

  // Fallback: any comma-separated string in the text
  if (text.includes(",")) {
    return text
      .split(/[,;]/)
      .map((s) => s.trim().replace(/["'\[\]]/g, ""))
      .filter(Boolean);
  }
  
  return [];
}

// Format severity for display
export function formatSeverityForDisplay(severity: string): string {
  return severity.toUpperCase() + " PRIORITY";
}

// Sanitize user input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Generate a unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Format date for display
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

// Clamp a number between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Generate a random color from a predefined palette
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    cardiac: "red",
    respiratory: "blue",
    neurological: "purple",
    abdominal: "green",
    infectious: "orange",
    metabolic: "yellow",
    trauma: "gray",
  };
  
  return colors[category.toLowerCase()] || "slate";
}

// Validate JSON string
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Deep clone an object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Check if running in browser
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Get browser info
export function getBrowserInfo(): { isChrome: boolean; isFirefox: boolean; isSafari: boolean; isEdge: boolean } {
  if (!isBrowser()) {
    return { isChrome: false, isFirefox: false, isSafari: false, isEdge: false };
  }
  
  const ua = navigator.userAgent.toLowerCase();
  return {
    isChrome: ua.includes("chrome") && !ua.includes("edge"),
    isFirefox: ua.includes("firefox"),
    isSafari: ua.includes("safari") && !ua.includes("chrome"),
    isEdge: ua.includes("edge"),
  };
}
