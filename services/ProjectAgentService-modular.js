// services/ProjectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Modularized Edition (v5.0.0)
// Orchestration only - all logic delegated to modular components
// ---------------------------------------------------------------------------

require('dotenv').config();
const { buildAgent } = require('../agent/index');
const { requireDynamic } = require('../utils/dynamicImports');
const vectorStore = require('./vectorStore');
const imageAnalysis = require('./imageAnalysisService');

/**
 * ProjectAgentService --------------------------------------------------------
 * Simplified orchestration façade - init(), chat(), getHealthStatus()
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
      // Initialize dependent services in parallel
      await Promise.all([
        this.#vectorStore.initialize(),
        this.#imageAnalysis.initialize(),
      ]);

      // Build the agent using the modular builder
      this.#agent = await buildAgent({
        vectorStore: this.#vectorStore,
        imageAnalysis: this.#imageAnalysis,
      });

      this.#initialized = true;
      console.log('✅ Project Agent (Modular Edition) ready');
    } catch (error) {
      console.error('❌ Failed to initialize Project Agent:', error.message);
      throw error;
    }
  }

  /**
   * Top‑level helper to chat with the agent.
   * Returns { assistant_text, toolOutputs, traceId }.
   */
  async chat(userText, { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    
    if (!this.#agent) {
      // Fallback when API key missing
      return {
        assistant_text:
          "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!",
      };
    }

    try {
      const { run, RunToolCallOutputItem } = await requireDynamic();
      const result = await run(this.#agent, userText, { userId });

      const toolOutputs = result.newItems
        .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
        .reduce((acc, i) => {
          acc[i.rawItem.name] = i.output;
          return acc;
        }, {});

      console.log('Completed tool calls:', result.newItems
        .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
        .map(i => i.rawItem.name));

      return {
        assistant_text: result.finalOutput,
        toolOutputs, // key‑value map of toolName → return value
        traceId: result.traceId, // useful for debugging with the tracing UI
      };
    } catch (error) {
      console.error('❌ Chat error:', error.message);
      return {
        assistant_text: "I encountered an error while processing your request. Please try again.",
        error: error.message,
      };
    }
  }

  /**
   * Chat with the agent using conversation history.
   * Returns { assistant_text, toolOutputs, traceId }.
   */
  async chatWithHistory(userText, conversationHistory = [], { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    
    if (!this.#agent) {
      // Fallback when API key missing
      return {
        assistant_text:
          "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!",
      };
    }

    try {
      const { run, RunToolCallOutputItem } = await requireDynamic();
      
      // Build conversation context for the prompt
      let contextualMessage = userText;
      
      if (conversationHistory.length > 0) {
        // Filter out system messages and format conversation history
        const userMessages = conversationHistory
          .filter(msg => msg.role !== 'system')
          .slice(-10) // Keep last 10 messages for context
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        
        contextualMessage = `Previous conversation context:
${userMessages}

Current user message: ${userText}

Please respond considering the conversation history above.`;
      }

      console.log(`💬 Processing chat with conversation context (${conversationHistory.length} previous messages)`);

      // Use the agent's run method with contextual message
      const result = await run(this.#agent, contextualMessage, { userId });

      const toolOutputs = result.newItems
        .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
        .reduce((acc, i) => {
          acc[i.rawItem.name] = i.output;
          return acc;
        }, {});

      console.log('Completed tool calls:', result.newItems
        .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
        .map(i => i.rawItem.name));

      return {
        assistant_text: result.finalOutput,
        toolOutputs, // key‑value map of toolName → return value
        traceId: result.traceId, // useful for debugging with the tracing UI
      };
    } catch (error) {
      console.error('❌ Chat with history error:', error.message);
      return {
        assistant_text: "I encountered an error while processing your request. Please try again.",
        error: error.message,
      };
    }
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      app: ProjectAgentService.APP,
      tools: this.#agent?.tools?.map((t) => t.name) ?? [],
      vectorStoreReady: this.#vectorStore ? true : false,
      imageAnalysisReady: this.#imageAnalysis ? true : false,
    };
  }
}

module.exports = ProjectAgentService;
