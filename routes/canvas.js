const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/canvasController');

// POST export canvas as image with proper aspect ratio
router.post('/export', canvasController.exportCanvas);

// POST generate thumbnail from canvas with proper aspect ratio
router.post('/thumbnail', canvasController.generateThumbnail);

// GET supported export formats
router.get('/export/formats', canvasController.getExportFormats);

module.exports = router;
