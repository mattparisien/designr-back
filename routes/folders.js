const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');

// GET all folders (with optional filtering)
router.get('/', folderController.getFolders);

// GET all folders for a user
router.get('/user/:userId', folderController.getFolders);

// GET folder by ID
router.get('/:id', folderController.getFolder);

// GET folder by slug
router.get('/slug/:slug', folderController.getFolderBySlug);

// POST create new folder
router.post('/', folderController.createFolder);

// PUT update folder
router.put('/:id', folderController.updateFolder);

// DELETE folder
router.delete('/:id', folderController.deleteFolder);

// PATCH move folder to a new parent
router.patch('/:id/move', folderController.moveFolder);

module.exports = router;