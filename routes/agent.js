const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController.ts');

router.post('/ask', agentController.ask);

module.exports = router;
