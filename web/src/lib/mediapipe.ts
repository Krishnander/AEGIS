import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";
import { calibrateSeverity, CalibrationResult } from "./calibration";

// SINGLETON PATTERN to prevent reloading model on re-renders
let llmInference: LlmInference | null = null;

// State tracking for loading and error states
export interface ModelLoadState {
  status: "idle" | "loading" | "ready" | "error";
  progress: number; // 0-100
  errorMessage?: string;
  lastLoaded?: Date;
}

let loadState: ModelLoadState = {
  status: "idle",
  progress: 0,
};

// Callbacks for progress updates
type ProgressCallback = (state: ModelLoadState) => void;
const progressCallbacks: Set<ProgressCallback> = new Set();

// Subscribe to model loading progress
export function subscribeToLoadProgress(callback: ProgressCallback): () => void {
  progressCallbacks.add(callback);
  // Immediately call with current state
  callback(loadState);
  
  // Return unsubscribe function
  return () => {
    progressCallbacks.delete(callback);
  };
}

// Notify all subscribers of state change
function notifyProgress(state: ModelLoadState) {
  loadState = state;
  progressCallbacks.forEach(callback => callback(state));
}

// Gemma 3 1B IT — latest MediaPipe-compatible model for web (Jan 2026).
// Web-optimized int4 quantized .task file from litert-community/Gemma3-1B-IT
const EDGE_MODEL_URL = process.env.NEXT_PUBLIC_EDGE_MODEL_URL
  || "/models/gemma3-1b-it-int4-web.task";

export const EDGE_MODEL_LABEL = process.env.NEXT_PUBLIC_EDGE_MODEL_LABEL || "Gemma 3 1B Edge";

export async function initEdgeAI(
  options?: {
    onProgress?: ProgressCallback;
    forceReload?: boolean;
  }
): Promise<LlmInference> {
  // Register progress callback if provided
  if (options?.onProgress) {
    progressCallbacks.add(options.onProgress);
  }

  // If already loaded and not forcing reload, return existing instance
  if (llmInference && !options?.forceReload) {
    return llmInference;
  }

  // If currently loading, wait for it to complete
  if (loadState.status === "loading") {
    notifyProgress({ ...loadState, status: "loading", progress: 10 });
    
    // Wait for loading to complete (with timeout)
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();
    
    while (loadState.status === "loading" && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (llmInference) {
      return llmInference;
    }

    if ((loadState as ModelLoadState).status === "error") {
      throw new Error(`Model loading failed: ${loadState.errorMessage}`);
    }
  }

  try {
    notifyProgress({
      status: "loading",
      progress: 0,
      errorMessage: undefined,
    });

    notifyProgress({ ...loadState, progress: 10 });

    notifyProgress({ ...loadState, progress: 20 });

    // Check if required APIs are available
    if (typeof window === 'undefined') {
      throw new Error("MediaPipe requires a browser environment.");
    }

    // Check for sufficient storage
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;
      
      // Model needs ~2GB, require 3GB available
      if (available < 3 * 1024 * 1024 * 1024) {
      }
    }

    notifyProgress({ ...loadState, progress: 30 });

    // Load the WASM fileset
    notifyProgress({ ...loadState, progress: 40, status: "loading" });
    
    const filesetResolver = await FilesetResolver.forGenAiTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
    );

    notifyProgress({ ...loadState, progress: 60, status: "loading" });

    // Load the model
    llmInference = await LlmInference.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: EDGE_MODEL_URL,
        delegate: "GPU",
      },
      maxTokens: 512,
      temperature: 0.3,
      topK: 40,
    });

    notifyProgress({
      status: "ready",
      progress: 100,
      lastLoaded: new Date(),
    });

    return llmInference;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    notifyProgress({
      status: "error",
      progress: 0,
      errorMessage,
    });

    // Clean up partial initialization
    llmInference = null;
    
    throw new Error(`Failed to initialize Edge AI: ${errorMessage}`);
  }
}

export async function runEdgeInference(
  prompt: string,
  options?: {
    enableStreaming?: boolean;
    onPartialResult?: (partial: string) => void;
  }
): Promise<{
  response: string;
  tokensGenerated: number;
  inferenceTime: number;
  severity?: "low" | "medium" | "high";
  calibrated?: boolean;
  calibrationNote?: string;
}> {
  const startTime = Date.now();

  try {
    if (!llmInference) {
      await initEdgeAI();
    }

    // The orchestrator already builds a complete prompt with system instructions,
    // retrieval context, and formatting. Don't re-wrap with the large enhanced prompt.
    const systemPrompt = prompt;

    let tokensGenerated = 0;

    // Race inference against a timeout to prevent the model from generating indefinitely
    const INFERENCE_TIMEOUT_MS = 30_000;
    const response = await Promise.race([
      llmInference!.generateResponse(systemPrompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Edge inference timed out")), INFERENCE_TIMEOUT_MS)
      ),
    ]);

    tokensGenerated = response.split(' ').length;
    const inferenceTime = Date.now() - startTime;

    // Parse and calibrate the response
    let severity: "low" | "medium" | "high" | undefined;
    let calibrated = false;
    let calibrationNote: string | undefined;

    try {
      // Parse the JSON response to extract severity and symptoms
      const parsed = JSON.parse(response);
      const rawSeverity = (parsed.severity || "medium").toLowerCase() as "low" | "medium" | "high";
      const symptoms = Array.isArray(parsed.symptoms) ? parsed.symptoms : [];
      const summary = parsed.summary || "";

      // Apply calibration
      const calibration = calibrateSeverity(rawSeverity, symptoms, summary);
      severity = calibration.severity;
      calibrated = calibration.wasCalibrated;
      calibrationNote = calibration.note;
    } catch {
      // If parsing fails, severity remains undefined
      // The response can still be processed by the caller
    }

    return {
      response,
      tokensGenerated,
      inferenceTime,
      severity,
      calibrated,
      calibrationNote,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Inference failed: ${errorMessage}`);
  }
}

export async function checkModelStatus(): Promise<ModelLoadState> {
  return { ...loadState };
}

export async function testModelConnectivity(): Promise<{
  canConnect: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Test connectivity to model asset
    const response = await fetch(
      EDGE_MODEL_URL,
      { method: "HEAD" }
    );
    
    const latency = Date.now() - startTime;
    
    return {
      canConnect: response.ok,
      latency,
    };
  } catch (error) {
    return {
      canConnect: false,
      latency: -1,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export function resetEdgeAI(): void {
  llmInference = null;
  loadState = {
    status: "idle",
    progress: 0,
  };
}

// Utility to get model loading recommendations
export function getLoadingRecommendations(): string[] {
  const recommendations: string[] = [];

  // Check connection type
  if ("connection" in navigator && navigator.connection) {
    const conn = navigator.connection as { effectiveType?: string; saveData?: boolean };
    if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
      recommendations.push("Your network connection is slow. Model loading may take several minutes.");
    }
    if (conn.saveData) {
      recommendations.push("Data saver mode is enabled. Consider disabling for faster model loading.");
    }
  }

  // Check if on mobile
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    recommendations.push("Mobile device detected. For best performance, use a desktop computer.");
  }

  // Check available memory (if available)
  if ((navigator as any).deviceMemory) {
    const memory = (navigator as any).deviceMemory;
    if (memory < 4) {
      recommendations.push(`Your device has ${memory}GB RAM. Consider closing other applications for better performance.`);
    }
  }

  return recommendations;
}
