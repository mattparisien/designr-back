import { buildAgent } from './agent/index.js';

async function debugChatError() {
  const agent = buildAgent({});
  try {
    // Intentionally call run without a prompt to trigger an error
    await agent.run();
  } catch (error) {
    console.error('Expected error captured:', error.message);
  }
}

debugChatError();
