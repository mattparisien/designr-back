/* tests/projectAgentService.test.js */

require('dotenv').config();
jest.setTimeout(90_000);               // integration run can take a while  :contentReference[oaicite:3]{index=3}

const ProjectAgentService = require('../services/projectAgentService');

describe('ProjectAgentService – basic chat()', () => {
  let svc;

  beforeAll(async () => {
    svc = new ProjectAgentService();
    await svc.initialize();            // ensure agent + deps are ready  :contentReference[oaicite:4]{index=4}
  });

  test('responds with assistant text and toolOutputs', async () => {
    const prompt = 'Create a minimalist Instagram post about coffee.';
    const { assistant_text, toolOutputs } = await svc.chat(prompt, { userId: 'jest-user' });

    expect(typeof assistant_text).toBe('string');       // basic sanity   :contentReference[oaicite:5]{index=5}
    expect(assistant_text.length).toBeGreaterThan(0);

    expect(toolOutputs).toBeDefined();
    expect(typeof toolOutputs).toBe('object');
  });
});
