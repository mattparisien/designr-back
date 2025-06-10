// Simple Design Agent Vector Search Test
const DesignAgentService = require('../services/designAgentService');

async function testAgentVectorSearch() {
  console.log('🎯 Testing Design Agent Vector Search Capability\n');

  try {
    console.log('1. Creating and initializing design agent...');
    const agent = new DesignAgentService();
    
    // Initialize with timeout
    const initPromise = agent.initialize();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Initialization timeout')), 10000)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    console.log('✅ Agent initialized');

    console.log('2. Checking agent health...');
    const health = agent.getHealthStatus();
    console.log('📊 Health:', JSON.stringify(health, null, 2));

    console.log('\n3. Testing vector search through agent...');
    
    // Simple query that should trigger asset search
    const query = "Find photos relating to the brand SOUNDFOOD in my assets";
    console.log(`🔍 Query: "${query}"`);
    
    // Set a timeout for the chat
    const chatPromise = agent.chat(query, { userId: null });
    const chatTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Chat timeout')), 15000)
    );
    
    const response = await Promise.race([chatPromise, chatTimeoutPromise]);
    
    console.log('💬 Response received');
    console.log(`📝 Text: ${response.assistant_text?.substring(0, 150)}...`);
    
    const toolsUsed = Object.keys(response.toolOutputs || {});
    console.log(`🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
    
    if (toolsUsed.includes('search_assets')) {
      console.log('✅ Asset search tool was used!');
      const searchOutput = response.toolOutputs['search_assets'];
      console.log(`📊 Search output: ${searchOutput?.substring(0, 200)}...`);
    } else {
      console.log('⚠️  Asset search tool was not used');
    }

    console.log('\n✅ Vector search test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('💡 Suggestion: The service may be having connectivity issues');
      console.log('   - Check internet connection');
      console.log('   - Verify API keys are correct');
      console.log('   - Consider running without external services');
    }
  }
}

// Run with error handling
testAgentVectorSearch().catch(err => {
  console.error('💥 Unhandled error:', err.message);
  process.exit(1);
});
