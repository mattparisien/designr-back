// agent/index.js — Responses-API implementation (no Agents SDK)
require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
const { fetchJson } = require('../utils/fetchJson');
const platformSizes = require('./config/platformSizes');
const { getHierarchicalDimensions } = require('./config/hierarchicalPlatforms');

/* ------------------------------------------------------------------ *
 * 0.  Config                                                         *
 * ------------------------------------------------------------------ */
const ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL    = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const APP_NAME = process.env.APP_NAME     || 'Canva Clone';

/* ------------------------------------------------------------------ *
 * 1.  Simple tool definitions that work with Responses API           *
 * ------------------------------------------------------------------ */

// Simple tool schemas for the Responses API
const TOOL_DEFS = [
  { type: 'web_search', user_location: { type: 'approximate', city: 'Toronto' } },
  {
    type: 'function',
    name: 'search_assets',
    description: 'Search user asset library',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search keywords' }
      },
      required: ['search']
    }
  },
  {
    type: 'function',
    name: 'search_docs',
    description: 'Search internal documentation',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search keywords' }
      },
      required: ['search']
    }
  },
  {
    type: 'function',
    name: 'create_social_media_project',
    description: 'Create a new social media project for Instagram, Facebook, etc.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the social media project' },
        platform: { type: 'string', description: 'Target platform (instagram, facebook, twitter, etc.)' },
        format: { type: 'string', description: 'Format type (post, story, reel, etc.)' },
        category: { type: 'string', description: 'Project category (marketing, education, events, personal, other)' }
      },
      required: ['title', 'platform']
    }
  }
];

// Simple executors that work with the tools
function createExecutors({ vectorStore = {}, imageAnalysis = {} }) {
  return {
    search_assets: async ({ search }) => {
      const results = vectorStore.search?.(search) ?? [];
      return { results, count: results.length };
    },
    
    search_docs: async ({ search }) => {
      const results = vectorStore.search?.(search) ?? [];
      return { results, count: results.length };
    },
    
    create_social_media_project: async ({ title, platform, format = 'post', category = 'personal' }) => {
      // Ensure category is valid
      const validCategories = ['marketing','education','events','personal','other'];
      const cat = validCategories.includes(category) ? category : 'other';
      // Build project payload similar to createSocialMedia.js
      let canvasSize, designSpec;
      if (format) {
        canvasSize = getHierarchicalDimensions('social', platform, format);
        designSpec = { mainType: 'social', platform, format, dimensions: canvasSize };
      } else if (platformSizes[platform]) {
        canvasSize = platformSizes[platform];
        const [plat, fmt] = platform.split('-');
        designSpec = { mainType: 'social', platform: plat, format: fmt || 'post', dimensions: canvasSize };
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      const projectData = {
        title,
        description: `Optimized for ${designSpec.platform} ${designSpec.format}`,
        type: 'social',
        userId: 'default-user',
        category: cat,
        canvasSize,
        designSpec,
        mainType: 'social',
        platform: designSpec.platform,
        format: designSpec.format
      };
      // create project via backend API
      const project = await fetchJson('/api/projects', { method: 'POST', body: projectData });
      return {
        success: true,
        project: {
          id: project._id,
          title: project.title,
          type: project.type,
          category: project.category,
          platform: designSpec.platform,
          format: designSpec.format,
          canvasSize: project.canvasSize,
          designSpec: project.designSpec
        },
        message: `Created "${title}" for ${designSpec.platform} ${designSpec.format} successfully!`
      };
    }
  };
}

/* ------------------------------------------------------------------ *
 * 2.  Helper: single Responses-API call                              *
 * ------------------------------------------------------------------ */
async function callResponses({ input, previousId = null }) {

  
  const body = {
    model: MODEL,
    instructions:
      `You are the Project Assistant for "${APP_NAME}". ` +
      'RESEARCH GUIDELINES: Always call "web_search" when you need current information about: ' +
      '• Current trends, events, or news • Popular topics or viral content • Recent design trends or styles ' +
      '• Current market insights • Seasonal/timely content • Inspiration for creative projects ' +
      '• Any topic where recent, up-to-date information would improve the content quality. ' +
      'CREATION WORKFLOW: When users request content creation, you MUST complete both steps: ' +
      '1. First call "web_search" to gather current, relevant information. ' +
      '2. Then ALWAYS call create_social_media_project (or another creation tool) to actually create the requested content. ' +
      'Do NOT just provide information - you must create the actual project when requested.',
    input,                                   // user msg or []
    tools: TOOL_DEFS,                        // hosted + function tools
  };

  if (previousId)  body.previous_response_id = previousId;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return await res.json(); // { id, output:[…] }
}

/* ------------------------------------------------------------------ *
 * 3.  Core runner loop — max 8 cycles                                *
 * ------------------------------------------------------------------ */
async function runAssistant(prompt, { vectorStore = {}, imageAnalysis = {} } = {}) {
  const EXECUTORS = createExecutors({ vectorStore, imageAnalysis });
  
  let response = await callResponses({ input: prompt });
  let previousId = response.id;

  for (let step = 0; step < 8; step += 1) {
    const outArr = response.output || [];
    console.log(`🔄 Step ${step + 1}: Found ${outArr.length} output items`);
    
    // Log the types of output items
    outArr.forEach((item, i) => {
      console.log(`  Item ${i}: type=${item.type}, name=${item.name || 'N/A'}`);
    });

    // 4-A  If there's an assistant message with text → return it
    const finalMsg = outArr.find(o => o.type === 'message');
    if (!outArr.some(o => o.type === 'tool_call' || o.type === 'function_call')) {
      console.log(`✅ No more tool calls found, returning final output`);
      const text = finalMsg?.content?.map(c => c.text).join(' ') || '';
      return { finalOutput: text };
    }

    // 4-B  Handle the *first* tool call in the array
    const call = outArr.find(o => o.type === 'tool_call' || o.type === 'function_call');
    console.log(`🔧 Found tool call: ${call.name || call.tool?.type}`);
    const { id: callId, tool, name, arguments: argJson } = call;

    // Hosted web_search: no executor; just continue thread
    if (tool?.type === 'web_search') {
      console.log(`🌐 Processing web search...`);
      response   = await callResponses({ input: [], previousId });
      previousId = response.id;
      continue;
    }

    // Custom function tool
    console.log(`⚙️ Executing custom tool: ${name} with args: ${argJson}`);
    const args = JSON.parse(argJson || '{}');
    const runFn = EXECUTORS[name];
    let result;
    try { result = runFn ? await runFn(args) : { error: 'tool not found' }; }
    catch (err) { result = { error: err.message }; }

    console.log(`📤 Tool result:`, result);

    // Combine result and return, track toolCalls
    const assistantMsg = outArr.find(o => o.type === 'message');
    const assistantText = assistantMsg?.content?.map(c => c.text).join(' ') || '';
    const combinedOutput = assistantText + '\n\n✅ Project Created: ' + (result.message || JSON.stringify(result));
    return { finalOutput: combinedOutput, toolCalls: [{ name, args, result }] };
  }

  return { finalOutput: '(stopped after 8 tool calls)' };
}

/* ------------------------------------------------------------------ *
 * 4.  Public factory                                                 *
 * ------------------------------------------------------------------ */
function buildAgent({ vectorStore = {}, imageAnalysis = {} } = {}) {
  return {
    run: (prompt) => runAssistant(prompt, { vectorStore, imageAnalysis }),
  };
}

module.exports = { buildAgent };
