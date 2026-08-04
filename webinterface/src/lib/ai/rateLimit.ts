import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 30);

/**
 * Per-user sliding fixed-window rate limiter (in-memory).
 * For multi-instance deploys, replace with Redis / edge KV.
 */
export function checkAiRateLimit(userId: string): {
    ok: boolean;
    remaining: number;
    retryAfterSec: number;
} {
    const now = Date.now();
    let bucket = buckets.get(userId);

    if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + WINDOW_MS };
        buckets.set(userId, bucket);
    }

    if (bucket.count >= MAX_REQUESTS) {
        return {
            ok: false,
            remaining: 0,
            retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
    }

    bucket.count += 1;
    return {
        ok: true,
        remaining: Math.max(0, MAX_REQUESTS - bucket.count),
        retryAfterSec: 0,
    };
}
