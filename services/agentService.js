// agentService.js  — CommonJS
const OpenAI = require('openai');

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
   * @param {{ tools?: Record<string, ToolDef>, enableWebSearch?: boolean }} opts
   *        tools            — additional custom or hosted tools
   *        enableWebSearch  — set to false if you truly want to remove it
   */
  constructor({ tools = {}, enableWebSearch = true } = {}) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    /** @type {ToolDef[]} */
    this.toolDefs = [];
    /** @type {Record<string,(args:Object)=>Promise<any>>} */
    this.executors = {};

    // ---------- 1. default hosted web_search ----------
    if (enableWebSearch) {
      // Avoid duplicate if user already provided one called 'web_search'
      const hasWS = Object.values(tools).some(t => t.type === 'web_search');
      if (!hasWS) this.toolDefs.push({ type: 'web_search' });
    }

    // ---------- 2. user-supplied tools ----------
    for (const [key, t] of Object.entries(tools)) {
      if (t.type === 'function') {
        this.toolDefs.push({
          type: 'function',
          name: key,
          description: t.description,
          parameters: t.parameters,
          strict: t.strict ?? true
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
  async generateResponse(prompt, { response_format = null, maxSteps = 8 } = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt must be a non-empty string');
    }
    if (response_format && typeof response_format !== 'object') {
      throw new Error('response_format must be an object or null');
    }

    const wantsJson = response_format?.type === 'json_object';
    const instructions = [
      'You are a helpful assistant.',
      wantsJson ? 'Return ONLY valid JSON (no markdown).' : null
    ].filter(Boolean).join(' ');

    // 1️⃣ initial request
    let response = await this.openai.responses.create({
      model: 'gpt-4o-2024-08-06',
      instructions,
      input: prompt,
      tools: this.toolDefs,
      tool_choice: 'auto'
    });

    // 2️⃣ handle tool calls
    for (let step = 0; step < maxSteps; step++) {
      const calls = (response.output ?? []).filter(b => b.type === 'tool_call');
      if (calls.length === 0) break;

      const toolResultBlocks = await Promise.all(
        calls.map(async call => {
          const exec = this.executors[call.name];
          let result;
          if (exec) {
            const args = call.arguments ? JSON.parse(call.arguments) : {};
            try {
              result = await exec(args);
            } catch (err) {
              result = { error: err.message };
            }
          } else {
            // Hosted tool results are returned automatically by OpenAI,
            // but if we somehow get a call we don’t host, notify the model.
            result = { error: `No executor for tool "${call.name}"` };
          }
          return {
            type: 'function_call_output',        // aka tool_result
            call_id: call.id,
            output: JSON.stringify(result)
          };
        })
      );

      response = await this.openai.responses.create({
        model: 'gpt-4o-2024-08-06',
        input: toolResultBlocks,
        previous_response_id: response.id
      });
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
        const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\s*```/);
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
