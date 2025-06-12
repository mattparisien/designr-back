// Debug script to test chat functionality directly
const ProjectAgentService = require('./services/projectAgentService');
// Don't initialize DB for this test

async function debugChat() {
  console.log('🧪 Debug Chat Functionality\n');
  
  try {
    // Test basic chat first
    console.log('1️⃣ Testing basic chat (no history)...');
    const service = new ProjectAgentService();
    await service.initialize();
    
    const basicResult = await service.chat("Create an Instagram post", { userId: "debug-user" });
    console.log('✅ Basic chat result:', {
      success: !basicResult.error,
      hasText: !!basicResult.assistant_text,
      textPreview: basicResult.assistant_text?.substring(0, 100) + '...',
      error: basicResult.error
    });
    
    // Test chat with empty history
    console.log('\n2️⃣ Testing chat with empty history...');
    const emptyHistoryResult = await service.chatWithHistory("Create an Instagram post", [], { userId: "debug-user" });
    console.log('✅ Empty history result:', {
      success: !emptyHistoryResult.error,
      hasText: !!emptyHistoryResult.assistant_text,
      textPreview: emptyHistoryResult.assistant_text?.substring(0, 100) + '...',
      error: emptyHistoryResult.error
    });
    
    // Test chat with simple history
    console.log('\n3️⃣ Testing chat with simple history...');
    const simpleHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! How can I help you?' }
    ];
    
    const historyResult = await service.chatWithHistory("Create an Instagram post for coffee", simpleHistory, { userId: "debug-user" });
    console.log('✅ History result:', {
      success: !historyResult.error,
      hasText: !!historyResult.assistant_text,
      textPreview: historyResult.assistant_text?.substring(0, 100) + '...',
      error: historyResult.error
    });
    
    console.log('\n🎉 Debug completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugChat();
