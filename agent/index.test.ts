import { buildAgent } from './index';

describe('Agent', () => {
  const agent = buildAgent({});

  it('should return a finalOutput string for a simple prompt', async () => {
    const response = await agent.run('Say hello to the world!');
    expect(typeof response.finalOutput).toBe('string');
    expect(response.finalOutput.length).toBeGreaterThan(0);
  });

  it('should handle tool calls and return toolCalls array', async () => {
    // This prompt should trigger a tool call (web_search or normalize_search_results)
    const response = await agent.run('Create an Instagram post about summer biking tips');
    // Should always return a string
    expect(typeof response.finalOutput).toBe('string');
    // If toolCalls present, check structure
    if (response.toolCalls) {
      expect(Array.isArray(response.toolCalls)).toBe(true);
      for (const call of response.toolCalls) {
        expect(typeof call.name).toBe('string');
        expect(call.args).toBeDefined();
        expect(call.result).toBeDefined();
      }
    }
  });

  it('should handle multiple runs without error', async () => {
    for (let i = 0; i < 3; i++) {
      const response = await agent.run(`Test run ${i}`);
      expect(typeof response.finalOutput).toBe('string');
    }
  });
});
