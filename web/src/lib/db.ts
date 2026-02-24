// IndexedDB persistence via Dexie.js for case history management.

import Dexie, { type Table } from "dexie";

/**
 * Clinical case record stored in local database.
 */
export interface Case {
  id?: number;
  symptoms: string;
  severity: "low" | "medium" | "high";
  summary: string;
  /** Full AI analysis response */
  analysis: string;
  /** Graph nodes for visualization */
  graphData: GraphNode[];
  timestamp: Date;
  /** Analysis source (edge AI vs cloud) */
  source: "edge" | "cloud" | "demo";
}

/**
 * Node in the clinical reasoning graph.
 */
export interface GraphNode {
  id: string;
  label: string;
  type: "patient" | "symptom" | "history" | "risk" | "diagnosis";
  severity?: "low" | "medium" | "high";
}

/**
 * Edge connecting two nodes in the reasoning graph.
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/**
 * Options for searching and filtering cases.
 */
export interface CaseSearchOptions {
  /** Text query to search in symptoms/summary */
  query?: string;
  severity?: "low" | "medium" | "high" | "all";
  source?: "edge" | "cloud" | "demo" | "all";
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "timestamp" | "severity";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/**
 * Search result with pagination metadata.
 */
export interface CaseSearchResult {
  cases: Case[];
  total: number;
  hasMore: boolean;
}

/**
 * IndexedDB database for AEGIS application data.
 */
export class AegisDatabase extends Dexie {
  cases!: Table<Case>;

  constructor() {
    super("AegisDatabase");
    this.version(1).stores({
      cases: "++id, symptoms, severity, timestamp, source, *graphData",
    });
  }
}

export const db = new AegisDatabase();

export async function saveCase(caseData: Omit<Case, "id">): Promise<number | string> {
  return (await db.cases.add(caseData)) as number | string;
}

export async function getRecentCases(limit = 10): Promise<Case[]> {
  return await db.cases.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getCaseById(id: number): Promise<Case | undefined> {
  return await db.cases.get(id);
}

export async function deleteCase(id: number): Promise<void> {
  await db.cases.delete(id);
}

export async function clearAllCases(): Promise<void> {
  await db.cases.clear();
}

// Advanced search and filter
export async function searchCases(options: CaseSearchOptions): Promise<CaseSearchResult> {
  const {
    query,
    severity = "all",
    source = "all",
    dateFrom,
    dateTo,
    sortBy = "timestamp",
    sortOrder = "desc",
    limit = 20,
    offset = 0,
  } = options;

  // Get all cases and filter in memory for complex queries
  let cases = await db.cases.toArray();

  // Apply search filter
  if (query) {
    const searchTerms = query.toLowerCase().split(" ");
    cases = cases.filter((c) => {
      const searchText = `${c.symptoms} ${c.summary} ${c.analysis}`.toLowerCase();
      return searchTerms.every((term) => searchText.includes(term));
    });
  }

  // Apply severity filter
  if (severity !== "all") {
    cases = cases.filter((c) => c.severity === severity);
  }

  // Apply source filter
  if (source !== "all") {
    cases = cases.filter((c) => c.source === source);
  }

  // Apply date filters
  if (dateFrom) {
    cases = cases.filter((c) => c.timestamp >= dateFrom);
  }

  if (dateTo) {
    cases = cases.filter((c) => c.timestamp <= dateTo);
  }

  // Apply sorting
  cases.sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === "timestamp") {
      comparison = a.timestamp.getTime() - b.timestamp.getTime();
    } else if (sortBy === "severity") {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      comparison = severityOrder[a.severity] - severityOrder[b.severity];
    }
    
    return sortOrder === "desc" ? -comparison : comparison;
  });

  // Get total before pagination
  const total = cases.length;

  // Apply pagination
  const paginatedCases = cases.slice(offset, offset + limit);

  return {
    cases: paginatedCases,
    total,
    hasMore: offset + limit < total,
  };
}

// Get case statistics
export async function getCaseStatistics(): Promise<{
  total: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  recentCount: number;
  oldestCase?: Date;
  newestCase?: Date;
}> {
  const cases = await db.cases.toArray();

  const bySeverity = { low: 0, medium: 0, high: 0 };
  const bySource = { edge: 0, cloud: 0, demo: 0 };

  cases.forEach((c) => {
    bySeverity[c.severity]++;
    bySource[c.source]++;
  });

  // Sort by timestamp to find oldest and newest
  const sortedByDate = [...cases].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = cases.filter((c) => c.timestamp > oneDayAgo).length;

  return {
    total: cases.length,
    bySeverity,
    bySource,
    recentCount,
    oldestCase: sortedByDate[0]?.timestamp,
    newestCase: sortedByDate[sortedByDate.length - 1]?.timestamp,
  };
}

// Export cases to JSON
export async function exportCasesToJSON(options?: CaseSearchOptions): Promise<string> {
  let cases: Case[];
  
  if (options) {
    const result = await searchCases({ ...options, limit: 10000 });
    cases = result.cases;
  } else {
    cases = await db.cases.toArray();
  }

  return JSON.stringify(cases, null, 2);
}

// Export cases to CSV
export async function exportCasesToCSV(options?: CaseSearchOptions): Promise<string> {
  let cases: Case[];
  
  if (options) {
    const result = await searchCases({ ...options, limit: 10000 });
    cases = result.cases;
  } else {
    cases = await db.cases.toArray();
  }

  const headers = ["ID", "Symptoms", "Severity", "Summary", "Source", "Timestamp"];
  const rows = cases.map((c) => [
    c.id?.toString() || "",
    `"${c.symptoms.replace(/"/g, '""')}"`,
    c.severity,
    `"${c.summary.replace(/"/g, '""')}"`,
    c.source,
    c.timestamp.toISOString(),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// Live query for real-time updates
export function getLiveRecentCases(limit = 10) {
  return db.cases.orderBy("timestamp").reverse().limit(limit);
}

// Get unique symptoms from all cases (for autocomplete/suggestions)
export async function getUniqueSymptoms(): Promise<string[]> {
  const cases = await db.cases.toArray();
  const symptomSet = new Set<string>();

  cases.forEach((c) => {
    // Parse symptoms if they're stored as JSON string
    let symptoms: string[] = [];
    try {
      symptoms = JSON.parse(c.symptoms);
    } catch {
      // If not JSON, treat as comma-separated or single symptom
      symptoms = c.symptoms.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    }

    symptoms.forEach((s) => symptomSet.add(s));
  });

  return Array.from(symptomSet).sort();
}

// Duplicate detection
export async function findDuplicateCases(
  symptoms: string,
  timeWindowMs = 5 * 60 * 1000 // 5 minutes
): Promise<Case[]> {
  const threshold = new Date(Date.now() - timeWindowMs);
  
  // Normalize symptoms for comparison
  const normalizedInput = symptoms.toLowerCase().trim();

  const recentCases = await db.cases
    .where("timestamp")
    .above(threshold)
    .toArray();

  return recentCases.filter((c) => {
    const normalizedCase = c.symptoms.toLowerCase().trim();
    // Simple similarity check - in production you'd want Levenshtein distance
    return (
      normalizedCase === normalizedInput ||
      normalizedInput.includes(normalizedCase) ||
      normalizedCase.includes(normalizedInput)
    );
  });
}
