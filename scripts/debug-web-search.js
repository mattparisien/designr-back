// Debug web search tool configuration
const DesignAgentService = require('../services/designAgentService');

async function debugWebSearchTool() {
  console.log('🔍 Debugging Web Search Tool Configuration...\n');

  try {
    // Test 1: Check if the tool is properly configured
    console.log('1. Testing dynamic imports...');
    const agentsModule = await import('@openai/agents');
    console.log('✅ @openai/agents imported successfully');
    console.log('Available functions:', Object.keys(agentsModule).filter(k => k.includes('web')));
    
    // Test 2: Create the web search tool directly
    console.log('\n2. Testing web search tool creation...');
    const { webSearchTool } = agentsModule;
    const testWebTool = webSearchTool({
      userLocation: {
        type: 'approximate',
        city: 'Toronto',
      },
    });
    console.log('✅ Web search tool created:', typeof testWebTool);
    console.log('Tool properties:', Object.keys(testWebTool));
    
    // Test 3: Initialize design agent and check tools
    console.log('\n3. Testing design agent initialization...');
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    
    const health = designAgent.getHealthStatus();
    console.log('Agent tools:', health.tools);
    
    // Test 4: Try a very simple web search request
    console.log('\n4. Testing simple web search request...');
    const simpleQuery = "Please use web search to find what day it is today";
    console.log(`Query: "${simpleQuery}"`);
    
    const response = await designAgent.chat(simpleQuery, { userId: 'debug-test' });
    
    console.log('Response:', response.assistant_text?.substring(0, 200) + '...');
    console.log('Tools used:', Object.keys(response.toolOutputs || {}));
    
    if (response.toolOutputs?.['web_search_preview']) {
      console.log('✅ Web search was triggered!');
      console.log('Search output:', response.toolOutputs['web_search_preview']);
    } else {
      console.log('❌ Web search was not triggered');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugWebSearchTool();
