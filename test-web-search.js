// Test web search functionality
const AgentService = require('./services/agentService');

async function testWebSearch() {
  console.log('🔍 Testing Web Search Functionality...\n');

  try {
    // Create agent with web search enabled (default)
    const agent = new AgentService();
    
    console.log('📋 Agent tools:', agent.toolDefs.map(t => t.type));
    
    // Test a prompt that should trigger web search
    const result = await agent.generateResponse(
      'What is the current weather in New York City today? Please search for recent weather information.',
      { maxSteps: 3 }
    );
    
    console.log('\n✅ Web Search Result:');
    console.log('Response:', result.response);
    console.log('\n🔧 This should contain real weather information from a web search.');
    
  } catch (error) {
    console.error('❌ Error testing web search:', error.message);
    console.error('Full error:', error);
  }
}

// Only run if API key is available
if (process.env.OPENAI_API_KEY) {
  testWebSearch();
} else {
  console.log('⚠️  OPENAI_API_KEY not set. Cannot test web search.');
}
