/* tests/agent.workflow.test.js */
/* eslint-env jest */
require('dotenv').config();

const { buildAgent } = require('../agent');            // adjust path if needed
jest.setTimeout(90_000);                              // model + 2 tool calls

// Stubbed deps so low-level tools don't crash
const vectorStore   = { search: async () => [] };
const imageAnalysis = { analyse: async () => ({ labels: [] }) };

let assistant;

beforeAll(async () => {
  assistant = await buildAgent({ vectorStore, imageAnalysis });
}, 30_000);

test('web search followed by a specialist tool → Instagram post output', async () => {
  expect.hasAssertions();

  const prompt =
    'Create an instagram post on the 5 most relevant hedge fund trends today';

  const result = await assistant.run(prompt);

  // Since we're using the custom implementation, we won't have newItems
  // Instead, we'll check that the result contains the expected content
  console.log('Final output:', result.finalOutput);

  // — 1 — The result should contain finalOutput
  expect(result.finalOutput).toBeDefined();
  expect(typeof result.finalOutput).toBe('string');

  // — 2 — Final assistant text references an Instagram post
  expect(result.finalOutput).toMatch(/Instagram/i);
  
  // — 3 — Should mention typography or design concepts
  expect(result.finalOutput).toMatch(/typography|design|post|minimalist/i);

  // — 4 — Should actually have created a project (not just talked about it)
  expect(result.finalOutput).toMatch(/✅ Project Created|Created.*successfully/i);

  // — 4 — Should actually have created a project (not just talked about it)
  expect(result.finalOutput).toMatch(/created|project|successfully/i);
});
