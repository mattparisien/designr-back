// Quick health check and basic response test
const DesignAgentService = require('../services/designAgentService');

async function quickHealthCheck() {
  console.log('🏥 Quick Health Check...\n');

  try {
    console.log('1. Creating service instance...');
    const designAgent = new DesignAgentService();
    console.log('✅ Service created');

    console.log('\n2. Initializing service...');
    await designAgent.initialize();
    console.log('✅ Service initialized');

    console.log('\n3. Checking health status...');
    const health = designAgent.getHealthStatus();
    console.log('Health status:', JSON.stringify(health, null, 2));

    console.log('\n4. Testing basic response (no tools expected)...');
    const basicQuery = "Hello, can you help me with design?";
    console.log(`Query: "${basicQuery}"`);
    
    const response = await designAgent.chat(basicQuery, { userId: 'health-check' });
    
    console.log('\n✅ Basic response received:');
    console.log(response.assistant_text?.substring(0, 200) + '...');
    console.log(`Tools used: ${Object.keys(response.toolOutputs || {}).join(', ') || 'None'}`);

    console.log('\n🎉 Health check completed successfully!');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

quickHealthCheck();
