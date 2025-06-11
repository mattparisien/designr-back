// services/projectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Agents SDK Edition (v4.1.0)
// Now includes the built‑in `webSearchTool` for external inspiration.
// Uses dynamic imports for ES modules in CommonJS environment.
// ---------------------------------------------------------------------------

require('dotenv').config();
const vectorStore = require('./vectorStore');
const imageAnalysis = require('./imageAnalysisService');

// Dynamic imports for ES modules
let Agent, run, tool, webSearchTool, z, RunToolCallOutputItem;

/**
 * Function‑tool wrappers ----------------------------------------------------
 * These will be created after dynamic imports are loaded
 */
let searchAssetsTool, searchDocsTool, analyzeImageTool, buildWebSearchTool, designOnlyGuardrail;

/**
 * ProjectAgentService --------------------------------------------------------
 */
class ProjectAgentService {
  #agent;
  #initialized = false;
  #vectorStore = vectorStore;
  #imageAnalysis = imageAnalysis;

  static MODEL = process.env.OPENAI_MODEL || 'gpt‑4o-mini';
  static APP = process.env.APP_NAME || 'Canva Clone';

  async initialize() {
    if (this.#initialized) return;
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY missing — agent disabled');
      return;
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

      // Create tool functions after imports are available
      searchAssetsTool = ({ vs }) =>
        tool({
          name: 'search_assets',
          description: "Find visually similar assets in the user's library.",
          parameters: z.object({
            query: z.string().describe('Natural‑language or file name query'),
            limit: z.number().int().min(1).max(20).default(5),
          }),
          execute: async ({ query, limit }, ctx) => {
            const results = await vs.searchAssets(query, ctx.userId, {
              limit
            });
            return JSON.stringify(results);
          },
        });

      searchDocsTool = ({ vs }) =>
        tool({
          name: 'search_documents',
          description: 'Search within uploaded document text.',
          parameters: z.object({
            query: z.string(),
            limit: z.number().int().min(1).max(20).default(5),
          }),
          execute: async ({ query, limit }, ctx) => {
            const chunks = await vs.searchDocumentChunks(query, ctx.userId, {
              limit,
              threshold: 0.7,
            });
            return JSON.stringify(chunks);
          },
        });

      analyzeImageTool = ({ ia }) =>
        tool({
          name: 'analyze_image',
          description: 'Return dominant colours and objects detected in an image URL.',
          parameters: z.object({ imageUrl: z.string().describe('The URL of the image to analyze') }),
          execute: async ({ imageUrl }) => {
            const analysis = await ia.analyzeImage(imageUrl);
            return JSON.stringify(analysis ?? {});
          },
        });

      buildWebSearchTool = () =>
        webSearchTool({
          userLocation: {
            type: 'approximate',
            city: process.env.AGENT_CITY || 'Toronto',
          },
        });

      const FORBIDDEN = [
        'politics',
        'election',
        'covid',
        'virus',
        'medical',
        'doctor',
        'medicine',
        'legal advice',
        'lawyer',
        'financial advice',
        'investment',
        'crypto',
        'password',
        'private data',
      ];

      designOnlyGuardrail = {
        name: 'project‑focused‑topics',
        async check({ content }) {
          const lower = content.toLowerCase();
          const hit = FORBIDDEN.some((t) => lower.includes(t));
          if (hit) {
            return {
              success: false,
              message:
                "I'm a Project Assistant focused on helping you create amazing designs and manage your projects. Let's talk about your creative projects instead! What would you like to create today?",
            };
          }
          return { success: true };
        },
      };

      console.log('✅ ES modules loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load ES modules:', error.message);
      return;
    }

    // Initialise dependent services in parallel.
    await Promise.all([
      this.#vectorStore.initialize(),
      this.#imageAnalysis.initialize(),
    ]);

    // Build the Agent with tools + guardrails.
    this.#agent = new Agent({
      name: 'Project Assistant',
      instructions: `You are a Project Assistant for the design platform "${ProjectAgentService.APP}". You help with graphic‑design tasks (logos, presentations, social posts, colour theory, typography, etc.) and project management. Always suggest concrete next steps (e.g. "Browse presentation templates", "Apply brand colours"). When external inspiration is helpful, feel free to use the web search tool.`,
      model: ProjectAgentService.MODEL,
      tools: [
        searchAssetsTool({ vs: this.#vectorStore }),
        searchDocsTool({ vs: this.#vectorStore }),
        analyzeImageTool({ ia: this.#imageAnalysis }),
        buildWebSearchTool(),
      ],
      // inputGuardrails: [designOnlyGuardrail], // Temporarily disabled for testing
    });

    this.#initialized = true;
    console.log('✅ Project Agent (Agents SDK + webSearch) ready');
  }

  /**
   * Top‑level helper to chat with the agent.
   * Returns { assistant_text, toolOutputs, trace }.
   */
  async chat(userText, { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      // Fallback when API key missing.
      return {
        assistant_text:
          "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!",
      };
    }

    const result = await run(this.#agent, userText, { userId });

    const toolOutputs = result.newItems
      .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
      .reduce((acc, i) => {
        acc[i.rawItem.name] = acc[i.output];
        return acc;
      }, {});

      console.log(result.newItems
      .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed'));

    return {
      assistant_text: result.finalOutput,
      toolOutputs, // key‑value map of toolName → return value
      traceId: result.traceId, // useful for debugging with the tracing UI
    };
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      tools: this.#agent?.tools?.map((t) => t.name) ?? [],
    };
  }
}

module.exports = ProjectAgentService;
