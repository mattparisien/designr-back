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
  
  const MODEL = process.env.OPENAI_MODEL || 'gpt‑4o-mini';
  const APP = process.env.APP_NAME || 'Canva Clone';

  // Create web search tool
  const buildWebSearchTool = () =>
    webSearchTool({
      userLocation: {
        type: 'approximate',
        city: process.env.AGENT_CITY || 'Toronto',
      },
    });

  // Build all tools
  const tools = [
    await createSearchAssetsTool(vectorStore),
    await createSearchDocsTool(vectorStore),
    await createAnalyzeImageTool(imageAnalysis),
    buildWebSearchTool(),
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
  const agent = new Agent({
    name: 'Project Assistant',
    instructions: `You are a Project Assistant for the design platform "${APP}". You help with graphic‑design tasks (logos, presentations, social posts, colour theory, typography, etc.) and project management. 

You can create different types of projects:
- Presentations: Use create_presentation for slideshow presentations
- Social Media: Use create_social_media_project for platform-specific posts (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok)
- Print: Use create_print_project for physical media (A4, A5, posters, business cards, flyers)
- Custom: Use create_custom_project for specific dimensions

Always suggest concrete next steps (e.g. "Browse presentation templates", "Apply brand colours", "Create an Instagram post"). When external inspiration is helpful, feel free to use the web search tool.`,
    model: MODEL,
    tools,
    // inputGuardrails, // Temporarily disabled for testing
  });

  return agent;
}

module.exports = { buildAgent };
