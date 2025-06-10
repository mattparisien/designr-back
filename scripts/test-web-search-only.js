// Test specifically for web search functionality
const DesignAgentService = require('../services/designAgentService');

async function testWebSearchOnly() {
  console.log('🌐 Testing Web Search Tool Only...\n');

  try {
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    
    console.log('📊 Service Health:');
    const health = designAgent.getHealthStatus();
    console.log(JSON.stringify(health, null, 2));
    console.log('');

    // Test queries that should specifically trigger web search
    const webSearchQueries = [
      "What are the latest logo design trends in 2025?",
      "Show me current color palette trends for web design",
      "Find modern typography examples for branding",
      "What are popular design styles for social media posts?",
      "Get inspiration for minimalist poster designs"
    ];

    for (let i = 0; i < webSearchQueries.length; i++) {
      const query = webSearchQueries[i];
      console.log(`\n📝 Web Search Test ${i + 1}:`);
      console.log(`Query: "${query}"`);
      console.log('⏳ Processing...');
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'test-web-search' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`💬 Assistant Response: ${response.assistant_text?.substring(0, 300)}...`);
        
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          console.log(`🔧 Tools Used: ${Object.keys(response.toolOutputs).join(', ')}`);
          
          // Check if web search was used
          if (response.toolOutputs['web_search_preview']) {
            console.log('✅ Web search tool was called successfully!');
            const searchOutput = response.toolOutputs['web_search_preview'];
            console.log(`🔍 Search Results Preview: ${typeof searchOutput === 'string' ? searchOutput.substring(0, 200) + '...' : 'Object returned'}`);
          } else {
            console.log('❌ Web search tool was not used');
          }
        } else {
          console.log('⚠️  No tools were used - agent responded without web search');
        }
        
        if (response.traceId) {
          console.log(`🔍 Trace ID: ${response.traceId}`);
        }
        
        console.log('✅ Query completed');
        
        // Delay between requests to avoid rate limiting
        if (i < webSearchQueries.length - 1) {
          console.log('⏸️  Waiting 3 seconds before next query...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`❌ Error in test ${i + 1}:`, error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
      }
    }

    console.log('\n🎉 Web search testing completed!');

  } catch (error) {
    console.error('❌ Web search test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testWebSearchOnly();
