// Simple test without guardrails
const DesignAgentService = require('../services/designAgentService');

async function testSimpleQuery() {
  console.log('🚀 Testing simple query without guardrails...\n');

  try {
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    
    // Temporarily modify the agent to remove guardrails for testing
    const originalAgent = designAgent._agent;
    
    console.log('📝 Testing: "Help me create a modern logo"');
    const response = await designAgent.chat("Help me create a modern logo", { userId: 'test-user' });
    
    console.log('💬 Response:', response.assistant_text?.substring(0, 300) + '...');
    console.log('🔧 Tools used:', Object.keys(response.toolOutputs || {}));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSimpleQuery();
