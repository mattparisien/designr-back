const AgentService = require('../services/agentService');

// Create an instance of the agent service
const agentService = new AgentService();

async function generateResponse(req, res) {
  const { prompt, response_format } = req.body;

  try {
    const result = await agentService.generateResponse(prompt, { response_format });
    res.json(result);
  } catch (error) {
    console.error('Error in agent controller:', error);
    
    // Handle validation errors with 400 status
    if (error.message.includes('prompt must be') || error.message.includes('response_format must be')) {
      return res.status(400).json({ error: error.message });
    }
    
    // Handle other errors with 500 status
    res.status(500).json({ error: 'Error generating response.' });
  }
}

module.exports = { generateResponse };
