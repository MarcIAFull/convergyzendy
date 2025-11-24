/**
 * Rate Limiting Utilities
 * Prevents API abuse and ensures fair usage across restaurants and customers
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (resets on function restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Checks if a request is within rate limits
 * Returns true if allowed, false if rate limit exceeded
 */
export function checkRateLimit(config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const key = config.identifier;
  const entry = rateLimitStore.get(key);

  // No existing entry or window expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimits = {
  // WhatsApp webhook - 60 messages per minute per customer
  WEBHOOK_PER_CUSTOMER: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // AI Agent - 30 requests per minute per customer
  AI_AGENT_PER_CUSTOMER: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // WhatsApp Send - 120 messages per minute per restaurant
  SEND_PER_RESTAURANT: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Connection attempts - 10 per hour per restaurant
  CONNECTION_PER_RESTAURANT: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;

/**
 * Creates a rate limit identifier
 */
export function createRateLimitIdentifier(
  endpoint: string,
  ...identifiers: string[]
): string {
  return `${endpoint}:${identifiers.join(':')}`;
}

/**
 * Cleanup old entries from rate limit store (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`[RateLimit] Cleaned up ${keysToDelete.length} expired entries`);
  }
}

/**
 * Logs rate limit hit
 */
export function logRateLimitHit(
  identifier: string,
  remaining: number,
  resetTime: number
) {
  const resetDate = new Date(resetTime);
  console.warn(`[RateLimit] Limit exceeded for ${identifier}`, {
    remaining,
    resetAt: resetDate.toISOString(),
  });
}
