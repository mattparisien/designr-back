// Token optimization configuration for AI Agent
const TOKEN_OPTIMIZATION = {
    // Reduce verbose logging in production
    PRODUCTION_MODE: process.env.NODE_ENV === 'production',
    
    // Simplified tool descriptions to reduce token usage
    TOOL_DESCRIPTIONS: {
        SHORT: {
            createBrandedProject: 'Create project with brand colors',
            getBranding: 'Get user brand info',
            createProject: 'Create new project'
        },
        FULL: {
            createBrandedProject: 'Create a new project with automatic brand styling applied. This tool fetches the user\'s branding (colors, fonts, etc.) and applies it to the project elements to ensure brand consistency.',
            getBranding: 'Fetch user branding information including color palettes, fonts, logos, and brand voice to use when creating new projects.',
            createProject: 'Create a new project by sending project data to the projects endpoint.'
        }
    },

    // Simplified schemas for faster processing
    USE_SIMPLIFIED_SCHEMAS: true,
    
    // Maximum retry attempts for rate limited requests
    MAX_RETRIES: 3,
    
    // Base delay for exponential backoff (ms)
    BASE_DELAY: 1000,
    
    // Request timeout (ms)
    REQUEST_TIMEOUT: 10000,

    // Token usage tracking
    TOKEN_LIMITS: {
        ANTHROPIC_INPUT_LIMIT: 40000, // per minute
        ANTHROPIC_OUTPUT_LIMIT: 8000,  // per minute
        WARNING_THRESHOLD: 0.8         // 80% of limit
    }
};

// Error messages optimized for brevity
const OPTIMIZED_ERRORS = {
    RATE_LIMIT: 'Rate limit exceeded. Please wait and try again.',
    TIMEOUT: 'Request timeout. Please try again.',
    NETWORK: 'Network error. Check connection.',
    BRAND_NOT_FOUND: 'No branding found. Using defaults.',
    PROJECT_FAILED: 'Project creation failed.'
};

// Simplified response formats
const RESPONSE_FORMATS = {
    SUCCESS: (data) => ({ success: true, data }),
    ERROR: (message, shouldRetry = false) => ({ 
        success: false, 
        error: message, 
        shouldRetry 
    }),
    BRAND_APPLIED: (project, brandInfo) => ({
        success: true,
        data: { project, brandApplied: !!brandInfo }
    })
};

module.exports = {
    TOKEN_OPTIMIZATION,
    OPTIMIZED_ERRORS,
    RESPONSE_FORMATS
};
