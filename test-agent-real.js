// Simple manual test to verify the agent works with real API calls
require('dotenv').config();
const agentService = require('./agentService');

async function testRealAPICall() {
  console.log('🔑 API Key configured:', !!process.env.OPENAI_API_KEY);
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ No OPENAI_API_KEY found. Please set it in your .env file');
    return;
  }

  console.log('🚀 Testing real API call...');
  
  try {
    // Test 1: Simple text response
    console.log('\n📝 Test 1: Simple text response');
    const result1 = await agentService.generateResponse('Say hello in a friendly way');
    console.log('✅ Response:', result1.response);
    console.log('📊 Parsed:', result1.parsed);

    // Test 2: JSON response
    console.log('\n🎯 Test 2: JSON response');
    const result2 = await agentService.generateResponse(
      'Return a simple user object with name and age properties', 
      { type: 'json_object' }
    );
    console.log('✅ Response:', result2.response);
    console.log('📊 Parsed:', result2.parsed);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('💥 Full error:', error);
  }
}

// Run the test
testRealAPICall();
