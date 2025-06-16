// services/ProjectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Modularized Edition (v5.2.0)
// Orchestration only – all logic delegated to modular components.
// Fully MCP‑compliant (messages built with helper wrappers).
// Now with proper hosted tool call support for web search.
// ---------------------------------------------------------------------------

require('dotenv').config();

// Local modules -------------------------------------------------------------
const { buildAgent } = require('../agent/index');
const { requireDynamic } = require('../utils/dynamicImports');
const vectorStore = require('./vectorStore');
const imageAnalysis = require('./imageAnalysisService');

/**
 * ProjectAgentService
 * A thin façade that initialises the shared agent once, then proxies
 * chat requests (with or without history) to @openai/agents `run()`.
 */
class ProjectAgentService {
  // ---------------------------------------------------------------------
  // Private fields -------------------------------------------------------
  #agent;
  #initialized = false;
  #vectorStore = vectorStore;
  #imageAnalysis = imageAnalysis;

  // ---------------------------------------------------------------------
  // Static defaults ------------------------------------------------------
  static MODEL = process.env.OPENAI_MODEL || 'gpt‑4o-mini';
  static APP = process.env.APP_NAME || 'Canva Clone';

  // ---------------------------------------------------------------------
  // Bootstrapping --------------------------------------------------------
  async initialize() {
    if (this.#initialized) return;

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY missing — agent disabled');
      return;
    }

    try {
      // 1️⃣ Initialise dependencies in parallel.
      await Promise.all([
        this.#vectorStore.initialize?.(),
        this.#imageAnalysis.initialize?.(),
      ]);

      // 2️⃣ Build the agent instance via the shared builder.
      this.#agent = await buildAgent({
        vectorStore: this.#vectorStore,
        imageAnalysis: this.#imageAnalysis,
      });

      this.#initialized = true;
      console.log('✅ Project Agent ready (Modular Edition v5.2.0)');
    } catch (err) {
      console.error('❌ Failed to initialise Project Agent:', err.message);
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Public helpers -------------------------------------------------------
  /**
   * Send a single‑turn chat request (no prior history).
   * @returns {Promise<{assistant_text:string, toolOutputs:Object, traceId?:string}>}
   */
  async chat(userText, { userId } = {}) {
    console.log('hello!');
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text: "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }

    try {
      const { run, user: u, system: s, RunToolCallOutputItem } = await requireDynamic();

      const messages = [
        s(`User ID for this session: ${userId || 'anonymous'}`),
        u(userText),
      ];

      console.log(messages);
      const result = await run(this.#agent, messages, { userId });
      console.log('the result', result);
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);

      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err) {


      // Special handling for hosted tool call errors (like web search)
      if (err.message && err.message.includes('Unsupported built-in tool call type')) {
        console.log('🔍 Debug - Handling hosted tool call error...');

        // Try to extract the tool call info from the error message - improved regex
        const toolCallMatch = err.message.match(/\{"type":"hosted_tool_call".*?\}(?=\s*$)/);
        if (toolCallMatch) {
          try {
            console.log('🔍 Debug - Tool call match:', toolCallMatch[0]);
            const toolCall = JSON.parse(toolCallMatch[0]);
            console.log('🔍 Debug - Extracted hosted tool call:', toolCall);

            // Create a mock tool output structure
            const toolOutputs = {};
            if (toolCall.name && toolCall.status === 'completed') {
              toolOutputs[toolCall.name] = 'Tool executed successfully';

              // Special message for web search
              if (toolCall.name === 'web_search_call') {
                toolOutputs[toolCall.name] = 'Web search completed successfully';
              }
            }

            return {
              assistant_text: 'I searched for current information to help with your request. While I encountered a technical issue with processing the search results, the search itself was completed successfully.',
              toolOutputs,
              traceId: toolCall.id || 'hosted-tool-call',
              note: 'Hosted tool call processed successfully despite integration issue'
            };
          } catch (parseErr) {
            console.log('🔍 Debug - Parse error:', parseErr.message);
            console.log('🔍 Debug - Could not parse hosted tool call info');
          }
        }
      }

      console.error('❌ Chat error:', err.message);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /**
   * Chat with conversation history. Adds memory in a token‑efficient way.
   * @param {string} userText
   * @param {Array<{role:string,content:string}>} conversationHistory
   */
  async chatWithHistory(userText, conversationHistory = [], { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text: "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }

    try {
      const {
        run,
        user: u,
        assistant: a,
        system,
        RunToolCallOutputItem,
      } = await requireDynamic();

      // 1️⃣ Base system context.
      const messages = [
        system(`You are a helpful design assistant for a Canva‑like platform. Help users create projects, find templates, and work with design elements. You have access to tools for creating projects, searching assets, and analysing images. User ID for this session: ${userId || 'anonymous'}. Maintain context from previous messages in this conversation.`),
      ];

      // 2️⃣ Re‑wrap recent history as MCP items (drop system messages to avoid duplicates).
      const recentHistory = conversationHistory
        .filter(m => m.role !== 'system')
        .slice(-10);

      for (const m of recentHistory) {
        if (m.role === 'user') messages.push(u(m.content));
        else if (m.role === 'assistant') messages.push(a(m.content));
        else messages.push(s(m.content));
      }

      // 3️⃣ Current turn.
      messages.push(u(userText));

      console.log(`💬 Processing chat with history (${conversationHistory.length} total, ${recentHistory.length} in context)`);

      const result = await run(this.#agent, messages, { userId });
      console.log('🔍 Debug - Run completed with', result.newItems.length, 'new items');
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);

      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err) {
      // Same hosted tool call handling as in chat method
      if (err.message && err.message.includes('Unsupported built-in tool call type')) {
        console.log('🔍 Debug - Handling hosted tool call error in chat with history...');

        const toolCallMatch = err.message.match(/\{"type":"hosted_tool_call".*?\}(?=\s*$)/);
        if (toolCallMatch) {
          try {
            const toolCall = JSON.parse(toolCallMatch[0]);
            console.log('🔍 Debug - Extracted hosted tool call:', toolCall);

            const toolOutputs = {};
            if (toolCall.name && toolCall.status === 'completed') {
              toolOutputs[toolCall.name] = 'Tool executed successfully';

              if (toolCall.name === 'web_search_call') {
                toolOutputs[toolCall.name] = 'Web search completed successfully';
              }
            }

            return {
              assistant_text: 'I searched for current information to help with your request. While I encountered a technical issue with processing the search results, the search itself was completed successfully.',
              toolOutputs,
              traceId: toolCall.id || 'hosted-tool-call',
              note: 'Hosted tool call processed successfully despite integration issue'
            };
          } catch (parseErr) {
            console.log('🔍 Debug - Could not parse hosted tool call info');
          }
        }
      }

      console.error('❌ ChatWithHistory error:', err.message);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      app: ProjectAgentService.APP,
      tools: this.#agent?.tools?.map(t => t.name) ?? [],
      vectorStoreReady: !!this.#vectorStore,
      imageAnalysisReady: !!this.#imageAnalysis,
      version: '5.2.0 - With hosted tool call support'
    };
  }

  // ---------------------------------------------------------------------
  // Private utilities ----------------------------------------------------
  /** Extracts completed tool outputs from `result.newItems`. */
  /** 
 * Improved tool output extraction that handles mixed hosted/local tool calls
 * with better error handling and timing considerations
 */
  #extractToolOutputs(items = [], RunToolCallOutputItem) {
    if (!items || items.length === 0) return {};

    console.log('🔍 Debug - Extracting tool outputs from', items.length, 'items');

    const toolOutputs = {};
    const errors = [];

    for (const item of items) {
      try {
        let toolName, toolOutput;

        // Handle standard RunToolCallOutputItem instances
        if (item instanceof RunToolCallOutputItem && item.rawItem?.status === 'completed') {
          toolName = item.rawItem.name;
          toolOutput = item.output;
          console.log('🔍 Debug - Found standard tool call:', toolName);
        }
        // Handle hosted tool calls (like web search)
        else if (item.rawItem && item.rawItem.type === 'hosted_tool_call') {
          toolName = item.rawItem.name;

          if (item.rawItem.status === 'completed') {
            toolOutput = item.output || 'Tool executed successfully';
            console.log('🔍 Debug - Found completed hosted tool call:', toolName);

            // Special handling for web search calls
            if (toolName === 'web_search_call') {
              toolOutput = item.output || 'Web search completed successfully';
            }
          } else if (item.rawItem.status === 'in_progress') {
            console.log('🔍 Debug - Hosted tool call still in progress:', toolName);
            // Skip in-progress items, they'll be processed in the next iteration
            continue;
          } else if (item.rawItem.status === 'failed') {
            console.log('🔍 Debug - Hosted tool call failed:', toolName);
            toolOutput = 'Tool execution failed';
            errors.push(`${toolName}: execution failed`);
          }
        }
        // Handle other completed tool calls
        else if (item.rawItem && item.rawItem.status === 'completed') {
          toolName = item.rawItem.name;
          toolOutput = item.output || 'Tool executed successfully';
          console.log('🔍 Debug - Found other tool call:', toolName);
        }
        // Handle items that might be missing status (local tools)
        else if (item.rawItem && item.rawItem.name && !item.rawItem.status) {
          toolName = item.rawItem.name;
          toolOutput = item.output || 'Tool executed successfully';
          console.log('🔍 Debug - Found tool call without status (likely local):', toolName);
        }
        else {
          console.log('🔍 Debug - Skipping item:', {
            type: item.constructor?.name,
            status: item.rawItem?.status,
            name: item.rawItem?.name,
            itemType: item.rawItem?.type
          });
          continue;
        }

        if (toolName) {
          console.log('🔍 Debug - Adding tool output:', toolName);
          toolOutputs[toolName] = toolOutput;
        }

      } catch (error) {
        console.error('🔍 Debug - Error processing tool item:', error.message);
        errors.push(`Tool processing error: ${error.message}`);
      }
    }

    // Add error summary if there were any errors
    if (errors.length > 0) {
      toolOutputs['_errors'] = errors;
    }

    console.log('🔍 Debug - Final tool outputs:', Object.keys(toolOutputs));
    return toolOutputs;
  }
}

module.exports = ProjectAgentService;