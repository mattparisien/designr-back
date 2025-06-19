import { buildAgent } from './agent/index.js';

async function debugCallStructure() {
  try {
    const agent = buildAgent({});
    await agent.run('Create an Instagram post about summer biking tips');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugCallStructure();
