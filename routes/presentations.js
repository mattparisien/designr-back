const express = require('express');
const router = express.Router();
const presentationController = require('../dist/controllers/presentationController');

// GET all presentations (with optional filtering)
router.get('/', presentationController.getPresentations);

// GET presentation by ID
router.get('/:id', presentationController.getPresentationById);

// POST create new presentation
router.post('/', presentationController.createPresentation);

// PUT update presentation
router.put('/:id', presentationController.updatePresentation);

// DELETE presentation
router.delete('/:id', presentationController.deletePresentation);

// POST clone presentation
router.post('/:id/clone', presentationController.clonePresentation);

module.exports = router;