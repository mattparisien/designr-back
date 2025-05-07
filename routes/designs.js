const express = require('express');
const router = express.Router();
const designController = require('../controllers/designController');

// GET all designs (with optional filtering)
router.get('/', designController.getDesigns);

// GET design by ID
router.get('/:id', designController.getDesignById);

// POST create new design
router.post('/', designController.createDesign);

// PUT update design
router.put('/:id', designController.updateDesign);

// DELETE design
router.delete('/:id', designController.deleteDesign);

// POST clone design
router.post('/:id/clone', designController.cloneDesign);

module.exports = router;