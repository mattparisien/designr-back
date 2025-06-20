#!/usr/bin/env node

// Simple test to verify agent setup
const AgentService = require('./services/agentService');

async function testAgentSetup() {
  console.log('🔧 Testing Agent Setup\n');
  
  try {
    // Test agent instantiation
    const agent = new AgentService({ 
      enableWebSearch: true, 
      enableProjectCreation: true 
    });
    
    console.log('✅ AgentService created successfully');
    console.log('📊 Available tools:');
    
    agent.toolDefs.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.type}${tool.name ? ` (${tool.name})` : ''}`);
      if (tool.description) {
        console.log(`      Description: ${tool.description.substring(0, 100)}...`);
      }
    });
    
    console.log(`\n🔧 Custom executors: ${Object.keys(agent.executors).join(', ')}`);
    
    // Test API key presence
    if (!process.env.OPENAI_API_KEY) {
      console.log('\n⚠️  OPENAI_API_KEY not set - agent will not work for real calls');
      console.log('💡 Set the environment variable to test actual agent functionality');
    } else {
      console.log('\n✅ OPENAI_API_KEY is set - agent ready for real calls');
      
      // Test a simple prompt if API key is available
      console.log('\n🤖 Testing simple agent call...');
      try {
        const result = await agent.generateResponse(
          'Briefly explain what you can help with in one sentence.',
          { maxSteps: 2 }
        );
        console.log('✅ Agent response received:');
        console.log(`   "${result.response}"`);
      } catch (error) {
        console.log('❌ Agent call failed:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Agent setup failed:', error.message);
  }
}

testAgentSetup().catch(console.error);
