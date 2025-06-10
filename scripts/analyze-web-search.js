// Test to understand why web search isn't being used
const DesignAgentService = require('../services/designAgentService');

async function analyzeWebSearchBehavior() {
  console.log('🔍 Analyzing Web Search Tool Behavior...\n');

  try {
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    
    console.log('✅ Service initialized');
    console.log('Available tools:', designAgent.getHealthStatus().tools);
    
    // Test with a query that should definitely need current information
    const testQuery = "What is today's date and what day of the week is it? Do web research.";
    console.log(`\n📝 Test Query: "${testQuery}"`);
    console.log('This query requires current information that the model cannot know...');
    
    console.log('\n⏳ Processing...');
    const startTime = Date.now();
    
    try {
      const response = await designAgent.chat(testQuery, { userId: 'analyze-test' });
      const duration = Date.now() - startTime;
      
      console.log(`\n⏱️  Response Time: ${duration}ms`);
      console.log(`\n💬 Assistant Response:`);
      console.log(response.assistant_text);
      
      console.log(`\n🔧 Tools Used: ${Object.keys(response.toolOutputs || {}).join(', ') || 'None'}`);
      
      if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
        console.log('\n📋 Tool Outputs:');
        for (const [toolName, output] of Object.entries(response.toolOutputs)) {
          console.log(`\n${toolName}:`);
          console.log(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
        }
      } else {
        console.log('\n⚠️  No tools were used. The agent responded without external data.');
        console.log('This might indicate:');
        console.log('1. The web search tool is not properly configured');
        console.log('2. The agent is not choosing to use it');
        console.log('3. There might be an error in tool execution');
      }
      
      if (response.traceId) {
        console.log(`\n🔍 Trace ID: ${response.traceId}`);
      }
      
    } catch (error) {
      console.error('\n❌ Error during chat:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack.split('\n').slice(0, 10).join('\n'));
      }
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the analysis
analyzeWebSearchBehavior();
