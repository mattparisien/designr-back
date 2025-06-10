// Test without web search tool to isolate the issue
const DesignAgentService = require('../services/designAgentService');

// Test the dynamic imports directly
async function testDynamicImports() {
  console.log('🔍 Testing dynamic imports...\n');

  try {
    console.log('1. Testing @openai/agents import...');
    const agentsModule = await import('@openai/agents');
    console.log('✅ Agents module imported');
    console.log('Available exports:', Object.keys(agentsModule).slice(0, 10).join(', '), '...');

    console.log('\n2. Testing zod import...');
    const zodModule = await import('zod');
    console.log('✅ Zod module imported');

    console.log('\n3. Testing Agent creation...');
    const { Agent, tool } = agentsModule;
    const { z } = zodModule;

    // Create a simple test tool
    const testTool = tool({
      name: 'test_tool',
      description: 'A simple test tool',
      parameters: z.object({
        message: z.string()
      }),
      execute: async ({ message }) => {
        return `Test tool received: ${message}`;
      }
    });

    console.log('✅ Test tool created');

    console.log('\n4. Testing Agent initialization...');
    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: 'gpt-4o-mini',
      tools: [testTool]
    });

    console.log('✅ Agent created successfully');
    console.log('Agent tools:', agent.tools?.map(t => t.name) || []);

    console.log('\n🎉 All dynamic import tests passed!');

  } catch (error) {
    console.error('❌ Dynamic import test failed:', error.message);
    console.error('Error details:', error);
  }
}

testDynamicImports();
