const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

// Configure the multer middleware for file uploads
const upload = assetController.configureMulter();

// GET all assets (with optional filtering)
router.get('/', assetController.getAssets);

// GET asset by ID
router.get('/:id', assetController.getAssetById);

// POST upload new asset (using multer middleware)
router.post('/upload', upload.single('file'), assetController.uploadAsset);

// PUT update asset metadata
router.put('/:id', assetController.updateAsset);

// DELETE asset
router.delete('/:id', assetController.deleteAsset);

// PATCH move asset to a different folder
router.patch('/:id/move', assetController.moveAsset);

module.exports = router;