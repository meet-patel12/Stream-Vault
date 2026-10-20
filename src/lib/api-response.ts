import { NextRequest, NextResponse } from "next/server";
import { generateETag, getHttpCacheHeaders, isClientFresh, HttpCacheOptions } from "./cache";
import { RateLimitResult, getRateLimitHeaders } from "./rate-limit";

export interface SuccessResponseOptions {
  headers?: Record<string, string>;
  cache?: HttpCacheOptions;
  rateLimit?: RateLimitResult;
  req?: NextRequest | Request;
  fields?: string[];
}

/**
 * Filter object or array of objects to selected fields only (Partial Responses)
 */
export function filterFields<T>(data: T, fields?: string[]): any {
  if (!fields || fields.length === 0 || !data) return data;

  const filterItem = (item: any): any => {
    if (typeof item !== "object" || item === null) return item;
    const filtered: Record<string, any> = {};
    for (const f of fields) {
      if (f in item) {
        filtered[f] = item[f];
      }
    }
    return filtered;
  };

  if (Array.isArray(data)) {
    return data.map(filterItem);
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, any>;
    if (Array.isArray(obj.items)) {
      return {
        ...obj,
        items: obj.items.map(filterItem),
      };
    }
    if (Array.isArray(obj.data)) {
      return {
        ...obj,
        data: obj.data.map(filterItem),
      };
    }
  }

  return filterItem(data);
}

/**
 * Standard Success Response with intelligent HTTP caching, ETag validation,
 * conditional 304 handling, and rate limit header injection.
 */
export function successResponse<T>(
  data: T,
  status = 200,
  options: SuccessResponseOptions | Record<string, string> = {}
): NextResponse {
  // Backwards compatibility if 3rd param is raw headers Record
  const opts: SuccessResponseOptions =
    options && !("headers" in options || "cache" in options || "rateLimit" in options || "req" in options)
      ? { headers: options as Record<string, string> }
      : (options as SuccessResponseOptions);

  const payloadData = opts.fields ? filterFields(data, opts.fields) : data;

  const responseHeaders: Record<string, string> = {
    ...(opts.headers || {}),
  };

  // If rate limit result provided, inject rate limit headers
  if (opts.rateLimit) {
    Object.assign(responseHeaders, getRateLimitHeaders(opts.rateLimit));
  }

  // If caching requested, generate ETag and check If-None-Match
  if (opts.cache) {
    const etag = opts.cache.etag || generateETag(payloadData);
    const cacheHeaders = getHttpCacheHeaders({ ...opts.cache, etag });
    Object.assign(responseHeaders, cacheHeaders);

    if (opts.req) {
      const isFresh = isClientFresh(opts.req.headers, etag, opts.cache.lastModified);
      if (isFresh) {
        // Return 304 Not Modified with zero body bytes!
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        });
      }
    }
  }

  return NextResponse.json(
    { success: true, data: payloadData },
    { status, headers: responseHeaders }
  );
}

export function errorResponse(
  message: string,
  status = 400,
  code?: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    { success: false, error: { message, code } },
    { status, headers }
  );
}

export function rateLimitResponse(
  rl: RateLimitResult,
  message = "Too many requests. Please slow down."
) {
  const headers = getRateLimitHeaders(rl);
  return errorResponse(message, 429, "RATE_LIMITED", headers);
}

export function unauthorizedResponse(message = "Unauthorized") {
  return errorResponse(message, 401, "UNAUTHORIZED");
}

export function forbiddenResponse(message = "Forbidden", code = "FORBIDDEN") {
  return errorResponse(message, 403, code);
}

export function notFoundResponse(message = "Not found") {
  return errorResponse(message, 404, "NOT_FOUND");
}

export function validationErrorResponse(message: string) {
  return errorResponse(message, 422, "VALIDATION_ERROR");
}

export function internalErrorResponse(message = "Internal server error") {
  return errorResponse(message, 500, "INTERNAL_ERROR");
}

// Rate limit headers helper (backwards compatibility)
export function withRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  return response;
}
