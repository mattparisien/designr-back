// services/ProjectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Modularized Edition (v5.1.0)
// Orchestration only – all logic delegated to modular components.
// Fully MCP‑compliant (messages built with helper wrappers).
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
  static APP   = process.env.APP_NAME     || 'Canva Clone';

  // ---------------------------------------------------------------------
  // Bootstrapping --------------------------------------------------------
  async initialize () {
    if (this.#initialized) return;

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY missing — agent disabled');
      return;
    }

    try {
      // 1️⃣ Initialise dependencies in parallel.
      await Promise.all([
        this.#vectorStore.initialize?.(),
        this.#imageAnalysis.initialize?.(),
      ]);

      // 2️⃣ Build the agent instance via the shared builder.
      this.#agent = await buildAgent({
        vectorStore   : this.#vectorStore,
        imageAnalysis : this.#imageAnalysis,
      });

      this.#initialized = true;
      console.log('✅ Project Agent ready (Modular Edition)');
    } catch (err) {
      console.error('❌ Failed to initialise Project Agent:', err.message);
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Public helpers -------------------------------------------------------
  /**
   * Send a single‑turn chat request (no prior history).
   * @returns {Promise<{assistant_text:string, toolOutputs:Object, traceId?:string}>}
   */
  async chat (userText, { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text : "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }

    try {
      const { run, user: u, system: s, RunToolCallOutputItem } = await requireDynamic();

      const messages = [
        s(`User ID for this session: ${userId || 'anonymous'}`),
        u(userText),
      ];

      const result = await run(this.#agent, messages, { userId });
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);

      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err) {
      console.error('❌ Chat error:', err.message);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /**
   * Chat with conversation history. Adds memory in a token‑efficient way.
   * @param {string} userText
   * @param {Array<{role:string,content:string}>} conversationHistory
   */
  async chatWithHistory (userText, conversationHistory = [], { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text : "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }

    try {
      const {
        run,
        user      : u,
        assistant : a,
        system    : s,
        RunToolCallOutputItem,
      } = await requireDynamic();

      // 1️⃣ Base system context.
      const messages = [
        s(`You are a helpful design assistant for a Canva‑like platform. Help users create projects, find templates, and work with design elements. You have access to tools for creating projects, searching assets, and analysing images. User ID for this session: ${userId || 'anonymous'}. Maintain context from previous messages in this conversation.`),
      ];

      // 2️⃣ Re‑wrap recent history as MCP items (drop system messages to avoid duplicates).
      const recentHistory = conversationHistory
        .filter(m => m.role !== 'system')
        .slice(-10);

      for (const m of recentHistory) {
        if (m.role === 'user')        messages.push(u(m.content));
        else if (m.role === 'assistant') messages.push(a(m.content));
        else                           messages.push(s(m.content));
      }

      // 3️⃣ Current turn.
      messages.push(u(userText));

      console.log(`💬 Processing chat with history (${conversationHistory.length} total, ${recentHistory.length} in context)`);

      const result      = await run(this.#agent, messages, { userId });
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);

      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err) {
      console.error('❌ ChatWithHistory error:', err.message);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus () {
    return {
      initialized       : this.#initialized,
      model             : ProjectAgentService.MODEL,
      app               : ProjectAgentService.APP,
      tools             : this.#agent?.tools?.map(t => t.name) ?? [],
      vectorStoreReady  : !!this.#vectorStore,
      imageAnalysisReady: !!this.#imageAnalysis,
    };
  }

  // ---------------------------------------------------------------------
  // Private utilities ----------------------------------------------------
  /** Extracts completed tool outputs from `result.newItems`. */
  #extractToolOutputs (items = [], RunToolCallOutputItem) {
    return items
      .filter(i => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
      .reduce((acc, i) => {
        acc[i.rawItem.name] = i.output;
        return acc;
      }, {});
  }
}

module.exports = ProjectAgentService;
