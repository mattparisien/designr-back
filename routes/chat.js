import express from 'express';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

// Health check endpoint (no auth required)
router.get('/health', chatController.healthCheck);

// Send message endpoint (no auth required to match other routes)
router.post('/message', chatController.sendMessage);

// Get user's chat conversations
router.get('/user/:userId', chatController.getUserChats);

// Get specific chat conversation
router.get('/:chatId', chatController.getChatById);

// Create new chat conversation
router.post('/new', chatController.createNewChat);

// Update chat title
router.patch('/:chatId/title', chatController.updateChatTitle);

// Delete chat conversation
router.delete('/:chatId', chatController.deleteChat);

export default router;
