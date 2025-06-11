// test-agent.js
// Simple test script for the refactored ProjectAgentService

require('dotenv').config();
const ProjectAgentService = require('./services/projectAgentService');

async function testAgent() {
  console.log('🧪 Testing refactored ProjectAgentService...\n');
  
  // Check environment
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  console.log('🔑 OPENAI_API_KEY:', hasApiKey ? 'SET' : 'NOT SET');
  
  if (!hasApiKey) {
    console.log('⚠️ Note: Agent will run in fallback mode without OpenAI integration\n');
  }
  
  const agent = new ProjectAgentService();
  
  try {
    // Test initialization
    console.log('📦 Initializing agent...');
    await agent.initialize();
    
    // Test health status
    console.log('❤️ Health check:');
    const health = agent.getHealthStatus();
    console.log(JSON.stringify(health, null, 2));
    console.log();
    
    // Test chat with a specific social media request
    console.log('💬 Testing chat - requesting Instagram post for coffee shop promotion...');
    const userMessage = "Create an Instagram post project for promoting a new coffee blend at my café called 'Morning Brew'";
    const testUserId = 'test-user-123';
    
    const result = await agent.chat(userMessage, { userId: testUserId });
    
    console.log('🤖 Assistant Response:');
    console.log(result.assistant_text);
    console.log();
    
    if (result.toolOutputs && Object.keys(result.toolOutputs).length > 0) {
      console.log('🔧 Tool Outputs:');
      for (const [toolName, output] of Object.entries(result.toolOutputs)) {
        console.log(`  ${toolName}:`, output);
      }
      console.log();
    }
    
    if (result.traceId) {
      console.log('🔍 Trace ID:', result.traceId);
    }
    
    if (result.error) {
      console.log('❌ Error:', result.error);
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testAgent().catch(console.error);
