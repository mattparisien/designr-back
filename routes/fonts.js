const express = require('express');
const router = express.Router();
const fontController = require('../controllers/fontController');
const assetController = require('../controllers/assetController');

// Configure the multer middleware for font uploads using the existing asset controller config
const upload = assetController.configureMulter();

// POST upload new font
router.post('/upload', upload.single('file'), fontController.uploadFont);

// GET all custom fonts for a user
router.get('/', fontController.getUserFonts);

// DELETE font by ID
router.delete('/:id', fontController.deleteFont);

module.exports = router;
