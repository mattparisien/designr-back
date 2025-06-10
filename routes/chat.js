const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Health check endpoint (no auth required)
// router.get('/health', chatController.healthCheck);

// Send message endpoint (no auth required to match other routes)
// router.post('/message', chatController.sendMessage);

module.exports = router;
