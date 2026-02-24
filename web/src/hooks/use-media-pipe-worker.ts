/* eslint-disable react-hooks/rules-of-hooks */
import { useState, useEffect, useRef, useCallback } from "react";

// Worker message types
interface WorkerStatus {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  message?: string;
}

interface InferenceResult {
  response: string;
  tokensGenerated: number;
  inferenceTime: number;
}

interface UseMediaPipeWorkerOptions {
  autoInitialize?: boolean;
  onStatusChange?: (status: WorkerStatus) => void;
  onError?: (error: string) => void;
}

export function useMediaPipeWorker(options: UseMediaPipeWorkerOptions = {}) {
  const { autoInitialize = true, onStatusChange, onError } = options;

  const [status, setStatus] = useState<WorkerStatus>({
    status: "idle",
    progress: 0,
  });
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: (r: InferenceResult) => void; reject: (e: Error) => void }>>(new Map());

  // Initialize worker
  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL("../workers/mediapipe.worker.ts", import.meta.url),
      { type: "module" }
    );

    // Handle messages from worker
    workerRef.current.onmessage = (event) => {
      const { type, id, ...data } = event.data;

      switch (type) {
        case "STATUS":
          const newStatus = data as WorkerStatus;
          setStatus(newStatus);
          onStatusChange?.(newStatus);
          break;

        case "RESULT":
          const result = data as InferenceResult;
          const pending = pendingRequests.current.get(id || "");
          if (pending) {
            pending.resolve(result);
            pendingRequests.current.delete(id || "");
          }
          break;

        case "ERROR":
          const errorMessage = data.error as string;
          const pendingError = pendingRequests.current.get(id || "");
          if (pendingError) {
            pendingError.reject(new Error(errorMessage));
            pendingRequests.current.delete(id || "");
          }
          onError?.(errorMessage);
          break;

        case "PONG":
          // Health check response
          setIsWorkerReady(true);
          break;
      }
    };

    // Handle worker errors
    workerRef.current.onerror = (error) => {
      console.error("Worker error:", error);
      setStatus({ status: "error", progress: 0, message: "Worker failed" });
      onError?.("Worker failed");
    };

    // Auto-initialize if enabled
    if (autoInitialize) {
      initialize();
    }

    // Cleanup
    return () => {
      workerRef.current?.terminate();
    };
  }, [autoInitialize, onStatusChange, onError]);

  // Initialize the worker
  const initialize = useCallback((forceReload = false) => {
    if (!workerRef.current) return;

    setStatus({ status: "loading", progress: 0, message: "Initializing..." });
    workerRef.current.postMessage({ type: "INIT", forceReload });
  }, []);

  // Run inference
  const infer = useCallback(async (prompt: string): Promise<InferenceResult | null> => {
    if (!workerRef.current || status.status !== "ready") {
      // Queue the request if worker is initializing
      if (status.status === "loading") {
        return new Promise((resolve) => {
          // Wait for ready state
          const checkReady = () => {
            if (status.status === "ready") {
              infer(prompt).then(resolve);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          setTimeout(checkReady, 100);
        });
      }

      onError?.("Worker not ready");
      return null;
    }

    // Generate unique ID for this request
    const id = `infer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // Store the promise callbacks
      pendingRequests.current.set(id, { resolve: (r) => resolve(r), reject });

      // Send inference request
      workerRef.current?.postMessage({ type: "INFER", id, prompt });
    });
  }, [status.status, onError]);

  // Health check
  const ping = useCallback(() => {
    workerRef.current?.postMessage({ type: "PING" });
  }, []);

  // Reset worker
  const reset = useCallback(() => {
    workerRef.current?.terminate();
    pendingRequests.current.clear();
    setStatus({ status: "idle", progress: 0 });
    setIsWorkerReady(false);
    
    // Create new worker
    workerRef.current = new Worker(
      new URL("../workers/mediapipe.worker.ts", import.meta.url),
      { type: "module" }
    );

    // Re-setup message handler (simplified - in production, refactor to avoid duplication)
    workerRef.current.onmessage = (event) => {
      const { type, id, ...data } = event.data;
      if (type === "PONG") {
        setIsWorkerReady(true);
      }
    };
  }, []);

  return {
    status,
    isReady: status.status === "ready",
    isWorkerReady,
    initialize,
    infer,
    ping,
    reset,
  };
}

// Singleton hook for app-wide usage
const singletonWorkerRef: { current: ReturnType<typeof useMediaPipeWorker> | null } = {
  current: null,
};

export function useMediaPipeWorkerSingleton() {
  if (!singletonWorkerRef.current) {
    singletonWorkerRef.current = useMediaPipeWorker({ autoInitialize: false });
  }
  return singletonWorkerRef.current;
}
