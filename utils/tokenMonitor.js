// Token usage monitoring utility
class TokenUsageMonitor {
    constructor() {
        this.usage = {
            inputTokens: 0,
            outputTokens: 0,
            requests: 0,
            errors: 0,
            rateLimitHits: 0,
            lastReset: Date.now()
        };
        this.limits = {
            inputTokensPerMinute: 40000,
            outputTokensPerMinute: 8000,
            requestsPerMinute: 50
        };
    }

    // Track a request
    trackRequest(inputTokens = 0, outputTokens = 0, hasError = false, isRateLimit = false) {
        const now = Date.now();
        
        // Reset counters every minute
        if (now - this.usage.lastReset > 60000) {
            this.resetCounters();
        }
        
        this.usage.inputTokens += inputTokens;
        this.usage.outputTokens += outputTokens;
        this.usage.requests += 1;
        
        if (hasError) this.usage.errors += 1;
        if (isRateLimit) this.usage.rateLimitHits += 1;
        
        this.checkThresholds();
    }

    // Reset counters
    resetCounters() {
        this.usage = {
            inputTokens: 0,
            outputTokens: 0,
            requests: 0,
            errors: 0,
            rateLimitHits: 0,
            lastReset: Date.now()
        };
    }

    // Check if approaching limits
    checkThresholds() {
        const warnings = [];
        
        if (this.usage.inputTokens > this.limits.inputTokensPerMinute * 0.8) {
            warnings.push(`Input tokens: ${this.usage.inputTokens}/${this.limits.inputTokensPerMinute} (80%+ used)`);
        }
        
        if (this.usage.outputTokens > this.limits.outputTokensPerMinute * 0.8) {
            warnings.push(`Output tokens: ${this.usage.outputTokens}/${this.limits.outputTokensPerMinute} (80%+ used)`);
        }
        
        if (this.usage.requests > this.limits.requestsPerMinute * 0.8) {
            warnings.push(`Requests: ${this.usage.requests}/${this.limits.requestsPerMinute} (80%+ used)`);
        }
        
        if (warnings.length > 0) {
            console.warn('⚠️ Approaching rate limits:', warnings.join(', '));
        }
    }

    // Get current status
    getStatus() {
        return {
            usage: { ...this.usage },
            limits: { ...this.limits },
            remaining: {
                inputTokens: Math.max(0, this.limits.inputTokensPerMinute - this.usage.inputTokens),
                outputTokens: Math.max(0, this.limits.outputTokensPerMinute - this.usage.outputTokens),
                requests: Math.max(0, this.limits.requestsPerMinute - this.usage.requests)
            },
            timeUntilReset: Math.max(0, 60000 - (Date.now() - this.usage.lastReset))
        };
    }

    // Check if request should be delayed
    shouldDelay() {
        return this.usage.inputTokens >= this.limits.inputTokensPerMinute * 0.9 ||
               this.usage.outputTokens >= this.limits.outputTokensPerMinute * 0.9 ||
               this.usage.requests >= this.limits.requestsPerMinute * 0.9;
    }

    // Get recommended delay
    getRecommendedDelay() {
        if (this.shouldDelay()) {
            return Math.max(0, 60000 - (Date.now() - this.usage.lastReset));
        }
        return 0;
    }
}

// Singleton instance
const tokenMonitor = new TokenUsageMonitor();

// Middleware function for Express routes
function tokenMonitoringMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(body) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Estimate token usage based on request/response size
        const requestSize = JSON.stringify(req.body || {}).length;
        const responseSize = JSON.stringify(body).length;
        const estimatedInputTokens = Math.ceil(requestSize / 4); // Rough estimate: 4 chars per token
        const estimatedOutputTokens = Math.ceil(responseSize / 4);
        
        const hasError = res.statusCode >= 400;
        const isRateLimit = res.statusCode === 429;
        
        tokenMonitor.trackRequest(
            estimatedInputTokens,
            estimatedOutputTokens,
            hasError,
            isRateLimit
        );
        
        // Log high-usage requests
        if (estimatedInputTokens > 1000 || duration > 5000) {
            console.log(`🔍 High usage request: ${req.method} ${req.path}, tokens: ~${estimatedInputTokens}, duration: ${duration}ms`);
        }
        
        return originalJson.call(this, body);
    };
    
    next();
}

module.exports = {
    TokenUsageMonitor,
    tokenMonitor,
    tokenMonitoringMiddleware
};
