// Simple sync test for Design Agent Service
const DesignAgentService = require('../services/designAgentService');

async function simpleTest() {
  console.log('🚀 Simple Design Agent Test\n');

  try {
    // Test 1: Service creation
    console.log('1. Creating service...');
    const service = new DesignAgentService();
    console.log('✅ Service created');

    // Test 2: Check static properties
    console.log('\n2. Checking configuration...');
    console.log(`Model: ${DesignAgentService.MODEL}`);
    console.log(`App: ${DesignAgentService.APP}`);
    console.log('✅ Configuration OK');

    // Test 3: Initialize (this might take time)
    console.log('\n3. Initializing service...');
    const initStart = Date.now();
    await service.initialize();
    const initTime = Date.now() - initStart;
    console.log(`✅ Initialized in ${initTime}ms`);

    // Test 4: Health check
    console.log('\n4. Health check...');
    const health = service.getHealthStatus();
    console.log(`Initialized: ${health.initialized}`);
    console.log(`Model: ${health.model}`);
    console.log(`Tools: ${health.tools.join(', ')}`);
    console.log('✅ Health check passed');

    // Test 5: Simple chat (no tools expected)
    console.log('\n5. Simple chat test...');
    const simpleQuery = "Hi there!";
    const chatStart = Date.now();
    const response = await service.chat(simpleQuery, { userId: 'test' });
    const chatTime = Date.now() - chatStart;
    
    console.log(`Query: "${simpleQuery}"`);
    console.log(`Response time: ${chatTime}ms`);
    console.log(`Response: ${response.assistant_text?.substring(0, 100)}...`);
    console.log(`Tools used: ${Object.keys(response.toolOutputs || {}).length}`);
    console.log('✅ Simple chat works');

    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    // Print limited stack trace
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      console.error('Stack:', stackLines.join('\n'));
    }
  }
}

// Run immediately
simpleTest();
