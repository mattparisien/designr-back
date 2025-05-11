const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const auth = require('../middleware/auth');

// GET all folders (with optional filtering)
router.get('/', folderController.getFolders);

// GET all folders for a user
router.get('/user/:userId', auth, folderController.getFolders);

// GET folder by ID
router.get('/:id', auth, folderController.getFolder);

// GET folder by slug
router.get('/slug/:slug', auth, folderController.getFolderBySlug);

// POST create new folder
router.post('/', auth, folderController.createFolder);

// PUT update folder
router.put('/:id', auth, folderController.updateFolder);

// DELETE folder
router.delete('/:id', auth, folderController.deleteFolder);

// PATCH move folder to a new parent
router.patch('/:id/move', folderController.moveFolder);

module.exports = router;