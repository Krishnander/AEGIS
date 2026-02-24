// Lightweight telemetry with debug-gated console output.

const DEBUG = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_DEBUG === "true"
  : process.env.NEXT_PUBLIC_DEBUG === "true";

/** Max metrics to retain in memory */
const MAX_METRICS = 100;

export interface SpanMetric {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorMetric {
  timestamp: number;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

interface MetricsBuffer {
  spans: SpanMetric[];
  errors: ErrorMetric[];
}

const buffer: MetricsBuffer = {
  spans: [],
  errors: [],
};

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function debugLog(level: "log" | "warn" | "error", ...args: unknown[]): void {
  if (DEBUG) {
    console[level]("[Telemetry]", ...args);
  }
}

function pushSpan(metric: SpanMetric): void {
  buffer.spans.push(metric);
  if (buffer.spans.length > MAX_METRICS) {
    buffer.spans.shift();
  }
}

function pushError(metric: ErrorMetric): void {
  buffer.errors.push(metric);
  if (buffer.errors.length > MAX_METRICS) {
    buffer.errors.shift();
  }
}

export interface Span {
  /**
   * End the span and record duration.
   * @param metadata Optional extra data to attach to the span.
   */
  end(metadata?: Record<string, unknown>): number;
  /**
   * Add metadata to the span before ending.
   */
  addMetadata(data: Record<string, unknown>): void;
}

/**
 * Core telemetry API.
 * All console output gated by NEXT_PUBLIC_DEBUG.
 */
export const Telemetry = {
  /**
   * Start a timing span. Call span.end() to complete.
   * Uses performance.mark/measure under the hood for DevTools integration.
   */
  startSpan(name: string, metadata?: Record<string, unknown>): Span {
    const startTime = now();
    const markStart = `${name}-start-${startTime}`;

    if (typeof performance !== "undefined" && performance.mark) {
      try {
        performance.mark(markStart);
      } catch {
        // Ignore if marks not supported
      }
    }

    const metric: SpanMetric = {
      name,
      startTime,
      metadata,
    };

    return {
      addMetadata(data: Record<string, unknown>) {
        metric.metadata = { ...metric.metadata, ...data };
      },
      end(endMetadata?: Record<string, unknown>): number {
        const endTime = now();
        const durationMs = endTime - startTime;

        metric.endTime = endTime;
        metric.durationMs = durationMs;
        if (endMetadata) {
          metric.metadata = { ...metric.metadata, ...endMetadata };
        }

        pushSpan(metric);

        if (typeof performance !== "undefined" && performance.measure) {
          const markEnd = `${name}-end-${endTime}`;
          try {
            performance.mark(markEnd);
            performance.measure(name, markStart, markEnd);
          } catch {
            // Ignore if measures not supported
          }
        }

        debugLog("log", `${name}: ${durationMs.toFixed(2)}ms`, metric.metadata ?? "");
        return durationMs;
      },
    };
  },

  /**
   * Capture an error with optional context.
   * Always buffers; logs only if debug enabled.
   */
  captureError(error: unknown, context?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const metric: ErrorMetric = {
      timestamp: Date.now(),
      message: err.message,
      stack: err.stack,
      context,
    };

    pushError(metric);
    debugLog("error", err.message, context ?? "");
  },

  /**
   * Record a simple timing value (e.g., from external source).
   */
  recordLatency(name: string, durationMs: number, metadata?: Record<string, unknown>): void {
    const metric: SpanMetric = {
      name,
      startTime: now() - durationMs,
      endTime: now(),
      durationMs,
      metadata,
    };
    pushSpan(metric);
    debugLog("log", `${name}: ${durationMs.toFixed(2)}ms`, metadata ?? "");
  },

  /**
   * Get current metrics buffer (for debugging/analytics UI).
   */
  getMetrics(): Readonly<MetricsBuffer> {
    return { spans: [...buffer.spans], errors: [...buffer.errors] };
  },

  /**
   * Clear all buffered metrics.
   */
  clearMetrics(): void {
    buffer.spans = [];
    buffer.errors = [];
  },

  /**
   * Check if debug mode is enabled.
   */
  isDebugEnabled(): boolean {
    return DEBUG;
  },
};
