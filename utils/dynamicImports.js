// utils/dynamicImports.js
// Centralized dynamic imports for ES modules in CommonJS environment

let Agent, run, tool, webSearchTool, z, RunToolCallOutputItem;
let initialized = false;

async function requireDynamic() {
  if (initialized) {
    return { Agent, run, tool, webSearchTool, z, RunToolCallOutputItem };
  }

  try {
    // Dynamic import of ES modules
    const agentsModule = await import('@openai/agents');
    const zodModule = await import('zod');

    Agent = agentsModule.Agent;
    run = agentsModule.run;
    tool = agentsModule.tool;
    webSearchTool = agentsModule.webSearchTool;
    RunToolCallOutputItem = agentsModule.RunToolCallOutputItem;
    z = zodModule.z;

    initialized = true;
    console.log('✅ ES modules loaded successfully');
    
    return { Agent, run, tool, webSearchTool, z, RunToolCallOutputItem };
  } catch (error) {
    console.error('❌ Failed to load ES modules:', error.message);
    throw error;
  }
}

module.exports = { requireDynamic };
