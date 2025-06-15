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
  console.log('Tool calls:', result.toolCalls);

  // — 1 — The result should contain finalOutput
  expect(result.finalOutput).toBeDefined();
  expect(typeof result.finalOutput).toBe('string');

  // — 2 — Should have actually called the creation tool
  expect(result.toolCalls).toBeDefined();
  expect(Array.isArray(result.toolCalls)).toBe(true);
  expect(result.toolCalls.length).toBeGreaterThan(0);
  
  // — 3 — The tool call should be create_social_media_project
  const creationCall = result.toolCalls.find(call => call.name === 'create_social_media_project');
  expect(creationCall).toBeDefined();
  expect(creationCall.args).toBeDefined();
  expect(creationCall.args.platform).toBe('instagram');
  expect(creationCall.args.title).toBeDefined();

  // — 4 — Final assistant text references an Instagram post
  expect(result.finalOutput).toMatch(/Instagram/i);
  
  // — 5 — Should mention hedge fund or finance concepts
  expect(result.finalOutput).toMatch(/hedge fund|finance|financial|investment|trends/i);

  // — 6 — Should actually have created a project (not just talked about it)
  expect(result.finalOutput).toMatch(/✅ Project Created|Created.*successfully/i);
});
