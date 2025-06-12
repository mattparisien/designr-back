const ProjectAgentService = require('../services/projectAgentService');
const Chat = require('../models/Chat');

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
    const { message, userId = 'anonymous-user', chatId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    // Initialize the service
    const service = await initializeService();

    console.log(`Processing chat message from user ${userId}: ${message.substring(0, 100)}...`);

    // Find or create active chat conversation
    let chat;
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({ 
          error: 'Chat not found or access denied' 
        });
      }
    } else {
      chat = await Chat.findOrCreateActiveChat(userId);
    }

    // Add the user message to the conversation
    chat.addMessage('user', message);

    // Get conversation history for context
    const conversationHistory = chat.getConversationHistory(15); // Last 15 messages

    // Generate response using the project agent with conversation history
    const result = await service.chatWithHistory(message, conversationHistory, { userId });

    // Add the assistant response to the conversation
    chat.addMessage('assistant', result.assistant_text, {
      toolOutputs: result.toolOutputs,
      traceId: result.traceId
    });

    // Save the updated conversation
    await chat.save();

    res.json({
      success: true,
      response: result.assistant_text,
      toolOutputs: result.toolOutputs,
      chatId: chat._id,
      messageCount: chat.messages.length,
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

// Get user's chat conversations
exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    const chats = await Chat.getUserChats(userId, parseInt(limit));

    res.json({
      success: true,
      chats: chats,
      count: chats.length
    });

  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversations',
      details: error.message 
    });
  }
};

// Get specific chat conversation with full message history
exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;

    if (!chatId) {
      return res.status(400).json({ 
        error: 'Chat ID is required' 
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ 
        error: 'Chat not found' 
      });
    }

    // Check if user has access to this chat
    if (userId && chat.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    res.json({
      success: true,
      chat: {
        id: chat._id,
        title: chat.title,
        messages: chat.messages,
        metadata: chat.metadata,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversation',
      details: error.message 
    });
  }
};

// Create a new chat conversation
exports.createNewChat = async (req, res) => {
  try {
    const { userId, title = 'New Conversation' } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    // Deactivate previous active chats
    await Chat.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Create new chat
    const newChat = new Chat({
      userId,
      title,
      messages: [],
      isActive: true
    });

    await newChat.save();

    res.json({
      success: true,
      chat: {
        id: newChat._id,
        title: newChat.title,
        metadata: newChat.metadata,
        createdAt: newChat.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating new chat:', error);
    res.status(500).json({ 
      error: 'Failed to create new conversation',
      details: error.message 
    });
  }
};

// Delete a chat conversation
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!chatId) {
      return res.status(400).json({ 
        error: 'Chat ID is required' 
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ 
        error: 'Chat not found' 
      });
    }

    // Check if user has access to this chat
    if (userId && chat.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    await Chat.findByIdAndDelete(chatId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ 
      error: 'Failed to delete conversation',
      details: error.message 
    });
  }
};

// Update chat title
exports.updateChatTitle = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title, userId } = req.body;

    if (!chatId || !title) {
      return res.status(400).json({ 
        error: 'Chat ID and title are required' 
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ 
        error: 'Chat not found' 
      });
    }

    // Check if user has access to this chat
    if (userId && chat.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    chat.title = title;
    await chat.save();

    res.json({
      success: true,
      chat: {
        id: chat._id,
        title: chat.title,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating chat title:', error);
    res.status(500).json({ 
      error: 'Failed to update chat title',
      details: error.message 
    });
  }
};
