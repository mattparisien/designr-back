// // agents/designAssistantAgent.js
// // ------------------------------------------------------------
// // Design‑Assistant Agent (v1.0.0)
// // A fully‑featured OpenAI **Agent** powered by the official
// // `@openai/agents` SDK.  The agent can:
// //   • respond conversationally to design questions
// //   • invoke tools such as web‑search, file‑reading, and image lookup
// //   • remain within strict design‑only guard‑rails
// //
// // To install dependencies:
// //   npm install openai @openai/agents duckduckgo-search
// // ------------------------------------------------------------

// /* eslint-disable no-console */

// import { Agent } from '@openai/agents';
// import dotenv from 'dotenv';
// import { search } from 'duckduckgo-search'; // lightweight search helper (stub)
// import fs from 'fs/promises';
// import { OpenAI } from 'openai'; // core SDK

// dotenv.config();

// // ------------------------------------------------------------
// // Environment & OpenAI client
// // ------------------------------------------------------------

// if (!process.env.OPENAI_API_KEY) {
//   throw new Error('OPENAI_API_KEY missing – set it in your .env');
// }

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// // ------------------------------------------------------------
// // Guard‑rail constants
// // ------------------------------------------------------------

// const APP_NAME = process.env.APP_NAME || 'Canva Clone';
// const FORBIDDEN_TOPICS = [
//   'politics',
//   'election',
//   'covid',
//   'virus',
//   'medical',
//   'doctor',
//   'medicine',
//   'legal advice',
//   'lawyer',
//   'law',
//   'financial advice',
//   'investment',
//   'crypto',
//   'hack',
//   'password',
//   'personal information',
//   'private data',
// ];

// // ------------------------------------------------------------
// // Tool implementations (server‑side functions)
// // ------------------------------------------------------------

// /**
//  * Perform a web search (using DuckDuckGo as a simple example).
//  * Returns the top N results with title + URL + snippet.
//  */
// async function webSearch({ query, num_results = 5 }) {
//   const results = await search(query, { maxResults: num_results });
//   return results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }));
// }

// /**
//  * Read a local text‑based file (UTF‑8) from the current project directory.
//  * You should sandbox / validate the path in production.
//  */
// async function readFile({ path }) {
//   const text = await fs.readFile(path, 'utf‑8');
//   // Trim very large files
//   return text.length > 8000 ? text.slice(0, 8000) + '\n…[truncated]' : text;
// }

// // ------------------------------------------------------------
// // Tool metadata for the Agent (JSON schema compliant)
// // ------------------------------------------------------------

// const toolSpecs = [
//   {
//     type: 'function',
//     function: {
//       name: 'web_search',
//       description: 'Search the Internet for up‑to‑date design information, inspiration, or references.',
//       parameters: {
//         type: 'object',
//         properties: {
//           query: { type: 'string', description: 'search query' },
//           num_results: { type: 'integer', description: 'number of results to return' },
//         },
//         required: ['query'],
//       },
//     },
//   },
//   {
//     type: 'function',
//     function: {
//       name: 'read_file',
//       description: 'Read the contents of a project file (text / JSON / SVG).',
//       parameters: {
//         type: 'object',
//         properties: {
//           path: { type: 'string', description: 'relative file path' },
//         },
//         required: ['path'],
//       },
//     },
//   },
// ];

// // ------------------------------------------------------------
// // System prompt – design‑only guard‑rails
// // ------------------------------------------------------------

// const SYSTEM_MESSAGE = `You are a Design Assistant agent for a Canva‑like design platform named "${APP_NAME}".
// Your entire purpose is to help users with *design‑related* tasks inside this application.

// Strict rules:
// 1. Only discuss design topics (logos, presentations, social posts, flyers, colour schemes, typography, branding, layouts, etc.).
// 2. Only assist with platform features (templates, editing elements, managing assets, fonts, colours).
// 3. If the user asks about non‑design topics or forbidden areas (${FORBIDDEN_TOPICS.join(', ')}), reply exactly with:
//    "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?"
// 4. You may use the available tools when it genuinely helps the user achieve a design goal.
// 5. Respond concisely and helpfully. Offer concrete next steps (e.g. "Browse presentation templates", "Apply brand colours").`;

// // ------------------------------------------------------------
// // Agent instantiation
// // ------------------------------------------------------------

// export const designAgent = new Agent({
//   client: openai,
//   model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
//   system: SYSTEM_MESSAGE,
//   tools: toolSpecs,
// });

// // ------------------------------------------------------------
// // Tool dispatcher – bridges Agent <-> JS functions
// // ------------------------------------------------------------

// export async function dispatchToolCall(toolCall /*: ToolCall */) {
//   const { name, arguments: args } = toolCall;
//   try {
//     switch (name) {
//       case 'web_search':
//         return await webSearch(args);
//       case 'read_file':
//         return await readFile(args);
//       default:
//         throw new Error(`Unknown tool: ${name}`);
//     }
//   } catch (err) {
//     console.error(`Tool ${name} failed:`, err);
//     return { error: err.message };
//   }
// }

// // ------------------------------------------------------------
// // Helper – run a single interaction cycle (agent may call tools)
// // ------------------------------------------------------------

// export async function chatWithDesignAgent(userText /*: string */) {
//   const messages = [{ role: 'user', content: userText }];

//   // Kick off an Agent run
//   const run = await designAgent.run({ messages });

//   // If the model decides to call a tool...
//   if (run.toolCalls && run.toolCalls.length > 0) {
//     // Iterate through tool calls, fulfil them, and feed results back in
//     for (const toolCall of run.toolCalls) {
//       const toolResult = await dispatchToolCall(toolCall);
//       await run.submitToolOutput(toolCall.id, toolResult);
//     }
//   }

//   // After submitting tool outputs (if any), the Agent will complete
//   const final = await run.final();
//   return final.content; // assistant's text
// }

// // ------------------------------------------------------------
// // Example CLI usage (node agents/designAssistantAgent.js "How do I make a bold poster?")
// // ------------------------------------------------------------

// if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
//   const prompt = process.argv.slice(2).join(' ');
//   chatWithDesignAgent(prompt)
//     .then((reply) => console.log('\nAssistant:\n', reply))
//     .catch((err) => console.error(err));
// }
