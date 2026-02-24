const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CaseInput {
  symptoms: string;
}

export interface CaseAnalysis {
  symptoms: string;
  diagnosis_draft: string;
  critique: string;
  final_output: string;
}

export async function analyzeCaseCloud(symptoms: string): Promise<CaseAnalysis> {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symptoms }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function isDemoMode(symptoms: string): boolean {
  return symptoms.toUpperCase().includes("DEMO_MODE");
}
