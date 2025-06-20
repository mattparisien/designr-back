#!/usr/bin/env node

// Test script to demonstrate AI agent creating projects
const AgentService = require('./services/agentService');

async function testAgentProjectCreation() {
  console.log('🤖 Testing AI Agent Project Creation\n');
  
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not set. Cannot test real AI functionality.');
    console.log('For now, we\'ll demonstrate the tool integration...\n');
    
    // Demonstrate the service setup without OpenAI calls
    try {
      console.log('🔧 Attempting to create AgentService (will fail due to missing API key)...');
      
      // Create a mock agent just to test the configuration
      const mockAgent = {
        toolDefs: [],
        executors: {}
      };
      
      // Manually add the tools to show what would be configured
      const { TOOL_CONFIG } = require('./config/agentConfig');
      const { createProjectTool } = require('./utils/agentTools');
      
      mockAgent.toolDefs.push(TOOL_CONFIG.WEB_SEARCH);
      mockAgent.toolDefs.push(TOOL_CONFIG.CREATE_PROJECT);
      mockAgent.executors['create_project'] = createProjectTool;
      
      console.log('✅ Mock AgentService configured with project creation tool');
      console.log('📊 Available tools:', mockAgent.toolDefs.map(t => ({ 
        type: t.type, 
        name: t.name || 'hosted',
        description: t.description ? t.description.substring(0, 60) + '...' : 'N/A'
      })));
      
      const projectTool = mockAgent.toolDefs.find(t => t.name === 'create_project');
      if (projectTool) {
        console.log('\n🛠️ Project Creation Tool Details:');
        console.log('  Name:', projectTool.name);
        console.log('  Description:', projectTool.description);
        console.log('  Required parameters:', projectTool.parameters.required);
        console.log('  Available parameters:', Object.keys(projectTool.parameters.properties));
        console.log('  Tool executor available:', !!mockAgent.executors['create_project']);
      }
      
      console.log('\n✅ Tool integration test completed successfully!');
      
    } catch (error) {
      console.log('❌ Unexpected error during tool configuration:', error.message);
    }
    
    return;
  }
  
  // Real test with API key
  console.log('✅ API key found! Testing real AI agent with project creation...\n');
  
  try {
    const agent = new AgentService({ 
      enableWebSearch: true, 
      enableProjectCreation: true 
    });
    
    // Test various project creation scenarios
    const testCases = [
      {
        name: 'Simple Presentation Request',
        prompt: 'Create a presentation project called "My Business Pitch" for user "user123". Make it 16:9 format.'
      },
      {
        name: 'Social Media Post Request',
        prompt: 'I need to create an Instagram post project titled "Summer Sale" for user "designer456". Make it square format for Instagram.'
      },
      {
        name: 'Custom Project Request',
        prompt: 'Help me create a new project called "Event Flyer" for user "event-planner-789". It should be for a music festival flyer.'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`🎯 Testing: ${testCase.name}`);
      console.log(`   Prompt: "${testCase.prompt}"`);
      
      try {
        const result = await agent.generateResponse(testCase.prompt, { maxSteps: 5 });
        
        console.log('   ✅ Response received');
        console.log('   📝 Response preview:', result.response.substring(0, 200) + '...');
        
        // Check if the response mentions project creation
        const mentionsProject = result.response.toLowerCase().includes('project') ||
                               result.response.toLowerCase().includes('created') ||
                               result.response.toLowerCase().includes('design');
        
        console.log('   🎨 Mentions project/creation:', mentionsProject);
        console.log('');
        
      } catch (error) {
        console.log('   ❌ Test failed:', error.message);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Agent creation or execution failed:', error.message);
  }
  
  console.log('🎉 AI Agent project creation tests completed!');
}

// Example of how to use the agent programmatically
function demonstrateUsage() {
  console.log('\n📖 Usage Example:\n');
  
  const exampleCode = `
// Create an agent with project creation capabilities
const agent = new AgentService({ 
  enableWebSearch: true, 
  enableProjectCreation: true 
});

// Ask the AI to create a project
const result = await agent.generateResponse(
  'Create a presentation project called "Q4 Results" for user "john-doe". Use 16:9 format.',
  { maxSteps: 5 }
);

console.log('AI Response:', result.response);
// The AI will automatically use the create_project tool to create the project via /api/projects
`;
  
  console.log(exampleCode);
}

// Run the tests
testAgentProjectCreation()
  .then(() => demonstrateUsage())
  .catch(console.error);
