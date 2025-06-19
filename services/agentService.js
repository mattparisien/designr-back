// agentService.js  — minimal, self-contained, CommonJS
const OpenAI = require('openai');

/**
 * @typedef {Object} ToolDef
 * @prop {'web_search'|'file_search'|'function'} type
 * @prop {string=} name
 * @prop {string=} description
 * @prop {Object=} parameters
 * @prop {boolean=} strict
 * @prop {(args:Object)=>Promise<any>=} execute  Executor for custom functions
 */

class AgentService {
  /**
   * @param {{ tools?: Record<string, ToolDef> }} opts
   */
  constructor({ tools = {} } = {}) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Separate “definitions” (sent to OpenAI) from “executors” (run locally).
    this.toolDefs = [];
    this.executors = {};

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
        // built-in hosted tools like web_search / file_search
        this.toolDefs.push({ ...t });          // usually just { type:'web_search' }
        // no executor needed – OpenAI runs it
      }
    }
  }

  /**
   * Core loop: send prompt ➜ handle tool calls ➜ return final answer
   * @param {string} prompt
   * @param {{response_format?: object, maxSteps?: number}} [opts]
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
      wantsJson
        ? 'Return ONLY valid JSON (no markdown, no commentary).'
        : null
    ].filter(Boolean).join(' ');

    // ---------- 1. initial request ----------
    let response = await this.openai.responses.create({
      model: 'gpt-4o-2024-08-06',
      instructions,
      input: prompt,
      tools: this.toolDefs,     // <— we pass tools here
      tool_choice: 'auto'       // optional; Auto is default
    });

    // ---------- 2. loop while model asks for tools ----------
    for (let step = 0; step < maxSteps; step++) {
      const calls = (response.output ?? []).filter(b => b.type === 'tool_call');
      if (calls.length === 0) break; // assistant is done

      // Run every tool call in parallel, collect blocks for follow-up
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
            result = { error: `No executor for tool "${call.name}"` };
          }
          return {
            type: 'function_call_output', // alias of tool_result
            call_id: call.id,             // MUST match the tool_call id
            output: JSON.stringify(result)
          };
        })
      );

      // Send the tool results back, keyed by previous_response_id
      response = await this.openai.responses.create({
        model: 'gpt-4o-2024-08-06',
        input: toolResultBlocks,
        previous_response_id: response.id
      });
    }

    // ---------- 3. final text + optional JSON parse ----------
    const text = response.output_text;           // helper from SDK
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

/* -------------------  Example wiring  --------------------

const agent = new AgentService({
  tools: {
    // Built-in web search
    web_search: { type: 'web_search' },

    // Custom currency-converter function (example from DataCamp)
    convert_currency: {
      type: 'function',
      description: 'Convert an amount of money to a different currency',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          from_currency: { type: 'string' },
          to_currency: { type: 'string' }
        },
        required: ['amount', 'from_currency', 'to_currency']
      },
      execute: async ({ amount, from_currency, to_currency }) => {
        // …put real FX logic here…
        return { converted_amount: 123.45 };
      }
    }
  }
});

agent.generateResponse('How much is 100 EUR in JPY?', { response_format: { type: 'json_object' } })
  .then(console.log)
  .catch(console.error);

----------------------------------------------------------------*/
