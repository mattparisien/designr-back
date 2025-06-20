const OpenAI = require('openai');
const {
  OPENAI_CONFIG,
  AGENT_INSTRUCTIONS,
  TOOL_CONFIG,
  LOGGING_CONFIG,
  JSON_CONFIG,
  ERROR_MESSAGES
} = require('../config/agentConfig');
const { createProjectTool } = require('../utils/agentTools');

/**
 * @typedef {Object} ToolDef
 * @prop {'web_search'|'file_search'|'function'} type
 * @prop {string=} name
 * @prop {string=} description
 * @prop {Object=} parameters
 * @prop {boolean=} strict
 * @prop {(args:Object)=>Promise<any>=} execute
 */

/**
 * AgentService
 * — Adds optional long‑lived conversation history ("thread") so multiple
 *   generateResponse() calls can feel like one continuous chat.
 *
 * Call `resetHistory()` when you want to start a brand‑new thread, or pass
 * `{ reset:true }` in the generateResponse options.
 */
class AgentService {
  /**
   * @param {{
   *   tools?: Record<string, ToolDef>,
   *   enableWebSearch?: boolean,
   *   enableProjectCreation?: boolean,
   *   persistHistory?: boolean
   * }} opts
   */
  constructor({
    tools = {},
    enableWebSearch = true,
    enableProjectCreation = true,
    persistHistory = true
  } = {}) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    /** @type {ToolDef[]} */
    this.toolDefs = [];
    /** @type {Record<string,(args:Object)=>Promise<any>>} */
    this.executors = {};

    /** Should we carry conversation history between calls? */
    this.persistHistory = persistHistory;
    /** @type {string|null} — OpenAI "thread" id (a.k.a. last response id) */
    this.threadId = null;

    /** -------------------- 1. default hosted web_search -------------------- */
    if (enableWebSearch) {
      const hasWS = Object.values(tools).some(t => t.type === 'web_search');
      if (!hasWS) this.toolDefs.push(TOOL_CONFIG.WEB_SEARCH);
    }

    /** -------------------- 2. default project tool ------------------------- */
    if (enableProjectCreation) {
      const hasPC = Object.keys(tools).includes('create_project');
      if (!hasPC) {
        this.toolDefs.push(TOOL_CONFIG.CREATE_PROJECT);
        this.executors.create_project = createProjectTool;
      }
    }

    /** -------------------- 3. user‑supplied tools -------------------------- */
    for (const [key, t] of Object.entries(tools)) {
      if (t.type === 'function') {
        this.toolDefs.push({
          type: 'function',
          name: key,
          description: t.description,
          parameters: t.parameters,
          strict: t.strict ?? TOOL_CONFIG.FUNCTION_DEFAULTS.strict
        });
        this.executors[key] = t.execute;
      } else {
        // hosted tools handled by OpenAI (web_search, file_search, …)
        this.toolDefs.push({ ...t });
      }
    }
  }

  /** Wipe stored history so the next call starts a fresh thread. */
  resetHistory() {
    this.threadId = null;
  }

  /**
   * Send prompt ➜ follow tool calls ➜ return final answer
   *
   * @param {string} prompt
   * @param {{
   *   response_format?: { type: string },
   *   maxSteps?: number,
   *   reset?: boolean
   * }} opts
   */
  async generateResponse(
    prompt,
    { response_format = null, maxSteps = OPENAI_CONFIG.DEFAULT_MAX_STEPS, reset = false } = {}
  ) {
    // Optionally start fresh
    if (reset) this.resetHistory();

    if (!prompt || typeof prompt !== 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_PROMPT);
    }
    if (response_format && typeof response_format !== 'object') {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
    }

    const wantsJson = response_format?.type === JSON_CONFIG.JSON_OBJECT_TYPE;
    const instructions = AGENT_INSTRUCTIONS.build(wantsJson);

    /* ───────────────────── 1️⃣ initial request ─────────────────────── */
    if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
      console.log(LOGGING_CONFIG.MESSAGES.INITIAL_REQUEST, this.toolDefs.map(t => t.type));
    }

    let response = await this.openai.responses.create({
      model: OPENAI_CONFIG.MODEL,
      instructions,
      input: prompt,
      tools: this.toolDefs,
      tool_choice: OPENAI_CONFIG.TOOL_CHOICE,
      // <-- carry conversation history if enabled + available
      previous_response_id: this.persistHistory && this.threadId ? this.threadId : undefined
    });

    if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
      console.log(LOGGING_CONFIG.MESSAGES.INITIAL_RESPONSE, response.output?.length || 0);
    }

    /* ───────────────────── 2️⃣ handle tool calls ───────────────────── */
    for (let step = 0; step < maxSteps; step++) {
      const calls = (response.output ?? []).filter(b => b.type === 'tool_call');

      if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
        console.log(
          LOGGING_CONFIG.MESSAGES.STEP_PROCESSING
            .replace('{step}', step + 1)
            .replace('{count}', calls.length)
        );
      }

      if (calls.length === 0) {
        if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
          console.log(LOGGING_CONFIG.MESSAGES.NO_MORE_CALLS);
        }
        break;
      }

      if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
        calls.forEach(call => {
          console.log(LOGGING_CONFIG.MESSAGES.TOOL_CALL.replace('{name}', call.name), call.arguments);
          if (call.name === 'web_search' && LOGGING_CONFIG.ENABLED.WEB_SEARCH_QUERIES) {
            const args = call.arguments ? JSON.parse(call.arguments) : {};
            console.log(LOGGING_CONFIG.MESSAGES.WEB_SEARCH_QUERY, args.query || 'No query specified');
          }
        });
      }

      const toolResultBlocks = await Promise.all(
        calls.map(async call => {
          const exec = this.executors[call.name];
          let result;
          if (exec) {
            const args = call.arguments ? JSON.parse(call.arguments) : {};
            try {
              if (LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
                console.log(LOGGING_CONFIG.MESSAGES.CUSTOM_TOOL_EXECUTING.replace('{name}', call.name));
              }
              result = await exec(args);
              if (LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
                console.log(LOGGING_CONFIG.MESSAGES.CUSTOM_TOOL_SUCCESS.replace('{name}', call.name));
              }
            } catch (err) {
              if (LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
                console.log(LOGGING_CONFIG.MESSAGES.CUSTOM_TOOL_FAILED.replace('{name}', call.name), err.message);
              }
              result = { error: err.message };
            }
          } else {
            if (call.name === 'web_search' && LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
              console.log(LOGGING_CONFIG.MESSAGES.WEB_SEARCH_HOSTED);
            } else if (LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
              console.log(LOGGING_CONFIG.MESSAGES.NO_EXECUTOR.replace('{name}', call.name));
            }
            result = { error: ERROR_MESSAGES.NO_EXECUTOR.replace('{name}', call.name) };
          }
          return {
            type: OPENAI_CONFIG.FUNCTION_CALL_OUTPUT_TYPE,
            call_id: call.id,
            output: JSON.stringify(result)
          };
        })
      );

      response = await this.openai.responses.create({
        model: OPENAI_CONFIG.MODEL,
        input: toolResultBlocks,
        previous_response_id: response.id
      });

      if (LOGGING_CONFIG.ENABLED.RESPONSE_PROCESSING) {
        console.log(
          LOGGING_CONFIG.MESSAGES.RESPONSE_AFTER_STEP.replace('{step}', step + 1),
          response.output?.length || 0,
          'blocks'
        );

        if (
          response.output_text &&
          calls.some(call => call.name === 'web_search') &&
          LOGGING_CONFIG.ENABLED.WEB_SEARCH_RESULTS
        ) {
          const textPreview = response.output_text.substring(0, 200);
          console.log(LOGGING_CONFIG.MESSAGES.WEB_SEARCH_PREVIEW, textPreview + '...');
        }
      }
    }

    /* ───────────────────── 3️⃣ final text (+ optional JSON) ─────────── */
    const text = response.output_text;
    let parsed;
    if (wantsJson) {
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        const jsonMatch = text.match(JSON_CONFIG.MARKDOWN_PATTERN);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[1].trim());
          } catch (_) {
            /* ignore */
          }
        }
      }
    }

    // Persist thread for next call if requested
    if (this.persistHistory) {
      this.threadId = response.id;
    }

    return { response: text, parsed, threadId: this.threadId };
  }
}

module.exports = AgentService;
