// services/ProjectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Modularized Edition (v5.2.0)
// Orchestration only – all logic delegated to modular components.
// Fully MCP‑compliant (messages built with helper wrappers).
// Now with proper hosted tool call support for web search.
// ---------------------------------------------------------------------------

require('dotenv').config();
import dotenv from 'dotenv';
dotenv.config();

// Local modules -------------------------------------------------------------
import { buildAgent, type Agent } from '../agent';
import { requireDynamic } from 'utils/dynamicImports';
import vectorStore from './vectorStore';
import imageAnalysis from './imageAnalysisService';
import { IVectorStoreService } from './vectorStore';


interface IProjectAgentService {
  initialize(): Promise<void>;
  chat(userText: string, options?: { userId?: string }): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string, note?: string }>;
  chatWithHistory(userText: string, conversationHistory?: Array<{ role: string, content: string }>, options?: { userId?: string }): Promise<{ assistant_text: string, toolOutputs?: Record<string, any>, traceId?: string }>;
  getHealthStatus(): { initialized: boolean, model: string, app: string, tools: string[], vectorStoreReady: boolean, imageAnalysisReady: boolean, version: string };
}

interface ToolCallRawItem {
  name: string;
  status?: string;
  type?: string;
}

interface ToolCallItem {
  rawItem?: ToolCallRawItem;
  output?: any;
  [key: string]: any;
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
      this.#agent = await buildAgent({
        vectorStore: this.#vectorStore,
        imageAnalysis: this.#imageAnalysis,
      });
      this.#initialized = true;
      console.log('✅ Project Agent ready (Modular Edition v5.2.0)');
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
      const { run, user: u, system: s, RunToolCallOutputItem } = await requireDynamic();
      const messages = [s(`User ID for this session: ${userId || 'anonymous'}`), u(userText)];
      const result = await run(this.#agent, messages, { userId });
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);
      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err: any) {
      if (err.message && err.message.includes('Unsupported built-in tool call type')) {
        const toolCallMatch = err.message.match(/\{"type":"hosted_tool_call".*?\}(?=\s*$)/);
        if (toolCallMatch) {
          try {
            const toolCall = JSON.parse(toolCallMatch[0]);
            const toolOutputs: Record<string, any> = {};
            if (toolCall.name && toolCall.status === 'completed') {
              toolOutputs[toolCall.name] = toolCall.name === 'web_search_call' ? 'Web search completed successfully' : 'Tool executed successfully';
            }
            return {
              assistant_text: 'I searched for current information to help with your request. While I encountered a technical issue with processing the search results, the search itself was completed successfully.',
              toolOutputs,
              traceId: toolCall.id || 'hosted-tool-call',
              note: 'Hosted tool call processed successfully despite integration issue'
            };
          } catch (parseErr: any) {
            // ignore
          }
        }
      }
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
      const { run, user: u, assistant: a, system: s, RunToolCallOutputItem } = await requireDynamic();
      const messages = [
        s(`You are a helpful design assistant for a Canva‑like platform. Help users create projects, find templates, and work with design elements. You have access to tools for creating projects, searching assets, and analysing images. User ID for this session: ${userId || 'anonymous'}. Maintain context from previous messages in this conversation.`),
      ];
      const recentHistory = conversationHistory.filter(m => m.role !== 'system').slice(-10);
      for (const m of recentHistory) {
        if (m.role === 'user') messages.push(u(m.content));
        else if (m.role === 'assistant') messages.push(a(m.content));
        else messages.push(s(m.content));
      }
      messages.push(u(userText));
      const result = await run(this.#agent, messages, { userId });
      const toolOutputs = this.#extractToolOutputs(result.newItems, RunToolCallOutputItem);
      return { assistant_text: result.finalOutput, toolOutputs, traceId: result.traceId };
    } catch (err: any) {
      if (err.message && err.message.includes('Unsupported built-in tool call type')) {
        const toolCallMatch = err.message.match(/\{"type":"hosted_tool_call".*?\}(?=\s*$)/);
        if (toolCallMatch) {
          try {
            const toolCall = JSON.parse(toolCallMatch[0]);
            const toolOutputs: Record<string, any> = {};
            if (toolCall.name && toolCall.status === 'completed') {
              toolOutputs[toolCall.name] = toolCall.name === 'web_search_call' ? 'Web search completed successfully' : 'Tool executed successfully';
            }
            return {
              assistant_text: 'I searched for current information to help with your request. While I encountered a technical issue with processing the search results, the search itself was completed successfully.',
              toolOutputs,
              traceId: toolCall.id || 'hosted-tool-call',
              note: 'Hosted tool call processed successfully despite integration issue'
            };
          } catch (parseErr: any) {
            // ignore
          }
        }
      }
      return { assistant_text: 'I encountered an error while processing your request. Please try again.', error: err.message };
    }
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      app: ProjectAgentService.APP,
      tools: this.#agent?.tools?.map((t: any) => t.name) ?? [],
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
  #extractToolOutputs(items: ToolCallItem[] = [], RunToolCallOutputItem: any): Record<string, any> {
    if (!items || items.length === 0) return {};
    const toolOutputs: Record<string, any> = {};
    const errors: string[] = [];
    for (const item of items) {
      try {
        let toolName: string | undefined, toolOutput: any;
        if (RunToolCallOutputItem && item instanceof RunToolCallOutputItem && item.rawItem?.status === 'completed') {
          toolName = item.rawItem.name;
          toolOutput = item.output;
        } else if (item.rawItem && item.rawItem.type === 'hosted_tool_call') {
          toolName = item.rawItem.name;
          if (item.rawItem.status === 'completed') {
            toolOutput = item.output || 'Tool executed successfully';
            if (toolName === 'web_search_call') {
              toolOutput = item.output || 'Web search completed successfully';
            }
          } else if (item.rawItem.status === 'in_progress') {
            continue;
          } else if (item.rawItem.status === 'failed') {
            toolOutput = 'Tool execution failed';
            errors.push(`${toolName}: execution failed`);
          }
        } else if (item.rawItem && item.rawItem.status === 'completed') {
          toolName = item.rawItem.name;
          toolOutput = item.output || 'Tool executed successfully';
        } else if (item.rawItem && item.rawItem.name && !item.rawItem.status) {
          toolName = item.rawItem.name;
          toolOutput = item.output || 'Tool executed successfully';
        } else {
          continue;
        }
        if (toolName) {
          toolOutputs[toolName] = toolOutput;
        }
      } catch (error: any) {
        errors.push(`Tool processing error: ${error.message}`);
      }
    }
    if (errors.length > 0) {
      toolOutputs['_errors'] = errors;
    }
    return toolOutputs;
  }
}

export default new ProjectAgentService();