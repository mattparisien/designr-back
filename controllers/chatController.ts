
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import ProjectAgentService, { IProjectAgentService } from '../services/projectAgentService';
import Chat from '../models/Chat';

// Types for request/response interfaces
interface SendMessageRequest {
  message: string;
  userId?: string;
  chatId?: string;
}

interface CreateChatRequest {
  userId: string;
  title?: string;
}

interface UpdateChatTitleRequest {
  title: string;
  userId?: string;
}

interface DeleteChatRequest {
  userId?: string;
}

interface ChatHealthResponse {
  status: 'healthy' | 'unhealthy';
  message: string;
  agentReady?: boolean;
  error?: string;
}

interface SendMessageResponse {
  success: boolean;
  response: string;
  toolOutputs?: Record<string, any>;
  chatId: string;
  messageCount: number;
  userId: string;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface ChatListResponse {
  success: boolean;
  chats: any[];
  count: number;
}

interface ChatResponse {
  success: boolean;
  chat: {
    id: string;
    title: string;
    messages: any[];
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
  };
}

interface CreateChatResponse {
  success: boolean;
  chat: {
    id: string;
    title: string;
    metadata: any;
    createdAt: Date;
  };
}

interface DeleteChatResponse {
  success: boolean;
  message: string;
}

interface UpdateChatResponse {
  success: boolean;
  chat: {
    id: string;
    title: string;
    updatedAt: Date;
  };
}

// Initialize the project agent service
let projectAgentService: IProjectAgentService | null = null;

// Initialize service on first use
async function initializeService(): Promise<IProjectAgentService> {
  if (!projectAgentService) {
    projectAgentService = new ProjectAgentService();
    await projectAgentService.initialize();
  }
  return projectAgentService;
}

// Health check endpoint
export const healthCheck = asyncHandler(async (req: Request, res: Response<ChatHealthResponse>): Promise<void> => {
  try {
    const service = await initializeService();
    const health = service.getHealthStatus();
    
    res.json({
      status: 'healthy',
      message: 'Chat service is running',
      agentReady: health.initialized
    });
  } catch (error) {
    console.error('Health check failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      status: 'unhealthy',
      message: 'Chat service is not running',
      error: errorMessage
    });
  }
});

// Send message endpoint
export const sendMessage = asyncHandler(async (req: Request<{}, SendMessageResponse | ErrorResponse, SendMessageRequest>, res: Response<SendMessageResponse | ErrorResponse>): Promise<void> => {
  const { message, userId = 'anonymous-user', chatId } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Message is required and must be a string'
    });
    return;
  }

  // Initialize the service
  const service = await initializeService();

  console.log(`Processing chat message from user ${userId}: ${message.substring(0, 100)}...`);

  // Find or create active chat conversation
  let chat;
  if (chatId) {
    chat = await Chat.findById(chatId);
    if (!chat || chat.userId !== userId) {
      res.status(404).json({
        error: 'Chat not found or access denied'
      });
      return;
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
    chatId: chat._id.toString(),
    messageCount: chat.messages.length,
    userId: userId,
    timestamp: new Date().toISOString()
  });
});

// Get user's chat conversations
export const getUserChats = asyncHandler(async (req: Request<{ userId: string }, ChatListResponse | ErrorResponse, {}, { limit?: string }>, res: Response<ChatListResponse | ErrorResponse>): Promise<void> => {
  const { userId } = req.params;
  const { limit = '10' } = req.query;

  if (!userId) {
    res.status(400).json({
      error: 'User ID is required'
    });
    return;
  }

  const chats = await Chat.getUserChats(userId, parseInt(limit, 10));

  res.json({
    success: true,
    chats: chats,
    count: chats.length
  });
});

// Get specific chat conversation with full message history
export const getChatById = asyncHandler(async (req: Request<{ chatId: string }, ChatResponse | ErrorResponse, {}, { userId?: string }>, res: Response<ChatResponse | ErrorResponse>): Promise<void> => {
  const { chatId } = req.params;
  const { userId } = req.query;

  if (!chatId) {
    res.status(400).json({
      error: 'Chat ID is required'
    });
    return;
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({
      error: 'Chat not found'
    });
    return;
  }

  // Check if user has access to this chat
  if (userId && chat.userId !== userId) {
    res.status(403).json({
      error: 'Access denied'
    });
    return;
  }

  res.json({
    success: true,
    chat: {
      id: chat._id.toString(),
      title: chat.title,
      messages: chat.messages,
      metadata: chat.metadata,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }
  });
});

// Create a new chat conversation
export const createNewChat = asyncHandler(async (req: Request<{}, CreateChatResponse | ErrorResponse, CreateChatRequest>, res: Response<CreateChatResponse | ErrorResponse>): Promise<void> => {
  const { userId, title = 'New Conversation' } = req.body;

  if (!userId) {
    res.status(400).json({
      error: 'User ID is required'
    });
    return;
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
      id: newChat._id.toString(),
      title: newChat.title,
      metadata: newChat.metadata,
      createdAt: newChat.createdAt
    }
  });
});

// Delete a chat conversation
export const deleteChat = asyncHandler(async (req: Request<{ chatId: string }, DeleteChatResponse | ErrorResponse, DeleteChatRequest>, res: Response<DeleteChatResponse | ErrorResponse>): Promise<void> => {
  const { chatId } = req.params;
  const { userId } = req.body;

  if (!chatId) {
    res.status(400).json({
      error: 'Chat ID is required'
    });
    return;
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({
      error: 'Chat not found'
    });
    return;
  }

  // Check if user has access to this chat
  if (userId && chat.userId !== userId) {
    res.status(403).json({
      error: 'Access denied'
    });
    return;
  }

  await Chat.findByIdAndDelete(chatId);

  res.json({
    success: true,
    message: 'Chat deleted successfully'
  });
});

// Update chat title
export const updateChatTitle = asyncHandler(async (req: Request<{ chatId: string }, UpdateChatResponse | ErrorResponse, UpdateChatTitleRequest>, res: Response<UpdateChatResponse | ErrorResponse>): Promise<void> => {
  const { chatId } = req.params;
  const { title, userId } = req.body;

  if (!chatId || !title) {
    res.status(400).json({
      error: 'Chat ID and title are required'
    });
    return;
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({
      error: 'Chat not found'
    });
    return;
  }

  // Check if user has access to this chat
  if (userId && chat.userId !== userId) {
    res.status(403).json({
      error: 'Access denied'
    });
    return;
  }

  chat.title = title;
  await chat.save();

  res.json({
    success: true,
    chat: {
      id: chat._id.toString(),
      title: chat.title,
      updatedAt: chat.updatedAt
    }
  });
});
