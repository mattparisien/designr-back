#!/usr/bin/env node

// Test script for project creation tool
const AgentService = require('./services/agentService');
const { createProjectTool, getCanvasPreset, suggestCanvasSize } = require('./utils/agentTools');

async function testProjectCreationTool() {
  console.log('🧪 Testing Project Creation Tool\n');
  
  // Test 1: Canvas presets
  console.log('📐 Test 1: Canvas Presets');
  console.log('  Instagram Post:', getCanvasPreset('Instagram Post'));
  console.log('  Presentation (16:9):', getCanvasPreset('Presentation (16:9)'));
  console.log('  A4 Portrait:', getCanvasPreset('A4 Portrait'));
  console.log('  Non-existent preset:', getCanvasPreset('NonExistent'));
  
  // Test 2: Canvas suggestions
  console.log('\n💡 Test 2: Canvas Size Suggestions');
  console.log('  Presentation:', suggestCanvasSize('presentation'));
  console.log('  Flyer:', suggestCanvasSize('flyer'));
  console.log('  Social Media:', suggestCanvasSize('social-media'));
  console.log('  Custom:', suggestCanvasSize('custom'));
  
  // Test 3: Direct tool function test
  console.log('\n🔧 Test 3: Direct Tool Function');
  
  const testArgs = {
    title: 'Test Project from Agent',
    userId: 'test-user-123',
    description: 'A test project created by the AI agent',
    type: 'presentation',
    category: 'business',
    tags: ['test', 'ai-generated'],
    canvasSize: {
      name: 'Presentation (16:9)',
      width: 1920,
      height: 1080
    }
  };
  
  try {
    console.log('  Testing createProjectTool with args:', JSON.stringify(testArgs, null, 2));
    
    // Note: This will fail if the API server isn't running, but we can test the validation
    const result = await createProjectTool(testArgs);
    console.log('  Tool result:', result);
    
    if (result.success) {
      console.log('  ✅ Project created successfully!');
      console.log('    Project ID:', result.projectId);
      console.log('    Title:', result.title);
    } else {
      console.log('  ❌ Project creation failed:', result.error);
      // This is expected if the API server isn't running
      if (result.error.includes('fetch') || result.error.includes('ECONNREFUSED')) {
        console.log('  💡 This is expected if the API server is not running');
      }
    }
    
  } catch (error) {
    console.log('  ❌ Tool execution error:', error.message);
  }
  
  // Test 4: Validation tests
  console.log('\n✅ Test 4: Validation');
  
  try {
    await createProjectTool({});
  } catch (error) {
    console.log('  Missing title validation:', error.message.includes('title'));
  }
  
  try {
    await createProjectTool({ title: 'Test' });
  } catch (error) {
    console.log('  Missing userId validation:', error.message.includes('User ID'));
  }
  
  try {
    await createProjectTool({ title: 'Test', userId: 'user123' });
  } catch (error) {
    console.log('  Missing canvasSize validation:', error.message.includes('Canvas size'));
  }
  
  // Test 5: AgentService integration
  console.log('\n🤖 Test 5: AgentService Integration');
  
  try {
    const agent = new AgentService({ enableProjectCreation: true });
    console.log('  ✅ AgentService created with project creation enabled');
    console.log('  Available tools:', agent.toolDefs.map(t => ({ type: t.type, name: t.name })));
    console.log('  Project creation tool available:', agent.toolDefs.some(t => t.name === 'create_project'));
    console.log('  Project creation executor available:', !!agent.executors['create_project']);
    
    // Test disabling project creation
    const agentWithoutPC = new AgentService({ enableProjectCreation: false });
    console.log('  Project creation disabled correctly:', !agentWithoutPC.toolDefs.some(t => t.name === 'create_project'));
    
  } catch (error) {
    console.log('  ❌ AgentService integration error:', error.message);
  }
  
  console.log('\n🎉 Project creation tool tests completed!');
  console.log('\n💡 To test with real API calls:');
  console.log('   1. Start the API server (npm start)');
  console.log('   2. Set up database connection');
  console.log('   3. Set OPENAI_API_KEY for full agent testing');
}

// Run the tests
testProjectCreationTool().catch(console.error);
