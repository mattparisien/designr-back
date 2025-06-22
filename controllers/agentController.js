let getAgentExecutor;

async function loadAgentExecutor() {
  if (!getAgentExecutor) {
    const module = await import('../agent/getAgentExecutor.mjs');
    getAgentExecutor = module.default || module.getAgentExecutor;
  }
  return getAgentExecutor;
}


async function ask(req, res) {
  try {
    const { prompt } = req.body;
      const agentExecutorFn = await loadAgentExecutor();
    const executor = await agentExecutorFn();
    console.log('Agent executor initialized successfully');

    const { output } = await executor.invoke({ input: prompt });
    res.json({ answer: output });
  } catch (err) {
    console.error('Error generating response:', err);
    // next(err); // lets your error middleware log/format
  }
}

module.exports = { ask };
