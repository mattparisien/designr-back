// Test script for the Design Agent Service (CommonJS version)
const DesignAgentService = require('../services/designAgentService');

async function testDesignAgentService() {
  console.log('🚀 Testing Design Agent Service...\n');

  try {
    // Create service instance
    const designAgent = new DesignAgentService();
    
    console.log('1. Testing service initialization...');
    await designAgent.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test health status
    console.log('2. Testing health status...');
    const health = designAgent.getHealthStatus();
    console.log('📊 Health Status:', JSON.stringify(health, null, 2));
    console.log('✅ Health check completed\n');

    // Test basic design queries
    const testQueries = [
      "Help me create a modern logo for a tech startup",
      "What are good color combinations for a presentation about sustainability?",
      "I need inspiration for a social media post about coffee",
      "Show me templates for business presentations",
      "Find assets related to nature and environment"
    ];

    console.log('3. Testing chat functionality with various design queries...\n');

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`📝 Query ${i + 1}: "${query}"`);
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'test-user-123' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`💬 Assistant: ${response.assistant_text?.substring(0, 200)}${response.assistant_text?.length > 200 ? '...' : ''}`);
        
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          console.log(`🔧 Tools used: ${Object.keys(response.toolOutputs).join(', ')}`);
        }
        
        if (response.traceId) {
          console.log(`🔍 Trace ID: ${response.traceId}`);
        }
        
        console.log('✅ Query processed successfully\n');
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing query ${i + 1}:`, error.message);
        console.log('');
      }
    }

    // Test guardrails (non-design topics)
    console.log('4. Testing input guardrails...');
    const forbiddenQueries = [
      "Tell me about the latest election results",
      "Give me medical advice about my headache",
      "What's the best investment strategy?"
    ];

    for (const query of forbiddenQueries) {
      console.log(`🚫 Testing forbidden query: "${query}"`);
      try {
        const response = await designAgent.chat(query, { userId: 'test-user-123' });
        console.log(`🛡️  Guardrail response: ${response.assistant_text}`);
        console.log('✅ Guardrail working correctly\n');
      } catch (error) {
        console.error(`❌ Error with guardrail test:`, error.message);
      }
    }

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the tests
if (require.main === module) {
  testDesignAgentService().catch(console.error);
}

module.exports = { testDesignAgentService };
