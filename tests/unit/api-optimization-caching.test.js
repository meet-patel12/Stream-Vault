const test = require("node:test");
const assert = require("node:assert");

// 1. Test ETag Generation & Freshness Detection
test("API Caching: Computes deterministic 16-char hex ETag for payloads", () => {
  function generateETag(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 0x5bd1e995);
      h2 = Math.imul(h2 ^ ch, 0x27d4eb2f);
    }
    const hex = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, "0");
    return `"${hex}"`;
  }

  const payloadA = { title: "Inception", year: 2010 };
  const payloadB = { title: "Inception", year: 2010 };
  const payloadC = { title: "Interstellar", year: 2014 };

  const etagA = generateETag(payloadA);
  const etagB = generateETag(payloadB);
  const etagC = generateETag(payloadC);

  assert.strictEqual(etagA, etagB, "Identical payloads must yield identical ETags");
  assert.notStrictEqual(etagA, etagC, "Different payloads must yield distinct ETags");
  assert.match(etagA, /^"[a-f0-9]{16}"$/, "ETag must match valid double-quoted 16-hex format");
});

test("API Caching: Returns 304 fresh validation when If-None-Match matches ETag", () => {
  function isClientFresh(reqHeaders, etag, lastModified) {
    const clientETag = reqHeaders["if-none-match"];
    if (clientETag && etag) {
      if (clientETag === etag || clientETag.includes(etag) || clientETag === "*") {
        return true;
      }
    }
    return false;
  }

  const serverETag = '"1234567890abcdef"';

  assert.strictEqual(
    isClientFresh({ "if-none-match": '"1234567890abcdef"' }, serverETag),
    true,
    "Matching ETag must declare client state fresh (HTTP 304 eligible)"
  );

  assert.strictEqual(
    isClientFresh({ "if-none-match": '"different-hash"' }, serverETag),
    false,
    "Non-matching ETag must require new response payload"
  );
});

// 2. Test Single-Flight Request Deduplication
test("API Optimization: Coalesces concurrent in-flight requests to eliminate duplicate queries", async () => {
  const inFlightRequests = new Map();
  let underlyingDatabaseQueries = 0;

  async function dedupedQuery(key, queryFn) {
    const existing = inFlightRequests.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await queryFn();
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, promise);
    return promise;
  }

  // Simulate 10 simultaneous identical incoming API requests
  const simultaneousRequests = Array.from({ length: 10 }).map(() =>
    dedupedQuery("content:featured", async () => {
      underlyingDatabaseQueries++;
      // Simulate 20ms database round trip
      await new Promise((r) => setTimeout(r, 20));
      return { id: 1, title: "Stranger Things" };
    })
  );

  const results = await Promise.all(simultaneousRequests);

  assert.strictEqual(
    underlyingDatabaseQueries,
    1,
    "Single-flight coalescing must only execute 1 database query for 10 simultaneous calls"
  );
  assert.strictEqual(results.length, 10);
  assert.strictEqual(results[0].title, "Stranger Things");
});

// 3. Test Partial Field Filtering
test("API Optimization: Partial response field filtering reduces payload size", () => {
  function filterFields(data, fields) {
    if (!fields || fields.length === 0 || !data) return data;
    const filterItem = (item) => {
      const filtered = {};
      for (const f of fields) {
        if (f in item) filtered[f] = item[f];
      }
      return filtered;
    };
    return Array.isArray(data) ? data.map(filterItem) : filterItem(data);
  }

  const rawCatalog = [
    { id: 1, title: "The Dark Knight", duration: 152, budget: 185000000, secretNote: "Nolan masterwork" },
    { id: 2, title: "Tenet", duration: 150, budget: 200000000, secretNote: "Inverted entropy" },
  ];

  const filtered = filterFields(rawCatalog, ["id", "title"]);

  assert.deepStrictEqual(filtered, [
    { id: 1, title: "The Dark Knight" },
    { id: 2, title: "Tenet" },
  ]);
  assert.strictEqual(filtered[0].budget, undefined);
  assert.strictEqual(filtered[0].secretNote, undefined);
});

// 4. Test Multi-Tiered Rate Limiter with Sliding Window & 429 Retry-After
test("Rate Limiting: Sliding window enforces max request quotas and calculates Retry-After", () => {
  const requestCounts = new Map();

  function rateLimit(key, config) {
    const now = Date.now();
    const record = requestCounts.get(key);
    let allowed = true;
    let remaining = config.maxRequests - 1;
    let resetAt = now + config.windowMs;

    if (!record || now > record.resetAt) {
      requestCounts.set(key, { count: 1, resetAt });
      remaining = config.maxRequests - 1;
    } else if (record.count >= config.maxRequests) {
      allowed = false;
      remaining = 0;
      resetAt = record.resetAt;
    } else {
      record.count++;
      remaining = Math.max(0, config.maxRequests - record.count);
      resetAt = record.resetAt;
    }

    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000));
    return { allowed, remaining, resetAt, retryAfterSeconds, totalLimit: config.maxRequests };
  }

  const config = { windowMs: 60000, maxRequests: 3 };
  const clientKey = "ip:192.168.1.1:search";

  // Request 1: allowed
  const r1 = rateLimit(clientKey, config);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 2);

  // Request 2: allowed
  const r2 = rateLimit(clientKey, config);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 1);

  // Request 3: allowed (limit reached)
  const r3 = rateLimit(clientKey, config);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);

  // Request 4: rejected with HTTP 429
  const r4 = rateLimit(clientKey, config);
  assert.strictEqual(r4.allowed, false);
  assert.strictEqual(r4.remaining, 0);
  assert.ok(r4.retryAfterSeconds > 0 && r4.retryAfterSeconds <= 60);
});

// 5. Test Circuit Breaker Pattern
test("Resilience: Circuit Breaker trips to OPEN on repeated failures and fast-fails", async () => {
  let circuitState = "CLOSED";
  let failureCount = 0;
  const failureThreshold = 3;

  async function executeWithBreaker(op, fallback) {
    if (circuitState === "OPEN") {
      return fallback();
    }
    try {
      const res = await op();
      failureCount = 0;
      return res;
    } catch (err) {
      failureCount++;
      if (failureCount >= failureThreshold) {
        circuitState = "OPEN";
      }
      return fallback();
    }
  }

  const failingOp = async () => {
    throw new Error("Downstream DB connection timed out");
  };
  const fallbackOp = () => ({ status: "degraded", cached: true });

  // 1st failure
  const r1 = await executeWithBreaker(failingOp, fallbackOp);
  assert.strictEqual(circuitState, "CLOSED");

  // 2nd failure
  const r2 = await executeWithBreaker(failingOp, fallbackOp);
  assert.strictEqual(circuitState, "CLOSED");

  // 3rd failure: trips breaker
  const r3 = await executeWithBreaker(failingOp, fallbackOp);
  assert.strictEqual(circuitState, "OPEN");

  // Subsequent call fast-fails immediately via fallback without calling operation
  let opCalled = false;
  const r4 = await executeWithBreaker(async () => {
    opCalled = true;
    return { status: "live" };
  }, fallbackOp);

  assert.strictEqual(opCalled, false, "Breaker in OPEN state must NOT invoke downstream operation");
  assert.strictEqual(r4.status, "degraded");
});
