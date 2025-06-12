const ProjectAgentService = require('../services/projectAgentService');

// Initialize the project agent service
let projectAgentService = null;

// Initialize service on first use
async function initializeService() {
  if (!projectAgentService) {
    projectAgentService = new ProjectAgentService();
    await projectAgentService.initialize();
  }
  return projectAgentService;
}

// Health check endpoint
exports.healthCheck = async (req, res) => {
  try {
    const service = await initializeService();
    res.json({ 
      status: 'healthy', 
      message: 'Chat service is running',
      agentReady: !!service.agent
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
};

// Send message endpoint
exports.sendMessage = async (req, res) => {
  try {
    const { message, userId = 'anonymous-user' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    // Initialize the service
    const service = await initializeService();

    console.log(`Processing chat message from user ${userId}: ${message.substring(0, 100)}...`);

    // Generate response using the project agent
    const result = await service.chat(message, { userId });

    res.json({
      success: true,
      response: result.assistant_text,
      toolOutputs: result.toolOutputs,
      userId: userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
};
