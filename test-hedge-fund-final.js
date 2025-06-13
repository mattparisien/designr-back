const ProjectAgentService = require('./services/projectAgentService');

async function testHedgeFundPost() {
  console.log('🚀 Testing hedge fund Instagram post with web search...');
  
  try {
    const service = new ProjectAgentService();
    await service.initialize();
    
    console.log('✅ Service initialized');
    console.log('🔧 Available tools:', service.getHealthStatus().tools);
    
    const prompt = "Create an Instagram post about '5 trends in hedge funds right now'. Make sure to include current, up-to-date information about the hedge fund industry.";
    
    console.log('📝 Sending prompt:', prompt);
    
    const result = await service.chat(prompt, 'test-user-123');
    
    console.log('✅ Chat completed successfully!');
    console.log('📱 Assistant response:', result.assistant_text);
    console.log('🔧 Tool outputs:', result.toolOutputs);
    console.log('🆔 Trace ID:', result.traceId);
    
    if (result.toolOutputs && Object.keys(result.toolOutputs).length > 0) {
      console.log('🎉 SUCCESS: Web search tool was used!');
      console.log('🔍 Tools executed:', Object.keys(result.toolOutputs));
    } else {
      console.log('⚠️  No tool outputs detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Full error:', error);
  }
}

testHedgeFundPost();
