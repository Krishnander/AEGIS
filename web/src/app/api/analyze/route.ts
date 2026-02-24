import { NextRequest, NextResponse } from "next/server";

const HF_TOKEN = process.env.HF_TOKEN;
const MEDGEMMA_MODEL = process.env.MEDGEMMA_MODEL || "google/medgemma-1.5-4b-it";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const KAGGLE_MEDGEMMA_URL = process.env.KAGGLE_MEDGEMMA_URL;
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${MEDGEMMA_MODEL}/v1/chat/completions`;

const SYSTEM_PROMPT = `You are AEGIS, a clinical triage AI powered by MedGemma.
Analyze the patient presentation and return ONLY valid JSON:
{
  "symptoms": ["symptom1", "symptom2"],
  "severity": "low" | "medium" | "high",
  "summary": "concise clinical assessment",
  "differential": [
    {"condition": "name", "probability": 0-100, "recommendation": "action"}
  ],
  "recommendations": ["action1", "action2"],
  "reasoning": ["step1", "step2"],
  "confidence": 0.0-1.0
}

Severity rubric:
- HIGH: Life-threatening, time-critical (stroke, MI, sepsis, anaphylaxis)
- MEDIUM: Serious but stable (fractures, moderate infections, cardiac workup)
- LOW: Minor, self-limited (viral URI, minor rashes, simple UTI)

Rules:
- Be cautious: focus on triage, not definitive diagnoses
- Express calibrated uncertainty
- Never include PII in output`;

// Build messages array for chat completions
function buildMessages(symptoms: string, systemPrompt?: string) {
  return [
    { role: "system", content: systemPrompt || SYSTEM_PROMPT },
    { role: "user", content: `Patient presentation: ${symptoms}` },
  ];
}

// Headers required to bypass ngrok's browser interstitial warning page
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

// Try Kaggle Notebook (free GPU via ngrok)
async function tryKaggle(messages: { role: string; content: string }[], symptoms: string): Promise<{ content: string; source: string } | null> {
  if (!KAGGLE_MEDGEMMA_URL) return null;
  try {
    // Try AEGIS-native /analyze endpoint first
    const analyzeRes = await fetch(`${KAGGLE_MEDGEMMA_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
      body: JSON.stringify({ symptoms }),
      signal: AbortSignal.timeout(120_000),
    });
    if (analyzeRes.ok) {
      const data = await analyzeRes.json();
      return { content: data.response ?? JSON.stringify(data), source: `kaggle/${MEDGEMMA_MODEL}` };
    }
    // Fallback to OpenAI-compatible endpoint
    const chatRes = await fetch(`${KAGGLE_MEDGEMMA_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
      body: JSON.stringify({ messages, max_tokens: 1024, temperature: 0.1 }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!chatRes.ok) return null;
    const data = await chatRes.json();
    return { content: data.choices?.[0]?.message?.content || "", source: `kaggle/${MEDGEMMA_MODEL}` };
  } catch {
    return null;
  }
}

// Try Ollama (local GPU inference)
async function tryOllama(messages: { role: string; content: string }[]): Promise<{ content: string; source: string } | null> {
  try {
    const ollamaModel = process.env.OLLAMA_MODEL || "medgemma";
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaModel, messages, stream: false }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { content: data.message?.content || "", source: `ollama/${ollamaModel}` };
  } catch {
    return null;
  }
}

// Try HuggingFace Inference API
async function tryHuggingFace(messages: { role: string; content: string }[]): Promise<{ content: string; source: string; usage?: Record<string, number> } | null> {
  if (!HF_TOKEN) return null;
  try {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MEDGEMMA_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { content, source: `hf/${MEDGEMMA_MODEL}`, usage: data.usage };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symptoms, systemPrompt } = await request.json();

    if (!symptoms || typeof symptoms !== "string") {
      return NextResponse.json(
        { error: "symptoms field is required" },
        { status: 400 }
      );
    }

    const messages = buildMessages(symptoms, systemPrompt);

    // Fallback chain: Kaggle (free GPU) → Ollama (local) → HuggingFace (cloud)
    const kaggleResult = await tryKaggle(messages, symptoms);
    if (kaggleResult) {
      return NextResponse.json({
        response: kaggleResult.content,
        model: kaggleResult.source,
      });
    }

    const ollamaResult = await tryOllama(messages);
    if (ollamaResult) {
      return NextResponse.json({
        response: ollamaResult.content,
        model: ollamaResult.source,
      });
    }

    const hfResult = await tryHuggingFace(messages);
    if (hfResult) {
      return NextResponse.json({
        response: hfResult.content,
        model: hfResult.source,
        usage: hfResult.usage,
      });
    }

    return NextResponse.json(
      { error: "No MedGemma backend available. Configure KAGGLE_MEDGEMMA_URL, set up Ollama locally, or configure HF_TOKEN for cloud inference." },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach MedGemma" },
      { status: 502 }
    );
  }
}

export async function GET() {
  // Quick probe of available backends
  let kaggleReady = false;
  if (KAGGLE_MEDGEMMA_URL) {
    try {
      const res = await fetch(`${KAGGLE_MEDGEMMA_URL}/health`, { headers: NGROK_HEADERS, signal: AbortSignal.timeout(3000) });
      kaggleReady = res.ok;
    } catch {}
  }

  let ollamaReady = false;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    ollamaReady = res.ok;
  } catch {}

  const hasToken = !!HF_TOKEN;
  const ready = kaggleReady || ollamaReady;

  return NextResponse.json({
    status: ready ? "ready" : "no_backend",
    model: MEDGEMMA_MODEL,
    backends: {
      kaggle: kaggleReady ? "ready" : KAGGLE_MEDGEMMA_URL ? "configured_but_offline" : "not_configured",
      ollama: ollamaReady ? "ready" : "unavailable",
      huggingface: hasToken ? "configured" : "no_token",
    },
  });
}
