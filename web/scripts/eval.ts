#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { hybridRetrieve } from "../src/lib/retrieval";
import { buildAugmentedPrompt } from "../src/lib/orchestrator";
import { runEdgeInference } from "../src/lib/mediapipe";
import { parseAIResponse } from "../src/lib/utils";

interface EvalSample {
  id: string;
  prompt: string;
  expected?: string;
}

interface EvalResult {
  id: string;
  predictedSeverity: string;
  expectedSeverity?: string;
  citations: number;
  matched?: boolean;
  predictedSeverityRaw?: string;
  calibrationNote?: string;
}

function normalizeSeverity(severity: string | undefined): "low" | "medium" | "high" {
  const normalized = (severity || "medium").toLowerCase();
  return ["low", "medium", "high"].includes(normalized)
    ? (normalized as "low" | "medium" | "high")
    : "medium";
}

function heuristicSeverity(text: string): "low" | "medium" | "high" {
  const lower = text.toLowerCase();
  if (/stroke|slurred speech|facial droop|chest pain|radiating|anaphylaxis|sepsis|shock|uncontrolled bleeding|shortness of breath/.test(lower)) {
    return "high";
  }
  if (/fever|vomit|vomiting|diarrhea|pain|fracture|wheezing|dizziness|palpitations/.test(lower)) {
    return "medium";
  }
  return "low";
}

async function evaluate(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const samples: EvalSample[] = JSON.parse(raw);
  const results: EvalResult[] = [];

  for (const sample of samples) {
    const retrieval = await hybridRetrieve(sample.prompt, 3);
    const prompt = buildAugmentedPrompt(sample.prompt, retrieval, 0);
    let predictedSeverity: "low" | "medium" | "high";
    let predictedSeverityRaw: string | undefined;
    let calibrationNote: string | undefined;
    try {
      const edge = await runEdgeInference(prompt, { enableStreaming: false });
      const parsed = parseAIResponse(edge.response);
      predictedSeverity = normalizeSeverity(parsed.severity);
      predictedSeverityRaw = parsed.severityRaw;
      calibrationNote = parsed.calibrationNote;
    } catch {
      predictedSeverity = heuristicSeverity(sample.prompt + " " + retrieval.context);
    }
    results.push({
      id: sample.id,
      predictedSeverity,
      expectedSeverity: sample.expected,
      citations: retrieval.citations.length,
      predictedSeverityRaw,
      calibrationNote,
    });
  }

  const withLabels = results.filter((r) => r.expectedSeverity);
  const labeledResults = withLabels.map((r) => ({
    ...r,
    matched: r.predictedSeverity === r.expectedSeverity,
  }));
  const accuracy = labeledResults.length
    ? labeledResults.filter((r) => r.matched).length / labeledResults.length
    : 0;

  const labels = ["low", "medium", "high"] as const;
  const confusion: Record<string, Record<string, number>> = {};
  labels.forEach((label) => {
    confusion[label] = { low: 0, medium: 0, high: 0 };
  });
  labeledResults.forEach((r) => {
    if (!r.expectedSeverity) return;
    const expected = r.expectedSeverity as typeof labels[number];
    const predicted = (labels.includes(r.predictedSeverity as any) ? r.predictedSeverity : "medium") as typeof labels[number];
    confusion[expected][predicted] += 1;
  });

  const perLabel = labels.map((label) => {
    const tp = confusion[label][label];
    const fn = labels.reduce((sum, l) => sum + (l === label ? 0 : confusion[label][l]), 0);
    const fp = labels.reduce((sum, l) => sum + (l === label ? 0 : confusion[l][label]), 0);
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    return { label, precision, recall, support: tp + fn };
  });

  console.log("\n=== Eval Summary ===");
  console.log(`Samples: ${results.length}`);
  console.log(`Labeled: ${withLabels.length}`);
  console.log(`Accuracy (severity): ${(accuracy * 100).toFixed(2)}%`);
  console.log("\nPer-label metrics:");
  perLabel.forEach((m) => {
    console.log(
      `${m.label}: precision ${(m.precision * 100).toFixed(1)}% | recall ${(m.recall * 100).toFixed(1)}% | support ${m.support}`
    );
  });
  console.log("\nConfusion matrix:");
  console.table(confusion);

  fs.writeFileSync(
    path.join(process.cwd(), "eval-report.json"),
    JSON.stringify({ accuracy, results: labeledResults, confusion, perLabel }, null, 2)
  );
  console.log("Saved eval-report.json");
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: pnpm eval <path-to-json-samples>");
  process.exit(1);
}

evaluate(path.resolve(fileArg)).catch((err) => {
  console.error(err);
  process.exit(1);
});
