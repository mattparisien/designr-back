import { buildAgent } from './agent/index.js';

async function debugSimpleChat() {
  try {
    const agent = buildAgent({});
    const response = await agent.run('Hello! Can you help me?');
    console.log('Assistant response:', response.finalOutput);
  } catch (error) {
    console.error('Debug failed:', error.message);
  }
}

debugSimpleChat();
