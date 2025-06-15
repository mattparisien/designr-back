import express from 'express';
import assetController from '../controllers/assetController.js';

const router = express.Router();

// Configure the multer middleware for file uploads
const upload = assetController.configureMulter();

// GET all assets (with optional filtering)
router.get('/', assetController.getAssets);

// GET vector search assets by semantic similarity
router.get('/search/vector', assetController.searchAssetsByVector);

// GET search document chunks by content
router.get('/search/documents', assetController.searchDocumentChunks);

// GET hybrid search (assets + document chunks)
router.get('/search/hybrid', assetController.hybridSearch);

// GET document chunks for a specific asset
router.get('/:id/chunks', assetController.getDocumentChunks);

// GET document summary for a specific asset
router.get('/:id/summary', assetController.getDocumentSummary);

// GET vector store statistics
router.get('/vector/stats', assetController.getVectorStats);

// POST process pending vectorization jobs
router.post('/vector/process', assetController.processVectorJobs);

// POST force re-vectorization of all assets
router.post('/vector/revectorize', assetController.reVectorizeAssets);

// POST analyze single asset with AI
router.post('/:id/analyze', assetController.analyzeAsset);

// POST batch analyze multiple assets with AI
router.post('/analyze/batch', assetController.batchAnalyzeAssets);

// GET file by filename (serve from GridFS)
router.get('/file/:filename', assetController.serveAssetFile);

// GET similar assets to a given asset
router.get('/:id/similar', assetController.findSimilarAssets);

// GET asset by ID
router.get('/:id', assetController.getAssetById);

// POST upload new asset (using multer middleware)
router.post('/upload', upload.single('file'), assetController.uploadAsset);

// PUT update asset metadata
router.put('/:id', assetController.updateAsset);

// DELETE asset
router.delete('/:id', assetController.deleteAsset);

// DELETE multiple assets
router.delete('/bulk/delete', assetController.deleteMultipleAssets);

// DELETE all assets for a user (requires confirmation)
router.delete('/all/delete', assetController.deleteAllAssets);

// PATCH move asset to a different folder
router.patch('/:id/move', assetController.moveAsset);

export default router;