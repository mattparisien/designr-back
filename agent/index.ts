// agent/index.ts — Responses-API implementation (no Agents SDK)
import dotenv from 'dotenv';
import fetch from "node-fetch";
import { AgentConfig, createExecutors } from "./executors";
dotenv.config();

/* ------------------------------------------------------------------ *
 * 0.  Types                                                          *
 * ------------------------------------------------------------------ */
interface ToolCall {
  name: string;
  args: any;
  result: any;
}

interface AssistantResponse {
  finalOutput: string;
  toolCalls?: ToolCall[];
}

export interface Agent {
  run: (prompt: string) => Promise<AssistantResponse>;
}

interface OpenAIResponse {
  id: string;
  output?: Array<{
    type: string;
    name?: string;
    content?: Array<{ text: string }>;
    id?: string;
    tool?: { type: string };
    arguments?: string;
  }>;
}

/* ------------------------------------------------------------------ *
 * 0.  Config                                                         *
 * ------------------------------------------------------------------ */
const ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const APP_NAME = process.env.APP_NAME || 'Canva Clone';

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
    type: "function",
    name: "normalize_search_results",
    description: "Turn raw search snippets into Element-compatible design objects",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          description: "Output of the immediately-preceding web_search call",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              snippet: { type: "string" },
              url: { type: "string" },
              image: { type: "string", description: "Thumbnail if available" }
            },
            required: ["title", "snippet", "url"]
          }
        },
        designIntent: {
          type: "string",
          description: "One-sentence brief for the design you’re building (e.g. ‘Instagram Reel about summer biking tips’)"
        }
      },
      required: ["results", "designIntent"]
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
        category: { type: 'string', description: 'Project category (marketing, education, events, personal, other)' },
        elements: {
          type: "array",
          description: "Pre-laid out design elements to seed the first page",
          items: { $ref: "#/definitions/Element" }
        }
      },

      required: ['title', 'platform']
    }
  }
];



/* ------------------------------------------------------------------ *
 * 2.  Helper: single Responses-API call                              *
 * ------------------------------------------------------------------ */
async function callResponses({ input, previousId = null }: { input: any; previousId?: string | null }): Promise<OpenAIResponse> {


  const body: any = {
    model: MODEL,
    instructions:
      `You are the Project Assistant for "${APP_NAME}". ` +
      'RESEARCH GUIDELINES: Always call "web_search" when you need current information about: ' +
      '• Current trends, events, or news • Popular topics or viral content • Recent design trends or styles ' +
      '• Current market insights • Seasonal/timely content • Inspiration for creative projects ' +
      '• Any topic where recent, up-to-date information would improve the content quality. ' +
      'CREATION WORKFLOW: When users request content creation, you MUST complete both steps: ' +
      '1. First call "web_search" to gather current, relevant information. ' +
      '2. Immediately pass the web_search results to normalize_search_results, specifying the designIntent you inferred from the user’s ask.  ' +
      '3. Then ALWAYS call create_social_media_project (or another creation tool) to actually create the requested content. ' +
      'Do NOT just provide information - you must create the actual project when requested.',
    input,                                   // user msg or []
    tools: TOOL_DEFS,                        // hosted + function tools
  };

  if (previousId) body.previous_response_id = previousId;

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
async function runAssistant(prompt: string, { vectorStore = {}, imageAnalysis = {} }: AgentConfig = {}): Promise<AssistantResponse> {
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
    if (!call) continue;

    console.log(`🔧 Found tool call: ${call.name || call.tool?.type}`);
    const { id: callId, tool, name, arguments: argJson } = call;

    // Hosted web_search: no executor; just continue thread
    if (tool?.type === 'web_search') {
      console.log(`🌐 Processing web search...`);
      response = await callResponses({ input: [], previousId });
      console.log('the repsonse', response);
      previousId = response.id;
      continue;
    }

    // Custom function tool
    if (!name) continue;

    console.log(`⚙️ Executing custom tool: ${name} with args: ${argJson}`);
    const args = JSON.parse(argJson || '{}');
    const runFn = (EXECUTORS as any)[name];
    let result: any;
    try { result = runFn ? await runFn(args) : { error: 'tool not found' }; }
    catch (err: any) { result = { error: err.message }; }

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
function buildAgent({ vectorStore = {}, imageAnalysis = {} }: AgentConfig = {}): Agent {
  return {
    run: (prompt: string) => runAssistant(prompt, { vectorStore, imageAnalysis }),
  };
}

export { buildAgent };
