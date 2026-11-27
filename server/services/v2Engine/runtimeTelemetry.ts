/**
 * Isolated V2 Engine — Runtime Heap Telemetry Helpers (Cloudflare Workers Safe)
 *
 * Cloudflare Workers with `nodejs_compat` can expose `process.memoryUsage()`
 * returning `{ heapUsed: 0 }`. A zero-byte heap reading is an isolate stub and
 * MUST NEVER be classified as `measured`.
 */

export interface RuntimeHeapTelemetrySummary {
  heapMemoryStatus: 'measured' | 'unavailable_in_worker_isolate';
  heapMeasurementNote: string;
  heapBeforeBytes: number | null;
  heapAfterBytes: number | null;
  heapDeltaBytes: number | null;
}

export function normalizePositiveHeapBytes(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function readRuntimeHeapBytes(): number | null {
  try {
    if (
      typeof process !== 'undefined' &&
      typeof process.memoryUsage === 'function'
    ) {
      const mem = process.memoryUsage();
      return normalizePositiveHeapBytes(mem?.heapUsed);
    }
  } catch {
    // Isolate runtimes without process.memoryUsage return null safely
  }
  return null;
}

export function summarizeRuntimeHeapTelemetry(
  rawBeforeBytes: number | null | undefined,
  rawAfterBytes: number | null | undefined
): RuntimeHeapTelemetrySummary {
  const heapBeforeBytes = normalizePositiveHeapBytes(rawBeforeBytes);
  const heapAfterBytes = normalizePositiveHeapBytes(rawAfterBytes);
  const heapMeasured = heapBeforeBytes !== null && heapAfterBytes !== null;

  return {
    heapMemoryStatus: heapMeasured ? 'measured' : 'unavailable_in_worker_isolate',
    heapMeasurementNote: heapMeasured
      ? 'Measured via Node.js process.memoryUsage().heapUsed (> 0 bytes) before and after execution.'
      : 'process.memoryUsage().heapUsed is unavailable or returned 0 bytes inside a Worker isolate; heap metrics are reported as unavailable rather than measured.',
    heapBeforeBytes: heapMeasured ? heapBeforeBytes : null,
    heapAfterBytes: heapMeasured ? heapAfterBytes : null,
    heapDeltaBytes: heapMeasured ? heapAfterBytes - heapBeforeBytes : null,
  };
}
