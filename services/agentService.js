// agentService.js  — CommonJS
const OpenAI = require('openai');
const {
  OPENAI_CONFIG,
  AGENT_INSTRUCTIONS,
  TOOL_CONFIG,
  LOGGING_CONFIG,
  JSON_CONFIG,
  ERROR_MESSAGES,
  VALIDATION
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

class AgentService {
  /**
   * @param {{ tools?: Record<string, ToolDef>, enableWebSearch?: boolean, enableProjectCreation?: boolean }} opts
   *        tools                  — additional custom or hosted tools
   *        enableWebSearch        — set to false if you truly want to remove it
   *        enableProjectCreation  — set to false to disable project creation tool
   */
  constructor({ tools = {}, enableWebSearch = true, enableProjectCreation = true } = {}) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    /** @type {ToolDef[]} */
    this.toolDefs = [];
    /** @type {Record<string,(args:Object)=>Promise<any>>} */
    this.executors = {};

    // ---------- 1. default hosted web_search ----------
    if (enableWebSearch) {
      // Avoid duplicate if user already provided one called 'web_search'
      const hasWS = Object.values(tools).some(t => t.type === 'web_search');
      if (!hasWS) this.toolDefs.push(TOOL_CONFIG.WEB_SEARCH);
    }

    // ---------- 2. default project creation tool ----------
    if (enableProjectCreation) {
      // Avoid duplicate if user already provided one called 'create_project'
      const hasPC = Object.keys(tools).includes('create_project');
      if (!hasPC) {
        this.toolDefs.push(TOOL_CONFIG.CREATE_PROJECT);
        this.executors['create_project'] = createProjectTool;
      }
    }

    // ---------- 3. user-supplied tools ----------
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
        // hosted tools such as file_search; OpenAI runs them
        this.toolDefs.push({ ...t });
      }
    }
  }

  /**
   * Send prompt ➜ follow tool calls ➜ return final answer
   */
  async generateResponse(prompt, { response_format = null, maxSteps = OPENAI_CONFIG.DEFAULT_MAX_STEPS } = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_PROMPT);
    }
    if (response_format && typeof response_format !== 'object') {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
    }

    const wantsJson = response_format?.type === JSON_CONFIG.JSON_OBJECT_TYPE;
    const instructions = AGENT_INSTRUCTIONS.build(wantsJson);

    // 1️⃣ initial request
    if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
      console.log(LOGGING_CONFIG.MESSAGES.INITIAL_REQUEST, this.toolDefs.map(t => t.type));
    }
    let response = await this.openai.responses.create({
      model: OPENAI_CONFIG.MODEL,
      instructions,
      input: prompt,
      tools: this.toolDefs,
      tool_choice: OPENAI_CONFIG.TOOL_CHOICE
    });
    if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
      console.log(LOGGING_CONFIG.MESSAGES.INITIAL_RESPONSE, response.output?.length || 0);
    }

    // 2️⃣ handle tool calls
    for (let step = 0; step < maxSteps; step++) {
      const calls = (response.output ?? []).filter(b => b.type === 'tool_call');
      if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
        console.log(LOGGING_CONFIG.MESSAGES.STEP_PROCESSING
          .replace('{step}', step + 1)
          .replace('{count}', calls.length));
      }
      
      if (calls.length === 0) {
        if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
          console.log(LOGGING_CONFIG.MESSAGES.NO_MORE_CALLS);
        }
        break;
      }

      // Log the tool calls
      if (LOGGING_CONFIG.ENABLED.TOOL_CALLS) {
        calls.forEach(call => {
          console.log(LOGGING_CONFIG.MESSAGES.TOOL_CALL
            .replace('{name}', call.name), call.arguments);
          
          // Enhanced logging for web search calls
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
            // For hosted tools like web_search, OpenAI handles execution
            if (call.name === 'web_search' && LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
              console.log(LOGGING_CONFIG.MESSAGES.WEB_SEARCH_HOSTED);
            } else if (LOGGING_CONFIG.ENABLED.EXECUTION_STATUS) {
              console.log(LOGGING_CONFIG.MESSAGES.NO_EXECUTOR.replace('{name}', call.name));
            }
            // Hosted tool results are returned automatically by OpenAI,
            // but if we somehow get a call we don't host, notify the model.
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
        console.log(LOGGING_CONFIG.MESSAGES.RESPONSE_AFTER_STEP
          .replace('{step}', step + 1), response.output?.length || 0, 'blocks');
        
        // Log web search results if present in the response
        if (response.output_text && calls.some(call => call.name === 'web_search') && LOGGING_CONFIG.ENABLED.WEB_SEARCH_RESULTS) {
          const textPreview = response.output_text.substring(0, 200);
          console.log(LOGGING_CONFIG.MESSAGES.WEB_SEARCH_PREVIEW, textPreview + '...');
        }
      }
    }

    // 3️⃣ final text (+ optional JSON)
    const text = response.output_text;
    let parsed;
    if (wantsJson) {
      try {
        // First try to parse the text directly
        parsed = JSON.parse(text);
      } catch (e) {
        // If that fails, try to extract JSON from markdown code blocks
        const jsonMatch = text.match(JSON_CONFIG.MARKDOWN_PATTERN);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[1].trim());
          } catch (e2) {
            // Still can't parse, leave `parsed` undefined
          }
        }
        // If no code blocks found, leave `parsed` undefined
      }
    }
    return { response: text, parsed };
  }
}

module.exports = AgentService;
