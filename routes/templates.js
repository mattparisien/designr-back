const express = require('express');
const router = express.Router();
const templateController = require('../dist/controllers/templateController');

// GET all templates (with optional filtering)
router.get('/', templateController.getTemplates);

// GET template by ID
router.get('/:id', templateController.getTemplateById);

// GET featured templates
router.get('/featured/all', templateController.getFeaturedTemplates);

// GET popular templates
router.get('/popular/all', templateController.getPopularTemplates);

// GET templates by category
router.get('/category/:category', templateController.getTemplatesByCategory);

// POST create new template
router.post('/', templateController.createTemplate);

// POST create project from template
router.post('/:id/use', templateController.useTemplate);

// POST create template from existing project
router.post('/from-project/:projectId', templateController.createTemplateFromProject);

// PUT update template
router.put('/:id', templateController.updateTemplate);

// DELETE template
router.delete('/:id', templateController.deleteTemplate);

module.exports = router;