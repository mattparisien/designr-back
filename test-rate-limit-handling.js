// Simple test for rate limit handling and token optimization
const { rateLimitedFetch } = require('./utils/rateLimitManager.js');

async function testRateLimitHandling() {
    console.log('Testing rate limit handling...\n');
    
    try {
        // Test 1: Basic rate limited request
        console.log('1. Testing basic rate limited request...');
        const response = await rateLimitedFetch('http://localhost:3001/api/brands', {
            headers: { 'User-ID': '6825167ffe3452cafe0c8440' }
        });
        
        if (response.ok) {
            console.log('✅ Rate limited request successful');
        } else {
            console.log('⚠️ Rate limited request failed:', response.status);
        }
        
        // Test 2: Multiple rapid requests to trigger rate limiting
        console.log('\n2. Testing multiple rapid requests...');
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(
                rateLimitedFetch('http://localhost:3001/api/brands', {
                    headers: { 'User-ID': '6825167ffe3452cafe0c8440' }
                }, { limit: 3, windowMs: 5000 })
            );
        }
        
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ ${successful}/${results.length} requests completed`);
        
        console.log('\n✅ Rate limit handling test completed');
        
    } catch (error) {
        console.error('❌ Rate limit test failed:', error.message);
    }
}

// Run test if executed directly
if (require.main === module) {
    testRateLimitHandling();
}

module.exports = { testRateLimitHandling };
