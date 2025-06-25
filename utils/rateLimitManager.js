// Rate limiting utility for agent tools
class RateLimitManager {
    constructor() {
        this.requestCounts = new Map();
        this.resetTimes = new Map();
    }

    // Check if we can make a request based on rate limits
    canMakeRequest(endpoint, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const key = endpoint;
        
        // Reset counter if window has passed
        if (this.resetTimes.get(key) && now > this.resetTimes.get(key)) {
            this.requestCounts.delete(key);
            this.resetTimes.delete(key);
        }

        const currentCount = this.requestCounts.get(key) || 0;
        
        if (currentCount >= limit) {
            const resetTime = this.resetTimes.get(key);
            const waitTime = resetTime ? Math.max(0, resetTime - now) : 0;
            return { allowed: false, waitTime };
        }

        return { allowed: true, waitTime: 0 };
    }

    // Record a request
    recordRequest(endpoint, windowMs = 60000) {
        const now = Date.now();
        const key = endpoint;
        
        const currentCount = this.requestCounts.get(key) || 0;
        this.requestCounts.set(key, currentCount + 1);
        
        if (!this.resetTimes.has(key)) {
            this.resetTimes.set(key, now + windowMs);
        }
    }

    // Wait for rate limit reset
    async waitForReset(waitTime) {
        if (waitTime > 0) {
            console.log(`Rate limit hit, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Singleton instance
const rateLimitManager = new RateLimitManager();

// Helper function for rate-limited fetch
export async function rateLimitedFetch(url, options = {}, rateLimit = { limit: 10, windowMs: 60000 }) {
    const { allowed, waitTime } = rateLimitManager.canMakeRequest(url, rateLimit.limit, rateLimit.windowMs);
    
    if (!allowed) {
        await rateLimitManager.waitForReset(waitTime);
    }
    
    rateLimitManager.recordRequest(url, rateLimit.windowMs);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export default rateLimitManager;
