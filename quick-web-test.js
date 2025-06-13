const ProjectAgentService = require('./services/projectAgentService');

async function quickTest() {
  console.log('🚀 Quick web search test...');
  
  try {
    const service = new ProjectAgentService();
    console.log('📍 Service created, initializing...');
    
    await service.initialize();
    console.log('✅ Service initialized successfully');
    
    const health = service.getHealthStatus();
    console.log('🔧 Health status:', JSON.stringify(health, null, 2));
    
    // Prompt that should trigger web search AND create a social media post
    const prompt = "Search online for the 5 key hedge fund trends in 2025, then create an Instagram post about these trends. Make sure the post is engaging and includes current information from your search.";
    console.log('📝 Testing with prompt:', prompt);
    
    const startTime = Date.now();
    const result = await service.chat(prompt, 'test-user');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Chat completed in ${duration}ms`);
    console.log('📱 Response length:', result.assistant_text?.length || 0);
    console.log('🔧 Tool outputs keys:', Object.keys(result.toolOutputs || {}));
    
    // Log the full model response
    console.log('\n📝 MODEL RESPONSE:');
    console.log('==================');
    console.log(result.assistant_text || 'No response text');
    console.log('==================\n');
    
    if (result.toolOutputs && Object.keys(result.toolOutputs).length > 0) {
      console.log('🎉 SUCCESS: Tools were executed!');
      console.log('\n🔍 TOOL OUTPUTS:');
      console.log('================');
      for (const [tool, output] of Object.entries(result.toolOutputs)) {
        console.log(`\n🔧 Tool: ${tool}`);
        console.log(`📄 Output: ${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}`);
        
        // Special handling for web search output
        if (tool.includes('web_search') || tool.includes('search')) {
          console.log(`🔍 Web Search Detected - Tool: ${tool}`);
          console.log(`📋 Search Output Length: ${output?.length || 0} characters`);
        }
        
        // Special handling for social media tool output
        if (tool.includes('social') || tool.includes('post') || tool.includes('instagram')) {
          console.log(`📱 Social Media Tool Detected - Tool: ${tool}`);
          console.log(`📝 Post Content Preview: ${output?.substring(0, 200) || 'No content'}...`);
        }
      }
      console.log('================\n');
    } else {
      console.log('⚠️  No tools were executed');
      console.log('💡 Expected: web search tool + social media creation tool');
    }
    
    // Log additional result properties
    if (result.traceId) {
      console.log('🆔 Trace ID:', result.traceId);
    }
    if (result.note) {
      console.log('📝 Note:', result.note);
    }
    if (result.error) {
      console.log('⚠️  Error in result:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('📋 Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

quickTest().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Test crashed:', err);
  process.exit(1);
});
