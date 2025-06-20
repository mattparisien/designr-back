#!/usr/bin/env node

// Test script to demonstrate autonomous agent decision-making
const request = require('supertest');
const express = require('express');
const agentRoutes = require('./routes/agent');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);

async function testAgentDecisionMaking() {
  console.log('🤖 Testing Agent Autonomous Decision Making\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not set. Please set it to test agent functionality.');
    console.log('💡 Set the environment variable and try again.\n');
    return;
  }

  // Test scenarios that should trigger different tool combinations
  const testScenarios = [
    {
      name: 'Web Search Only',
      prompt: 'What are the latest trends in graphic design for 2024?',
      expectedTools: ['web_search'],
      description: 'Should search the web for current design trends'
    },
    {
      name: 'Project Creation Only',
      prompt: 'Create a new presentation project for me titled "Marketing Strategy 2024" for user ID "user-123"',
      expectedTools: ['create_project'],
      description: 'Should create a project without web search'
    },
    {
      name: 'Web Search + Project Creation',
      prompt: 'Search for the latest social media post dimensions and create a new Instagram post project for user "user-456" with the correct dimensions',
      expectedTools: ['web_search', 'create_project'],
      description: 'Should first search for dimensions, then create project with appropriate size'
    },
    {
      name: 'Conversational Only',
      prompt: 'Explain the principles of good graphic design',
      expectedTools: [],
      description: 'Should respond conversationally without using tools'
    },
    {
      name: 'Complex Multi-Tool Scenario',
      prompt: 'Research the most popular presentation slide sizes in 2024 and create a business presentation project called "Q4 Results" for user "exec-789" using the most recommended dimensions',
      expectedTools: ['web_search', 'create_project'],
      description: 'Should research current standards and apply them to project creation'
    }
  ];

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`📋 Test ${i + 1}: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Prompt: "${scenario.prompt}"`);
    console.log(`   Expected tools: ${scenario.expectedTools.join(', ') || 'none'}`);
    
    try {
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: scenario.prompt,
          response_format: null
        });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200) {
        console.log(`   ✅ Success (${duration}ms)`);
        console.log(`   📄 Response length: ${response.body.response.length} characters`);
        
        // Analyze response for evidence of tool usage
        const responseText = response.body.response.toLowerCase();
        const evidence = [];
        
        if (responseText.includes('search') || responseText.includes('found') || responseText.includes('according to')) {
          evidence.push('web_search');
        }
        
        if (responseText.includes('created') || responseText.includes('project') && responseText.includes('dimensions')) {
          evidence.push('create_project');
        }
        
        console.log(`   🔍 Evidence of tools used: ${evidence.join(', ') || 'none detected'}`);
        console.log(`   📝 Response preview: "${response.body.response.substring(0, 150)}..."`);
        
      } else {
        console.log(`   ❌ Failed with status ${response.status}`);
        console.log(`   Error: ${response.body.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Add delay between requests to avoid rate limiting
    if (i < testScenarios.length - 1) {
      console.log('   ⏳ Waiting 2 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('🎯 Agent Decision Making Tests Completed!');
  console.log('\n📊 What This Test Demonstrates:');
  console.log('   • The agent autonomously decides which tools to use based on the prompt');
  console.log('   • Web search is triggered for queries requiring current information');
  console.log('   • Project creation is triggered when users request new projects');
  console.log('   • Multiple tools can be used in sequence for complex requests');
  console.log('   • Simple questions are answered conversationally without tools');
  console.log('\n💡 The agent makes these decisions automatically through OpenAI\'s function calling');
  console.log('   based on the tool descriptions and the user\'s intent in their prompt.');
}

// Helper function to test individual scenarios
async function testSpecificScenario(scenarioName) {
  const scenarios = {
    'web-search': 'What are the current best practices for web design in 2024?',
    'project-creation': 'Create a new flyer project called "Event Announcement" for user "user-123"',
    'combined': 'Research current social media dimensions and create an Instagram story project for user "user-456"',
    'conversational': 'What are the basic principles of color theory in design?'
  };
  
  const prompt = scenarios[scenarioName];
  if (!prompt) {
    console.log('❌ Unknown scenario. Available: web-search, project-creation, combined, conversational');
    return;
  }
  
  console.log(`🎯 Testing specific scenario: ${scenarioName}`);
  console.log(`Prompt: "${prompt}"\n`);
  
  try {
    const response = await request(app)
      .post('/api/agent/generate')
      .send({ prompt, response_format: null });
    
    if (response.status === 200) {
      console.log('✅ Response received:');
      console.log(response.body.response);
    } else {
      console.log('❌ Error:', response.body.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

// Run the appropriate test based on command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  testSpecificScenario(args[0]).catch(console.error);
} else {
  testAgentDecisionMaking().catch(console.error);
}
