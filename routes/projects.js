const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController.ts');

// GET all projects (with optional filtering)
router.get('/', projectController.getProjects);

// GET projects with pagination
router.get('/paginated', projectController.getPaginatedProjects);

router.get('/presets', projectController.getProjectPresets);

// GET all templates
router.get('/templates', projectController.getTemplates);

// GET vector search templates
router.get('/templates/search', projectController.searchTemplates);

// GET hybrid search templates  
router.get('/templates/hybrid-search', projectController.hybridSearchTemplates);

// GET similar templates
router.get('/:id/similar', projectController.getSimilarTemplates);

// GET project by ID
router.get('/:id', projectController.getProjectById);

// POST create new project
router.post('/', projectController.createProject);

// PUT update project
router.put('/:id', projectController.updateProject);

// PUT toggle project template status
router.put('/:id/toggle-template', projectController.toggleTemplate);

// DELETE project
router.delete('/:id', projectController.deleteProject);

// POST clone project
router.post('/:id/clone', projectController.cloneProject);

module.exports = router;