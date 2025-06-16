// utils/dynamicImports.ts
// Centralized dynamic imports for ES modules

let AgentClass: any, run: any, tool: any, webSearchTool: any, zod: any, RunToolCallOutputItemClass: any, user: any, assistant: any, system: any;
let initialized = false;

export interface DynamicImports {
  Agent: any;
  run: any;
  tool: any;
  webSearchTool: any;
  z: any;
  RunToolCallOutputItem: any;
  user: any;
  assistant: any;
  system: any;
}

export async function requireDynamic(): Promise<DynamicImports> {
  if (initialized) {
    return { 
      Agent: AgentClass, 
      run, 
      tool, 
      webSearchTool, 
      z: zod, 
      RunToolCallOutputItem: RunToolCallOutputItemClass, 
      user, 
      assistant, 
      system 
    };
  }

  try {
    // Dynamic import of ES modules
    const agentsModule = await import('@openai/agents');
    const zodModule = await import('zod');

    AgentClass = agentsModule.Agent;
    run = agentsModule.run;
    tool = agentsModule.tool;
    webSearchTool = agentsModule.webSearchTool;
    RunToolCallOutputItemClass = agentsModule.RunToolCallOutputItem;
    user = agentsModule.user;
    assistant = agentsModule.assistant;
    system = agentsModule.system;
    zod = zodModule.z;

    initialized = true;
    console.log('✅ ES modules loaded successfully');
    
    return { 
      Agent: AgentClass, 
      run, 
      tool, 
      webSearchTool, 
      z: zod, 
      RunToolCallOutputItem: RunToolCallOutputItemClass, 
      user, 
      assistant, 
      system 
    };
  } catch (error: any) {
    console.error('❌ Failed to load ES modules:', error.message);
    throw error;
  }
}
