import express from 'express';
import * as presentationController from '../dist/controllers/presentationController.js';

const router = express.Router();

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

export default router;