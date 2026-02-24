export interface RetrievalDoc {
  id: string;
  source: string;
  text: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Citation {
  id: string;
  source: string;
  snippet: string;
  score: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface HybridRetrievalResult {
  citations: Citation[];
  context: string;
}

interface ScoredDoc {
  doc: RetrievalDoc;
  score: number;
}

let knowledgeBase: RetrievalDoc[] | null = null;
let idfCache: Map<string, number> | null = null;

// Lightweight tokenizer
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildIdf(docs: RetrievalDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  docs.forEach((doc) => {
    const seen = new Set<string>();
    tokenize(doc.text).forEach((tok) => {
      if (!seen.has(tok)) {
        seen.add(tok);
        df.set(tok, (df.get(tok) || 0) + 1);
      }
    });
  });
  const total = docs.length;
  const idf = new Map<string, number>();
  df.forEach((count, tok) => {
    idf.set(tok, Math.log((total + 1) / (count + 1)) + 1);
  });
  return idf;
}

function bm25Score(query: string, docs: RetrievalDoc[]): ScoredDoc[] {
  if (!idfCache) {
    idfCache = buildIdf(docs);
  }
  const avgLen = docs.reduce((sum, d) => sum + tokenize(d.text).length, 0) / Math.max(1, docs.length);
  const tokens = tokenize(query);
  const k1 = 1.5;
  const b = 0.75;

  return docs.map((doc) => {
    const docTokens = tokenize(doc.text);
    const freq = new Map<string, number>();
    docTokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
    let score = 0;
    tokens.forEach((t) => {
      const idf = idfCache?.get(t) || 0;
      const f = freq.get(t) || 0;
      const denom = f + k1 * (1 - b + (b * docTokens.length) / avgLen);
      score += idf * ((f * (k1 + 1)) / Math.max(1e-6, denom));
    });
    return { doc, score } as ScoredDoc;
  });
}

async function loadKnowledgeBase(): Promise<RetrievalDoc[]> {
  if (knowledgeBase) return knowledgeBase;

  // Built-in clinical reference knowledge base for triage retrieval
  const CLINICAL_KB: RetrievalDoc[] = [
    {
      id: "cardio-001", source: "clinical_guidelines",
      text: "Acute Coronary Syndrome (ACS). Presents with chest pain, diaphoresis, shortness of breath, radiating pain to arm/jaw. Risk factors: age, diabetes, hypertension, smoking, family history. Immediate ECG, cardiac enzymes (troponin), aspirin 325mg. STEMI requires emergent PCI within 90 minutes. NSTEMI managed with anticoagulation and risk stratification.",
      metadata: { category: "cardiac", severity: "high" },
    },
    {
      id: "neuro-001", source: "clinical_guidelines",
      text: "Acute Stroke / Cerebrovascular Accident. Sudden onset facial droop, arm weakness, speech difficulty (FAST criteria). Key: determine last known well time for tPA eligibility (within 4.5 hours). CT head to rule out hemorrhage. NIH Stroke Scale for severity. Large vessel occlusion may benefit from thrombectomy within 24 hours.",
      metadata: { category: "neurological", severity: "high" },
    },
    {
      id: "neuro-002", source: "clinical_guidelines",
      text: "Meningitis / Encephalitis. Presents with severe headache, neck stiffness, photophobia, fever, altered mental status. Kernig and Brudzinski signs. Lumbar puncture for CSF analysis. Empiric antibiotics (ceftriaxone + vancomycin) started before LP if delayed. Viral meningitis typically self-limited. Bacterial meningitis has high mortality without treatment.",
      metadata: { category: "neurological", severity: "high" },
    },
    {
      id: "neuro-003", source: "clinical_guidelines",
      text: "Migraine with Aura. Unilateral throbbing headache with photophobia, phonophobia, nausea, visual aura. Distinguished from tension headache by severity and associated features. Red flags: thunderclap onset, worst headache of life, fever, neurological deficits, papilledema. Treatment: NSAIDs, triptans, antiemetics. Preventive therapy if >4 episodes/month.",
      metadata: { category: "neurological", severity: "medium" },
    },
    {
      id: "resp-001", source: "clinical_guidelines",
      text: "Pulmonary Embolism (PE). Acute dyspnea, pleuritic chest pain, tachycardia, hypoxia. Risk factors: immobilization, surgery, malignancy, oral contraceptives. Wells score for pretest probability. D-dimer for low-risk; CT pulmonary angiography for definitive diagnosis. Anticoagulation with heparin, consider thrombolysis for massive PE.",
      metadata: { category: "respiratory", severity: "high" },
    },
    {
      id: "resp-002", source: "clinical_guidelines",
      text: "Pneumonia. Cough, fever, dyspnea, pleuritic chest pain, crackles on auscultation. CURB-65 score for severity and disposition. Chest X-ray for confirmation. Community-acquired: amoxicillin or macrolide. Hospital-acquired: broad-spectrum antibiotics. Monitor for sepsis, respiratory failure, empyema.",
      metadata: { category: "respiratory", severity: "medium" },
    },
    {
      id: "gi-001", source: "clinical_guidelines",
      text: "Acute Appendicitis. Periumbilical pain migrating to RLQ, anorexia, nausea, fever. McBurney point tenderness, Rovsing sign, psoas sign. CT abdomen/pelvis for diagnosis. Alvarado score for clinical prediction. Surgical appendectomy is definitive treatment. Antibiotics if surgery delayed.",
      metadata: { category: "abdominal", severity: "medium" },
    },
    {
      id: "gi-002", source: "clinical_guidelines",
      text: "Acute Pancreatitis. Epigastric pain radiating to back, nausea, vomiting. Lipase >3x upper limit of normal. Ranson criteria or BISAP score for severity. Common causes: gallstones, alcohol. NPO, IV fluids, pain management. Severe cases may develop necrosis, organ failure.",
      metadata: { category: "abdominal", severity: "high" },
    },
    {
      id: "cardio-002", source: "clinical_guidelines",
      text: "Heart Failure Exacerbation. Dyspnea on exertion, orthopnea, PND, peripheral edema, jugular venous distension. BNP/NT-proBNP elevated. Chest X-ray shows cardiomegaly, pulmonary edema. IV diuretics for decongestion. Monitor daily weights, I/O. Identify precipitant: medication noncompliance, dietary indiscretion, arrhythmia.",
      metadata: { category: "cardiac", severity: "high" },
    },
    {
      id: "infect-001", source: "clinical_guidelines",
      text: "Sepsis / Systemic Inflammatory Response. Suspected infection with >=2 SIRS criteria: temperature >38C or <36C, HR >90, RR >20, WBC >12K or <4K. qSOFA: altered mentation, SBP <=100, RR >=22. Hour-1 bundle: blood cultures, lactate, broad-spectrum antibiotics, 30ml/kg crystalloids. Vasopressors if MAP <65 after fluids.",
      metadata: { category: "infectious", severity: "high" },
    },
    {
      id: "msk-001", source: "clinical_guidelines",
      text: "Fracture Assessment. Pain, swelling, deformity, loss of function after trauma. Neurovascular exam distal to injury. X-ray minimum 2 views. Open fractures require emergent washout and antibiotics. Compartment syndrome: pain out of proportion, pain with passive stretch — surgical emergency.",
      metadata: { category: "musculoskeletal", severity: "medium" },
    },
    {
      id: "endo-001", source: "clinical_guidelines",
      text: "Diabetic Ketoacidosis (DKA). Hyperglycemia >250, metabolic acidosis pH <7.3, ketonemia/ketonuria. Presents with polyuria, polydipsia, abdominal pain, Kussmaul breathing, fruity breath. IV insulin drip, aggressive fluid resuscitation, potassium replacement. Monitor q1-2h BMPs. Identify precipitant: infection, medication noncompliance, new diagnosis.",
      metadata: { category: "endocrine", severity: "high" },
    },
    {
      id: "psych-001", source: "clinical_guidelines",
      text: "Acute Psychiatric Emergency. Suicidal ideation with plan/intent/means, homicidal ideation, acute psychosis with agitation. Safety assessment: remove harmful objects, 1:1 observation. De-escalation techniques before chemical sedation. Medical clearance to rule out organic causes: metabolic, toxic, infectious.",
      metadata: { category: "psychiatric", severity: "high" },
    },
    {
      id: "allergy-001", source: "clinical_guidelines",
      text: "Anaphylaxis. Acute onset urticaria, angioedema, bronchospasm, hypotension after allergen exposure. Epinephrine 0.3-0.5mg IM (anterolateral thigh) FIRST. IV access, fluids, H1/H2 blockers, steroids. Biphasic reaction possible — observe 4-6 hours minimum. Prescribe epinephrine auto-injector on discharge. Allergy referral.",
      metadata: { category: "immunologic", severity: "high" },
    },
  ];

  knowledgeBase = CLINICAL_KB;
  idfCache = null; // Reset IDF cache for new KB
  return knowledgeBase;
}

export async function hybridRetrieve(query: string, k = 5): Promise<HybridRetrievalResult> {
  const docs = await loadKnowledgeBase();
  const bm25 = bm25Score(query, docs);
  const topBm25 = bm25.sort((a, b) => b.score - a.score).slice(0, Math.max(k * 2, k + 2));

  // Dense reranking placeholder — requires embedding model integration

  const ranked = topBm25.sort((a, b) => b.score - a.score).slice(0, k);
  const citations: Citation[] = ranked.map((r) => ({
    id: r.doc.id,
    source: r.doc.source,
    snippet: r.doc.text.slice(0, 400),
    score: Number(r.score.toFixed(4)),
    metadata: r.doc.metadata,
  }));

  const context = citations
    .map((c) => `Source ${c.id} (score ${c.score}): ${c.snippet}`)
    .join("\n\n");

  return { citations, context };
}

export function summarizeCitations(citations: Citation[]): string {
  if (!citations.length) return "No supporting evidence";
  return citations
    .map((c, idx) => `${idx + 1}. [${c.id}] ${c.snippet.slice(0, 180)}...`)
    .join("\n");
}
