// Comprehensive test with tool usage
const DesignAgentService = require('../services/designAgentService');

async function testWithTools() {
  console.log('🚀 Testing Design Agent with tool usage...\n');

  try {
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    
    // Test queries that should trigger different tools
    const testQueries = [
      {
        query: "Find me some nature photos in my assets",
        expectedTool: "search_assets",
        description: "Should search user's asset library"
      },
      {
        query: "Search my documents for information about sustainability",
        expectedTool: "search_documents", 
        description: "Should search uploaded documents"
      },
      {
        query: "What are the latest design trends for logos?",
        expectedTool: "web_search_preview",
        description: "Should use web search for trends"
      },
      {
        query: "Analyze the colors in this image: https://via.placeholder.com/300/0000FF/FFFFFF?text=Blue",
        expectedTool: "analyze_image",
        description: "Should analyze the provided image"
      }
    ];

    for (let i = 0; i < testQueries.length; i++) {
      const { query, expectedTool, description } = testQueries[i];
      console.log(`\n📝 Test ${i + 1}: ${description}`);
      console.log(`Query: "${query}"`);
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'test-user-123' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`💬 Assistant: ${response.assistant_text?.substring(0, 200)}${response.assistant_text?.length > 200 ? '...' : ''}`);
        
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          console.log(`🔧 Tools used: ${Object.keys(response.toolOutputs).join(', ')}`);
          
          // Log tool outputs
          for (const [toolName, output] of Object.entries(response.toolOutputs)) {
            console.log(`   ${toolName}: ${typeof output === 'string' ? output.substring(0, 100) + '...' : JSON.stringify(output)}`);
          }
        } else {
          console.log(`🔧 No tools used (expected: ${expectedTool})`);
        }
        
        if (response.traceId) {
          console.log(`🔍 Trace ID: ${response.traceId}`);
        }
        
        console.log('✅ Query processed successfully');
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing query ${i + 1}:`, error.message);
      }
    }

    // Test health status
    console.log('\n📊 Final Health Check:');
    const health = designAgent.getHealthStatus();
    console.log(JSON.stringify(health, null, 2));

    console.log('\n🎉 All tool tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testWithTools();
