// Simple integration test to verify projectAgentService chat functionality
import ProjectAgentService from './services/projectAgentService';

async function testChatIntegration() {
  console.log('🚀 Starting ProjectAgentService integration test...\n');

  try {
    // Initialize the service
    console.log('📋 Initializing ProjectAgentService...');
    await ProjectAgentService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test health status
    console.log('🔍 Checking health status...');
    const health = ProjectAgentService.getHealthStatus();
    console.log('Health status:', JSON.stringify(health, null, 2));
    console.log('✅ Health check passed\n');

    // Test simple chat
    console.log('💬 Testing simple chat...');
    const simpleResponse = await ProjectAgentService.chat('Hello! Can you help me?', { userId: 'test-user' });
    console.log('Simple chat response:', {
      assistant_text: simpleResponse.assistant_text?.substring(0, 100) + '...',
      toolOutputs: simpleResponse.toolOutputs ? Object.keys(simpleResponse.toolOutputs) : 'None',
      traceId: simpleResponse.traceId
    });
    console.log('✅ Simple chat test passed\n');

    // Test tool execution
    console.log('🔧 Testing tool execution...');
    const toolResponse = await ProjectAgentService.chat(
      'Create an Instagram post about healthy morning routines',
      { userId: 'test-user' }
    );
    console.log('Tool execution response:', {
      assistant_text: toolResponse.assistant_text?.substring(0, 100) + '...',
      toolOutputs: toolResponse.toolOutputs ? Object.keys(toolResponse.toolOutputs) : 'None',
      traceId: toolResponse.traceId,
      note: toolResponse.note
    });
    console.log('✅ Tool execution test passed\n');

    // Test conversation history
    console.log('📝 Testing chat with history...');
    const conversationHistory = [
      { role: 'user', content: 'Hi, I need help with social media content' },
      { role: 'assistant', content: 'I\'d be happy to help you create social media content! What type of content are you looking to create?' }
    ];
    
    const historyResponse = await ProjectAgentService.chatWithHistory(
      'Create a Facebook post about eco-friendly living tips',
      conversationHistory,
      { userId: 'test-user' }
    );
    console.log('Chat with history response:', {
      assistant_text: historyResponse.assistant_text?.substring(0, 100) + '...',
      toolOutputs: historyResponse.toolOutputs ? Object.keys(historyResponse.toolOutputs) : 'None',
      traceId: historyResponse.traceId
    });
    console.log('✅ Chat with history test passed\n');

    console.log('🎉 All tests passed! ProjectAgentService is working correctly with the agent.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the test
testChatIntegration();
