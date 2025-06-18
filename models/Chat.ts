import mongoose, { Schema, Document, Model } from 'mongoose';

// Define interfaces for better TypeScript support
interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface IChatMetadata {
  totalMessages: number;
  lastActivity: Date;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

interface IChat extends Document {
  title: string;
  userId: string;
  messages: IMessage[];
  metadata: IChatMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  addMessage(role: string, content: string, metadata?: Record<string, any>): void;
  getFormattedMessages(maxMessages?: number): any[];
  getConversationHistory(maxMessages?: number): Array<{ role: string; content: string }>;
}

interface IChatModel extends Model<IChat> {
  findOrCreateActiveChat(userId: string): Promise<IChat>;
  getUserChats(userId: string, limit?: number): Promise<IChat[]>;
}

// Schema for individual messages in a conversation
const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Optional metadata for assistant messages
  toolOutputs: {
    type: Schema.Types.Mixed, // Store tool call results
    default: {}
  },
  traceId: {
    type: String // For debugging with OpenAI tracing
  }
}, { _id: true });

// Schema for chat conversations
const ChatSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [MessageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  // Conversation metadata
  metadata: {
    totalMessages: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    projectContext: {
      projectId: String,
      projectType: String,
      lastAction: String
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
ChatSchema.index({ userId: 1, isActive: 1 });
ChatSchema.index({ 'metadata.lastActivity': -1 });

// Pre-save middleware to update metadata
ChatSchema.pre('save', function(this: IChat, next: () => void) {
  if (!this.metadata) {
    this.metadata = { totalMessages: 0, lastActivity: new Date() };
  }
  this.metadata.totalMessages = this.messages.length;
  this.metadata.lastActivity = new Date();
  
  // Auto-generate title from first user message if still default
  if (this.title === 'New Conversation' && this.messages.length > 0) {
    const firstUserMessage = this.messages.find((msg: IMessage) => msg.role === 'user');
    if (firstUserMessage) {
      // Use first 50 characters of the first user message as title
      this.title = firstUserMessage.content.substring(0, 50) + 
                   (firstUserMessage.content.length > 50 ? '...' : '');
    }
  }
  
  next();
});

// Instance methods
ChatSchema.methods.addMessage = function(role: string, content: string, metadata: Record<string, any> = {}) {
  const message = {
    role,
    content,
    timestamp: new Date(),
    ...metadata
  };
  
  this.messages.push(message);
  return message;
};

ChatSchema.methods.getConversationHistory = function(maxMessages: number = 20) {
  // Return recent messages formatted for OpenAI API
  return this.messages
    .slice(-maxMessages) // Get the most recent messages
    .map((msg: IMessage) => ({
      role: msg.role,
      content: msg.content
    }));
};

ChatSchema.methods.getLastUserMessage = function() {
  // Find the most recent user message
  for (let i = this.messages.length - 1; i >= 0; i--) {
    if (this.messages[i].role === 'user') {
      return this.messages[i];
    }
  }
  return null;
};

// Static methods
ChatSchema.statics.findOrCreateActiveChat = async function(userId: string) {
  // Find the most recent active chat for the user
  let chat = await this.findOne({ 
    userId, 
    isActive: true 
  }).sort({ 'metadata.lastActivity': -1 });
  
  // If no active chat exists, create a new one
  if (!chat) {
    chat = new this({
      userId,
      title: 'New Conversation',
      messages: [],
      isActive: true
    });
    await chat.save();
  }
  
  return chat;
};

ChatSchema.statics.getUserChats = async function(userId: string, limit: number = 10) {
  return this.find({ userId })
    .sort({ 'metadata.lastActivity': -1 })
    .limit(limit)
    .select('title metadata.lastActivity metadata.totalMessages isActive');
};

export default mongoose.model<IChat, IChatModel>('Chat', ChatSchema);
