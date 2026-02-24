# AEGIS - Clinical Triage AI Assistant

<div align="center">

[![MedGemma](https://img.shields.io/badge/Powered_by-MedGemma-FF6B6B?style=for-the-badge&logo=google&logoColor=white)](https://huggingface.co/collections/google/medgemma-release)
[![HAI-DEF](https://img.shields.io/badge/HAI--DEF-Compliant-4CAF50?style=for-the-badge)](https://goo.gle/hai-def)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

**Advanced Emergency Grid for Intelligent Screening**

A hybrid edge + cloud clinical triage assistant built on Google's MedGemma model family.  
Runs offline in the browser. No patient data leaves the device.

</div>

---

## What It Does

AEGIS takes free-text symptom descriptions (e.g. *"55 y/o male, crushing chest pain radiating to left arm, diaphoresis"*) and returns:

- **Severity classification** - HIGH / MEDIUM / LOW with clinical justification
- **Symptom extraction** - discrete tags for each identified symptom
- **Clinical assessment** - differential reasoning and recommended next steps
- **Causal reasoning graph** - visual map of how symptoms contribute to the risk classification
- **Clinical Reasoning panel** - three views of the model's decision process:
  - *Features* - per-symptom attribution (which symptoms drove the classification)
  - *Reasoning* - step-by-step trace with clinical guideline citations
  - *What-If* - counterfactual analysis (how the output changes if symptoms are added/removed)

> **Disclaimer:** AEGIS is a research demonstration. It is not approved for clinical diagnosis or treatment decisions. All data is synthetic.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│                                                          │
│  ┌──────────────┐    ┌────────────────────────────────┐ │
│  │   Chat UI    │    │        Edge AI Layer            │ │
│  │  (Next.js)   │───▶│  Gemma 3 1B · MediaPipe · WGPU │ │
│  └──────────────┘    └────────────────────────────────┘ │
│         │                                                │
│         │                                                │
│         ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Cloud API (Kaggle T4 GPU)               │  │
│  │  MedGemma 1.5 4B IT · NF4 · FastAPI · ngrok       │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Output Layer                          │  │
│  │  Severity · Symptoms · Causal Graph · Reasoning    │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Layer | Model | Runtime | Role |
|-------|-------|---------|------|
| **Edge** | Gemma 3 1B IT - int4 LiteRT (668 MB) | MediaPipe LLM Inference (WebGPU) | Offline triage - all computation in-browser |
| **Cloud** | MedGemma 1.5 4B IT - NF4 quantised | FastAPI on Kaggle T4 via ngrok | Deeper reasoning when connectivity available |

The system tries the cloud backend first, then falls back to edge inference automatically.

---

## Quick Start

### Option 1: Docker (recommended)

```bash
git clone <repository-url>
cd aegis-core
docker compose up --build     # → http://localhost:3000
```

> **Note:** The 668 MB edge model file (`web/public/models/gemma3-1b-it-int4-web.task`) is git-ignored and must be placed manually. See [Model Setup](#model-setup).

### Option 2: Local Development

```bash
cd web
npm install
npm run dev                   # → http://localhost:3000
```

### Model Setup

1. Download the Gemma 3 1B IT int4 LiteRT task bundle from [litert-community/Gemma3-1B-IT](https://huggingface.co/litert-community/Gemma3-1B-IT) on Hugging Face.
2. Place the `.task` file in `web/public/models/gemma3-1b-it-int4-web.task`.
3. The model loads automatically when you open the app.

For the cloud backend, see [Cloud Backend Setup](#cloud-backend-setup).

---

## Configuration

Create `web/.env.local`:

```env
# Cloud backend (optional - Kaggle ngrok URL)
NEXT_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app

# Edge model - defaults to /models/gemma3-1b-it-int4-web.task
NEXT_PUBLIC_EDGE_MODEL_URL=
NEXT_PUBLIC_EDGE_MODEL_LABEL=Gemma 3 1B Edge

# Flags
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_EDGE_ONLY=false
```

---

## Cloud Backend Setup

The cloud backend runs MedGemma 1.5 4B IT on a Kaggle T4 GPU, exposed via ngrok.

1. Create a Kaggle Notebook with **GPU T4 x2** accelerator and **Internet** enabled.
2. Copy cells from `brain/medgemma_kaggle_server.ipynb`.
3. Set Kaggle secrets: `HF_TOKEN` (HuggingFace read token), `NGROK_TOKEN`.
4. Run all cells. Copy the ngrok URL and set it in `.env.local` as `NEXT_PUBLIC_API_URL`.

**HuggingFace access:**
1. Accept the MedGemma license at [huggingface.co/collections/google/medgemma-release](https://huggingface.co/collections/google/medgemma-release).
2. Generate a read token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).

---

## Project Structure

```
aegis-core/
├── web/                              # Next.js 14 frontend
│   ├── src/
│   │   ├── app/                     # App Router - pages + API routes
│   │   │   ├── page.tsx             # Main dashboard
│   │   │   └── api/analyze/         # Cloud API proxy (Kaggle → Ollama → HF)
│   │   ├── components/
│   │   │   ├── chat/                # Chat interface, message list, header
│   │   │   ├── dashboard/           # Dashboard layout, clinical summary
│   │   │   ├── graph/               # Causal reasoning graph (React Flow)
│   │   │   ├── metrics/             # Clinical Reasoning panel (Features/Reasoning/What-If)
│   │   │   └── ui/                  # shadcn/ui primitives
│   │   ├── hooks/
│   │   │   └── use-agent.ts         # Analysis orchestration hook
│   │   ├── lib/
│   │   │   ├── mediapipe.ts         # Edge AI - Gemma 3 1B via MediaPipe
│   │   │   ├── orchestrator.ts      # Analysis pipeline + response cache
│   │   │   ├── retrieval.ts         # BM25 clinical knowledge base (14 guidelines)
│   │   │   ├── explainability.ts    # Feature attribution, reasoning chains, counterfactuals
│   │   │   ├── calibration.ts       # Severity calibration + conformal prediction
│   │   │   ├── safety.ts            # Input validation, PII detection, guardrails
│   │   │   └── utils.ts             # JSON repair, symptom extraction
│   │   └── workers/
│   │       └── mediapipe.worker.ts  # Web Worker for edge inference
│   ├── public/
│   │   └── models/                  # LiteRT .task bundle (git-ignored)
│   ├── Dockerfile                   # Multi-stage Alpine build
│   └── package.json
├── brain/                            # Cloud backend
│   ├── medgemma_kaggle_server.ipynb # Kaggle notebook - MedGemma 1.5 4B
│   ├── prompts.py                   # Clinical prompt templates
│   └── requirements.txt
├── docker-compose.yml
└── LICENSE                           # Apache 2.0
```

---

## Testing

```bash
cd web
npm test                    # Vitest - single run (190 tests)
npm run test:watch          # Vitest - watch mode
```

---

## Technical Notes

**Edge inference performance:** ~3–4 seconds per query on modern hardware (Chrome with WebGPU). Response caching and eager model preload during the loading screen reduce perceived latency for repeated queries.

**Clinical knowledge base:** 14 curated guideline entries covering cardiology, neurology, respiratory, GI, infectious disease, musculoskeletal, endocrinology, psychiatry, and allergy. BM25 hybrid retrieval augments model responses with relevant citations.

**Safety pipeline:** Input sanitisation, PII detection, overconfidence flagging, out-of-distribution detection, and severity calibration (temperature scaling with conformal prediction). Edge inference keeps all data in-browser - no network transmission.

**Deployment options:**
- **Docker** - full stack including edge model
- **Kaggle notebook** - cloud backend for MedGemma 1.5 4B

---

## API

### `POST /api/analyze`

```json
{ "symptoms": "55 y/o male, chest pain radiating to left arm, diaphoresis" }
```

Returns structured JSON with severity, symptoms, clinical assessment, and recommendations.

### `useAgent()` Hook

```typescript
const { status, result, analyze, reset, error } = useAgent();
// status: "idle" | "initializing" | "loading" | "streaming" | "complete" | "error"
// analyze: (symptoms: string) => Promise<AnalysisResult | null>
```

---

## References

1. Yang et al. (2025). MedGemma: A Collection of Clinically-Relevant AI Models. arXiv:2507.05201.
2. Angelopoulos & Bates (2023). Conformal Prediction: A Gentle Introduction. FTML.
3. Guo et al. (2017). On Calibration of Modern Neural Networks. ICML.
4. Hinson et al. (2019). Triage Performance in Emergency Medicine. Annals of Emergency Medicine.
5. EU Parliament (2024). AI Act, Regulation 2024/1689.

---

## License

Apache 2.0 - see [LICENSE](LICENSE).

---

<div align="center">
  <sub>AEGIS · Powered by Google MedGemma · For research purposes only · Not for clinical use</sub>
</div>
