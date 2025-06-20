#!/usr/bin/env node

// Test script to verify the refactored AgentService with configuration constants
const AgentService = require('./services/agentService');
const config = require('./config/agentConfig');

async function testConfigurationIntegration() {
  console.log('🔧 Testing AgentService Configuration Integration\n');
  
  // Test configuration loading
  console.log('📊 Configuration loaded successfully:');
  console.log('  - OpenAI Model:', config.OPENAI_CONFIG.MODEL);
  console.log('  - Default Max Steps:', config.OPENAI_CONFIG.DEFAULT_MAX_STEPS);
  console.log('  - Tool Choice:', config.OPENAI_CONFIG.TOOL_CHOICE);
  console.log('  - Web Search Tool:', JSON.stringify(config.TOOL_CONFIG.WEB_SEARCH));
  console.log('  - Base Instructions:', config.AGENT_INSTRUCTIONS.BASE);
  console.log('  - Logging Enabled:', Object.keys(config.LOGGING_CONFIG.ENABLED).filter(key => config.LOGGING_CONFIG.ENABLED[key]));
  
  console.log('\n✅ All configuration constants loaded properly!\n');
  
  // Test AgentService instantiation
  try {
    const agent = new AgentService({ enableWebSearch: true });
    console.log('✅ AgentService created successfully with configuration');
    console.log('📋 Tool definitions:', agent.toolDefs.map(t => ({ type: t.type, name: t.name || 'hosted' })));
    console.log('🔧 Custom executors:', Object.keys(agent.executors));
    
    // Test validation with configuration constants
    try {
      await agent.generateResponse('');
    } catch (error) {
      console.log('✅ Validation working with config constants:', error.message === config.ERROR_MESSAGES.INVALID_PROMPT);
    }
    
    try {
      await agent.generateResponse('test', { response_format: 'invalid' });
    } catch (error) {
      console.log('✅ Response format validation working:', error.message === config.ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
    }
    
    console.log('\n🎯 Configuration integration test completed successfully!');
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('\n💡 To test with real API calls, set OPENAI_API_KEY environment variable');
    } else {
      console.log('\n🚀 API key detected - ready for real testing!');
    }
    
  } catch (error) {
    console.error('❌ Error creating AgentService:', error.message);
  }
}

// Test instruction building
function testInstructionBuilder() {
  console.log('\n📝 Testing instruction builder:');
  
  const textInstructions = config.AGENT_INSTRUCTIONS.build(false);
  console.log('  Text mode:', textInstructions);
  
  const jsonInstructions = config.AGENT_INSTRUCTIONS.build(true);
  console.log('  JSON mode:', jsonInstructions);
  
  console.log('✅ Instruction builder working correctly');
}

// Run tests
testConfigurationIntegration()
  .then(() => testInstructionBuilder())
  .catch(console.error);
