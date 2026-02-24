/**
 * MedGemma client - calls the Next.js API route that proxies to HuggingFace Inference API.
 * The HF_TOKEN is kept server-side in the API route for security.
 */

export interface MedGemmaResponse {
  response: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface MedGemmaStatus {
  status: "ready" | "no_token";
  model: string;
}

export async function analyzeMedGemma(
  symptoms: string,
  systemPrompt?: string
): Promise<MedGemmaResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms, systemPrompt }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `MedGemma request failed: ${res.status}`);
  }

  return res.json();
}

export async function checkMedGemmaStatus(): Promise<MedGemmaStatus> {
  try {
    const res = await fetch("/api/analyze");
    if (!res.ok) return { status: "no_token", model: "unknown" };
    return res.json();
  } catch {
    return { status: "no_token", model: "unknown" };
  }
}
