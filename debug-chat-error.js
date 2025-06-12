// Debug script for chat error investigation
require('dotenv').config();
const ProjectAgentService = require('./services/projectAgentService');

async function debugChatError() {
  console.log('🔍 Debugging chat error...');
  
  try {
    const service = new ProjectAgentService();
    await service.initialize();
    console.log('✅ Service initialized');
    
    // Test simple chat first
    console.log('\n1️⃣ Testing simple chat...');
    const simpleResult = await service.chat('Create an Instagram post', { userId: 'debug-user' });
    console.log('Simple chat result:', simpleResult);
    
    // Test chat with empty history
    console.log('\n2️⃣ Testing chat with empty history...');
    const emptyHistoryResult = await service.chatWithHistory('Create an Instagram post', [], { userId: 'debug-user' });
    console.log('Empty history result:', emptyHistoryResult);
    
    // Test chat with sample history
    console.log('\n3️⃣ Testing chat with sample history...');
    const sampleHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! How can I help you today?' }
    ];
    const historyResult = await service.chatWithHistory('Create an Instagram post', sampleHistory, { userId: 'debug-user' });
    console.log('History result:', historyResult);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    console.error('Stack:', error.stack);
  }
}

debugChatError().then(() => {
  console.log('🎯 Debug complete');
  process.exit(0);
}).catch(err => {
  console.error('Debug script failed:', err);
  process.exit(1);
});
