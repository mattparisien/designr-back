const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// GET all projects (with optional filtering)
router.get('/', projectController.getProjects);

// GET project by ID
router.get('/:id', projectController.getProjectById);

// POST create new project
router.post('/', projectController.createProject);

// PUT update project
router.put('/:id', projectController.updateProject);

// DELETE project
router.delete('/:id', projectController.deleteProject);

// POST clone project
router.post('/:id/clone', projectController.cloneProject);

module.exports = router;