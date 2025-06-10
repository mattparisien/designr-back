// Minimal web search test
const DesignAgentService = require('../services/designAgentService');

async function minimalWebSearchTest() {
  console.log('🔬 Minimal Web Search Test...\n');

  try {
    console.log('Creating service...');
    const designAgent = new DesignAgentService();
    
    console.log('Initializing...');
    await designAgent.initialize();
    
    console.log('Service initialized successfully!');
    console.log('Health:', designAgent.getHealthStatus());
    
    // Very direct request for web search
    const queries = [
      "Search the web for today's date",
      "What day is today? Please search online",
      "Use your web search tool to find current information"
    ];

    for (const query of queries) {
      console.log(`\n🔍 Testing: "${query}"`);
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'minimal-test' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Time: ${duration}ms`);
        console.log(`📝 Response: ${response.assistant_text?.substring(0, 150)}...`);
        
        // Check tools
        const toolsUsed = Object.keys(response.toolOutputs || {});
        console.log(`🔧 Tools: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'None'}`);
        
        if (toolsUsed.includes('web_search_preview')) {
          console.log('✅ WEB SEARCH WORKED!');
          console.log('Result:', response.toolOutputs['web_search_preview']);
        }
        
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

minimalWebSearchTest();
