const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');

// Health check endpoint (no auth required)
router.get('/health', chatController.healthCheck);

// Send message endpoint (requires authentication)
router.post('/message', authMiddleware, chatController.sendMessage);

module.exports = router;
