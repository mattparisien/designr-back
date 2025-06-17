// tests/agent/index.ts - TypeScript test for agent web search + project creation
import { buildAgent } from "../../agent/index.ts";

// Mock dependencies for testing
const mockVectorStore = {
  search: (query: string) => {
    console.log(`🔍 Vector search for: "${query}"`);
    return [
      { id: 1, content: 'Mock search result about Instagram trends' },
      { id: 2, content: 'Mock search result about social media best practices' }
    ];
  }
};

const mockImageAnalysis = {
  analyze: (imageUrl: string) => {
    console.log(`🖼️ Image analysis for: ${imageUrl}`);
    return { description: 'Mock image analysis result' };
  }
};

// Mock environment variables
// process.env.OPENAI_API_KEY = 'test-api-key';
// process.env.BASE_URL = 'http://localhost:3001';
// process.env.APP_NAME = 'Canva Clone Test';

// // Mock fetch for OpenAI API calls
// (global as any).fetch = async (url: string, options: any) => {
//   console.log(`📡 Mock API call to: ${url}`);
  
//   if (url.includes('openai.com/v1/responses')) {
//     const body = JSON.parse(options.body);
//     console.log(`   Input: ${typeof body.input === 'string' ? body.input.substring(0, 50) + '...' : 'Array'}`);
    
//     // First call - web search
//     if (!body.previous_response_id) {
//       return {
//         ok: true,
//         json: async () => ({
//           id: 'resp_web_search',
//           output: [{
//             type: 'tool_call',
//             tool: { type: 'web_search' }
//           }]
//         })
//       };
//     } 
//     // Second call - project creation
//     else {
//       return {
//         ok: true,
//         json: async () => ({
//           id: 'resp_project_creation',
//           output: [
//             {
//               type: 'message',
//               content: [{ text: 'Research complete! Creating your project now.' }]
//             },
//             {
//               type: 'function_call',
//               name: 'create_social_media_project',
//               arguments: JSON.stringify({
//                 title: 'Test Instagram Post',
//                 platform: 'instagram',
//                 format: 'post',
//                 category: 'marketing'
//               })
//             }
//           ]
//         })
//       };
//     }
//   }
  
//   return { ok: false, status: 404 };
// };

async function testAgent() {
  try {
    console.log('🚀 Testing Agent Web Search + Project Creation');
    console.log('='.repeat(50));
    
    // Build the agent
    console.log('🏗️ Building agent...');
    const agent = buildAgent({
      vectorStore: mockVectorStore,
      imageAnalysis: mockImageAnalysis
    });
    
    console.log('✅ Agent built successfully');
    console.log('Agent methods:', Object.keys(agent));
    
    // Test the agent with a real query
    const testPrompt = 'Research current tiktok trends trends and then create a project bsed on this';
    console.log(`\n💬 Testing with prompt: "${testPrompt}"`);
    
    const result = await agent.run(testPrompt);
    console.log('result', result);
    
  } catch(err) {
    console.log('❌ Error during agent test:', err);
    return false;
  }
}

// Run the test
testAgent().then(success => {
  console.log(`\n🏁 Test result: ${success ? 'SUCCESS' : 'FAILURE'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});