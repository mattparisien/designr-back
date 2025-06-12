// Test script for chat functionality with conversation history
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api/chat';

async function testChatHistory() {
  console.log('🧪 Testing Chat History Functionality\n');
  
  const userId = 'test-user-123';
  let chatId = null;

  try {
    // Test 1: Send first message (should create new chat)
    console.log('1️⃣ Sending first message...');
    const firstResponse = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Hello! I want to create an Instagram post for my coffee shop.",
        userId: userId
      })
    });

    const firstResult = await firstResponse.json();
    console.log('✅ First message response:', {
      success: firstResult.success,
      chatId: firstResult.chatId,
      messageCount: firstResult.messageCount,
      responsePreview: firstResult.response?.substring(0, 100) + '...'
    });
    
    chatId = firstResult.chatId;

    // Test 2: Send follow-up message using the same chat
    console.log('\n2️⃣ Sending follow-up message...');
    const secondResponse = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Actually, make it about our new morning blend instead.",
        userId: userId,
        chatId: chatId
      })
    });

    const secondResult = await secondResponse.json();
    console.log('✅ Follow-up message response:', {
      success: secondResult.success,
      chatId: secondResult.chatId,
      messageCount: secondResult.messageCount,
      responsePreview: secondResult.response?.substring(0, 100) + '...'
    });

    // Test 3: Get chat history
    console.log('\n3️⃣ Getting chat history...');
    const historyResponse = await fetch(`${BASE_URL}/${chatId}?userId=${userId}`, {
      method: 'GET'
    });

    const historyResult = await historyResponse.json();
    console.log('✅ Chat history:', {
      success: historyResult.success,
      title: historyResult.chat?.title,
      messageCount: historyResult.chat?.messages?.length,
      messages: historyResult.chat?.messages?.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 50) + '...',
        timestamp: msg.timestamp
      }))
    });

    // Test 4: Get user's chats
    console.log('\n4️⃣ Getting user\'s chat list...');
    const userChatsResponse = await fetch(`${BASE_URL}/user/${userId}`, {
      method: 'GET'
    });

    const userChatsResult = await userChatsResponse.json();
    console.log('✅ User\'s chats:', {
      success: userChatsResult.success,
      count: userChatsResult.count,
      chats: userChatsResult.chats?.map(chat => ({
        id: chat._id,
        title: chat.title,
        messageCount: chat.metadata?.totalMessages,
        lastActivity: chat.metadata?.lastActivity
      }))
    });

    // Test 5: Send another message to test context retention
    console.log('\n5️⃣ Testing context retention...');
    const contextResponse = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "What dimensions should this post be?",
        userId: userId,
        chatId: chatId
      })
    });

    const contextResult = await contextResponse.json();
    console.log('✅ Context retention test:', {
      success: contextResult.success,
      messageCount: contextResult.messageCount,
      responsePreview: contextResult.response?.substring(0, 150) + '...'
    });

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testChatHistory();
