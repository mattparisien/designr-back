import { Request, Response } from 'express';

// Agent variable to store the loaded agent instance
let agent: any;

async function loadAgent() {
  if (!agent) {
    // Use eval to bypass TypeScript's require transformation
    const importFunc = new Function('specifier', 'return import(specifier)');
    const module = await importFunc('../agent/index.mjs');
    agent = module.default;
  }
  return agent;
}

export const ask = async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const agent = await loadAgent();

    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
      { configurable: { thread_id: 42 } } // <- add the thread id
    );

    const answer = result.messages.at(-1)?.content;

    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'Error generating response' });
    console.error('Error generating response:', err);
    // next(err); // lets your error middleware log/format
  }
};
