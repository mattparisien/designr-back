// Simple test with corrected imports
const DesignAgentService = require('../services/designAgentService');

async function testCorrectedImports() {
  console.log('🧪 Testing Design Agent with Corrected Imports...\n');

  try {
    console.log('1. Creating service...');
    const designAgent = new DesignAgentService();
    
    console.log('2. Initializing service...');
    await designAgent.initialize();
    
    console.log('3. Checking health...');
    const health = designAgent.getHealthStatus();
    console.log('Health:', JSON.stringify(health, null, 2));
    
    console.log('\n4. Testing basic chat...');
    const response = await designAgent.chat("Hello! Can you help me with a logo design?", { userId: 'test-user' });
    
    console.log('✅ Response received:');
    console.log('Text:', response.assistant_text?.substring(0, 200) + '...');
    console.log('Tools used:', Object.keys(response.toolOutputs || {}));
    
    if (response.traceId) {
      console.log('Trace ID:', response.traceId);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
}

testCorrectedImports();
