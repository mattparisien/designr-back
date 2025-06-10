// Test with explicit web search requests
const DesignAgentService = require('../services/designAgentService');

async function testExplicitWebSearch() {
  console.log('🌐 Testing Explicit Web Search Requests...\n');

  try {
    const designAgent = new DesignAgentService();
    await designAgent.initialize();

    // Test queries that explicitly request web search
    const explicitQueries = [
      "Search the web for the latest logo design trends in 2025",
      "Can you look up current color palette trends online?",
      "Please search for modern typography examples on the internet",
      "Use web search to find popular design styles for social media",
      "Search online for minimalist poster design inspiration"
    ];

    for (let i = 0; i < explicitQueries.length; i++) {
      const query = explicitQueries[i];
      console.log(`\n📝 Explicit Web Search Test ${i + 1}:`);
      console.log(`Query: "${query}"`);
      console.log('⏳ Processing...');
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'test-explicit-search' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`💬 Assistant Response: ${response.assistant_text?.substring(0, 300)}...`);
        
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          console.log(`🔧 Tools Used: ${Object.keys(response.toolOutputs).join(', ')}`);
          
          // Check specifically for web search
          if (response.toolOutputs['web_search_preview']) {
            console.log('✅ Web search tool was used successfully!');
            const searchOutput = response.toolOutputs['web_search_preview'];
            console.log(`🔍 Search Results: ${typeof searchOutput === 'string' ? searchOutput.substring(0, 300) + '...' : JSON.stringify(searchOutput).substring(0, 300) + '...'}`);
          } else {
            console.log('❌ Web search tool was not used despite explicit request');
            // Log all tool outputs to see what was used instead
            Object.entries(response.toolOutputs).forEach(([tool, output]) => {
              console.log(`   ${tool}: ${typeof output === 'string' ? output.substring(0, 100) + '...' : 'Object'}`);
            });
          }
        } else {
          console.log('⚠️  No tools were used despite explicit web search request');
        }
        
        console.log('✅ Query completed');
        
        // Short delay between requests
        if (i < explicitQueries.length - 1) {
          console.log('⏸️  Waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Error in explicit test ${i + 1}:`, error.message);
        if (error.code) console.error(`Error code: ${error.code}`);
      }
    }

    console.log('\n🎉 Explicit web search testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testExplicitWebSearch();
