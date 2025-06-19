// services/ProjectAgentService.ts
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Custom Implementation (v6.0.0)
// Orchestration only – all logic delegated to modular components.
// Uses custom agent implementation with OpenAI Responses API.
// ---------------------------------------------------------------------------

import dotenv from 'dotenv';
dotenv.config();

// Local modules -------------------------------------------------------------
import { buildAgent, type Agent } from '../agent';
import vectorStore from './vectorStore';
import imageAnalysis from './imageAnalysisService';
import { IVectorStoreService } from './vectorStore';


export interface IProjectAgentService {
  initialize(): Promise<void>;
  chat(userText: string, options?: { userId?: string }): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string, note?: string }>;
  chatWithHistory(userText: string, conversationHistory?: Array<{ role: string, content: string }>, options?: { userId?: string }): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string }>;
  getHealthStatus(): { initialized: boolean, model: string, app: string, tools: string[], vectorStoreReady: boolean, imageAnalysisReady: boolean, version: string };
}




/**
 * ProjectAgentService
 * A thin façade that initialises the shared agent once, then proxies
 * chat requests (with or without history) to @openai/agents `run()`.
 */
class ProjectAgentService implements IProjectAgentService {
  // ---------------------------------------------------------------------
  // Private fields -------------------------------------------------------
  #agent: Agent | null = null;
  #initialized: boolean = false;
  #vectorStore: IVectorStoreService = vectorStore;
  #imageAnalysis = imageAnalysis;

  // ---------------------------------------------------------------------
  // Static defaults ------------------------------------------------------
  static MODEL: string = process.env.OPENAI_MODEL || 'gpt‑4o-mini';
  static APP: string = process.env.APP_NAME || 'Canva Clone';

  // ---------------------------------------------------------------------
  // Bootstrapping --------------------------------------------------------
  async initialize() {
    if (this.#initialized) return;

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY missing — agent disabled');
      return;
    }

    try {
      await Promise.all([
        this.#vectorStore.initialize?.(),
        this.#imageAnalysis.initialize?.(),
      ]);
      this.#agent = buildAgent({
        vectorStore: this.#vectorStore,
        imageAnalysis: this.#imageAnalysis,
      });
      this.#initialized = true;
      console.log('✅ Project Agent ready (Custom Implementation v6.0.0)');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Failed to initialise Project Agent:', error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Public helpers -------------------------------------------------------
  /**
   * Send a single‑turn chat request (no prior history).
   * @returns {Promise<{assistant_text:string, toolOutputs:Object, traceId?:string}>}
   */
  async chat(userText: string, options: { userId?: string } = {}): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string, note?: string, error?: string }> {
    const { userId } = options;
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text: "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }

    try {
      const prompt = `User ID for this session: ${userId || 'anonymous'}\n\nUser: ${userText}`;
      const result = await this.#agent.run(prompt);
      
      const toolOutputs: Record<string, any> = {};
      if (result.toolCalls) {
        for (const toolCall of result.toolCalls) {
          toolOutputs[toolCall.name] = toolCall.result;
        }
      }
      
      return { 
        assistant_text: result.finalOutput, 
        toolOutputs: Object.keys(toolOutputs).length > 0 ? toolOutputs : undefined,
        traceId: `agent-${Date.now()}`
      };
    } catch (err: any) {
      console.error('Error in chat:', err);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /**
   * Chat with conversation history. Adds memory in a token‑efficient way.
   * @param {string} userText
   * @param {Array<{role:string,content:string}>} conversationHistory
   */
  async chatWithHistory(
    userText: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    options: { userId?: string } = {}
  ): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string, note?: string, error?: string }> {
    const { userId } = options;
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      return { assistant_text: "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!" };
    }
    
    try {
      // Build context from conversation history
      const recentHistory = conversationHistory.filter(m => m.role !== 'system').slice(-10);
      let contextualPrompt = `User ID for this session: ${userId || 'anonymous'}\n\n`;
      
      // Add conversation context
      if (recentHistory.length > 0) {
        contextualPrompt += "Previous conversation:\n";
        for (const msg of recentHistory) {
          contextualPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        contextualPrompt += "\n";
      }
      
      contextualPrompt += `Current User: ${userText}`;
      
      const result = await this.#agent.run(contextualPrompt);
      
      const toolOutputs: Record<string, any> = {};
      if (result.toolCalls) {
        for (const toolCall of result.toolCalls) {
          toolOutputs[toolCall.name] = toolCall.result;
        }
      }
      
      return { 
        assistant_text: result.finalOutput, 
        toolOutputs: Object.keys(toolOutputs).length > 0 ? toolOutputs : undefined,
        traceId: `agent-${Date.now()}`
      };
    } catch (err: any) {
      console.error('Error in chatWithHistory:', err);
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      app: ProjectAgentService.APP,
      tools: ['search_assets', 'search_docs', 'normalize_search_results', 'create_social_media_project', 'web_search'],
      vectorStoreReady: !!this.#vectorStore,
      imageAnalysisReady: !!this.#imageAnalysis,
      version: '6.0.0 - Custom Agent Implementation with OpenAI Responses API'
    };
  }

  // ---------------------------------------------------------------------
  // Private utilities ----------------------------------------------------
}

export default ProjectAgentService;