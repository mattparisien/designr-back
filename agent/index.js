// agent/index.js
// Central agent builder - imports all tools & guardrails, injects dependencies

const { requireDynamic } = require('../utils/dynamicImports');
const { createSearchAssetsTool } = require('./tools/searchAssets');
const { createSearchDocsTool } = require('./tools/searchDocs');
const { createAnalyzeImageTool } = require('./tools/analyzeImage');
const { createPresentationTool } = require('./tools/projects/createPresentation');
const { createSocialMediaTool } = require('./tools/projects/createSocialMedia');
const { createPrintTool } = require('./tools/projects/createPrint');
const { createCustomProjectTool } = require('./tools/projects/createCustom');
const { listProjectTypesTool } = require('./tools/projects/listProjectTypes');
const { createProjectFocusedTopicsGuardrail } = require('./guardrails/projectTopics');

async function buildAgent({ vectorStore, imageAnalysis }) {
  const { Agent, webSearchTool } = await requireDynamic();

  const MODEL = 'gpt-4o-2024-11-20';
  const APP = process.env.APP_NAME || 'Canva Clone';

  // Create web search tool

  // Build all tools
  const tools = [
    await createSearchAssetsTool(vectorStore),
    await createSearchDocsTool(vectorStore),
    await createAnalyzeImageTool(imageAnalysis),
    webSearchTool({
      userLocation: { type: 'approximate', city: 'New York' },
    }),
    await createPresentationTool(),
    await createSocialMediaTool(),
    await createPrintTool(),
    await createCustomProjectTool(),
    await listProjectTypesTool(),
  ];

  // Create guardrails
  const inputGuardrails = [
    createProjectFocusedTopicsGuardrail()
  ];

  // Build the Agent
  // Updated agent instructions in agent/index.js
  const agent = new Agent({
    name: 'Project Assistant',
    instructions: `You are a Project Assistant for the design platform "${APP}". You help with graphic‑design tasks (logos, presentations, social posts, colour theory, typography, etc.) and project management.

You can create different types of projects:
- Presentations: Use create_presentation for slideshow presentations
- Social Media: Use create_social_media_project for platform-specific posts (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok)
- Print: Use create_print_project for physical media (A4, posters, business cards, flyers)
- Custom: Use create_custom_project for specific dimensions

IMPORTANT TOOL USAGE RULES:
1. **Make ONE tool call at a time** - wait for each tool to complete before making additional calls
2. When you need to use multiple tools, explain your plan first, then execute tools sequentially
3. If you need both web search and asset search, do web search first, then use those results to inform your asset search
4. Always provide a summary of what each tool accomplished before moving to the next

Example good workflow:
- "I'll first search for current design trends, then find relevant assets based on what I discover"
- [Make web search call]
- [Wait for results]
- "Based on the trend data, I'll now search for matching templates"
- [Make asset search call]

Always suggest concrete next steps (e.g. "Browse presentation templates", "Apply brand colours", "Create an Instagram post"). When external inspiration is helpful, use the web search tool to find current trends and information.`,
    tools,
    // inputGuardrails, // Temporarily disabled for testing
  });

  return agent;
}

module.exports = { buildAgent };
