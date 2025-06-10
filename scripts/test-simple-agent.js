// Simple test for Design Agent Service
console.log('🚀 Starting simple Design Agent test...');

const DesignAgentService = require('../services/designAgentService');

async function simpleTest() {
  try {
    console.log('1. Creating service instance...');
    const designAgent = new DesignAgentService();
    console.log('✅ Service instance created');

    console.log('2. Testing health status before initialization...');
    const healthBefore = designAgent.getHealthStatus();
    console.log('📊 Health before init:', JSON.stringify(healthBefore, null, 2));

    console.log('3. Initializing service...');
    await designAgent.initialize();
    console.log('✅ Service initialized');

    console.log('4. Testing health status after initialization...');
    const healthAfter = designAgent.getHealthStatus();
    console.log('📊 Health after init:', JSON.stringify(healthAfter, null, 2));

    console.log('5. Testing simple chat...');
    const response = await designAgent.chat('Help me create a logo for a tech startup', { userId: 'test-123' });
    console.log('💬 Chat response:', JSON.stringify(response, null, 2));

    console.log('🎉 Simple test completed successfully!');
  } catch (error) {
    console.error('❌ Simple test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

simpleTest();
