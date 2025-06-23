let agent;

async function loadAgent() {
  if (!agent) {
    const module = await import('../agent/index.mjs');
    agent = module.default;
  }
  return agent;
}


async function ask(req, res) {
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
    console.error('Error generating response:', err);
    // next(err); // lets your error middleware log/format
  }
}

module.exports = { ask };
