/**
 * Resilience & Fault Tolerance Suite:
 * - Circuit Breaker pattern with health inspection
 * - Exponential backoff retry with jitter
 * - Timeout enforcement
 * - Graceful degradation fallback wrappers
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before opening circuit (default: 5)
  cooldownPeriodMs?: number; // Time before attempting half-open recovery (default: 30000)
  requestTimeoutMs?: number; // Max time per request (default: 5000)
}

interface CircuitRecord {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

const circuitRegistry = new Map<string, CircuitRecord>();

/**
 * Executes an operation guarded by a named Circuit Breaker.
 * If the downstream service (e.g. external microservice, slow database query)
 * fails consecutively, the breaker opens, fast-failing subsequent calls to protect resources.
 */
export async function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  fallback?: () => Promise<T> | T,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const {
    failureThreshold = 5,
    cooldownPeriodMs = 30000,
    requestTimeoutMs = 6000,
  } = options;

  let record = circuitRegistry.get(name);
  if (!record) {
    record = {
      state: "CLOSED",
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      successCount: 0,
    };
    circuitRegistry.set(name, record);
  }

  const now = Date.now();

  // If OPEN, check if cooldown period has elapsed to test HALF_OPEN
  if (record.state === "OPEN") {
    if (now >= record.nextAttemptTime) {
      record.state = "HALF_OPEN";
    } else {
      // Circuit is open: fast-fail or invoke fallback
      if (fallback) {
        return fallback();
      }
      throw new Error(`CircuitBreaker[${name}] is OPEN. Fast-failing downstream request.`);
    }
  }

  try {
    // Execute operation with timeout
    const result = await withTimeout(operation(), requestTimeoutMs);

    // On success in HALF_OPEN, transition back to CLOSED
    if (record.state === "HALF_OPEN") {
      record.successCount++;
      if (record.successCount >= 2) {
        record.state = "CLOSED";
        record.failureCount = 0;
        record.successCount = 0;
      }
    } else if (record.state === "CLOSED") {
      record.failureCount = 0;
    }

    return result;
  } catch (err) {
    record.failureCount++;
    record.lastFailureTime = now;

    if (record.failureCount >= failureThreshold || record.state === "HALF_OPEN") {
      record.state = "OPEN";
      record.nextAttemptTime = now + cooldownPeriodMs;
      record.successCount = 0;
    }

    if (fallback) {
      return fallback();
    }
    throw err;
  }
}

/**
 * Enforce a strict timeout on any Promise
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((val) => {
      clearTimeout(timer);
      return val;
    }),
    timeoutPromise,
  ]);
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Execute an asynchronous function with Exponential Backoff & Jitter
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 150,
    maxDelayMs = 3000,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Add jitter (+- 20%) to avoid synchronized retry stampedes
      const jitter = delay * (0.8 + Math.random() * 0.4);
      await new Promise((resolve) => setTimeout(resolve, Math.min(jitter, maxDelayMs)));

      delay *= backoffFactor;
    }
  }

  throw new Error("Retry attempts exhausted");
}

/**
 * Query current status of all registered circuit breakers
 */
export function getCircuitBreakersStatus(): Record<string, { state: CircuitState; failureCount: number }> {
  const status: Record<string, { state: CircuitState; failureCount: number }> = {};
  for (const [name, rec] of circuitRegistry.entries()) {
    status[name] = {
      state: rec.state,
      failureCount: rec.failureCount,
    };
  }
  return status;
}
