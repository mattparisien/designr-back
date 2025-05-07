const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload'); // Multer middleware for file uploads

// GET /api/users/profile - Get current user's profile
router.get('/profile', authMiddleware, userController.getUserProfile);

// PUT /api/users/profile - Update current user's profile data (name, bio, etc.)
router.put('/profile', authMiddleware, userController.updateUserProfileData);

// POST /api/users/profile/picture - Upload/update profile picture
router.post(
  '/profile/picture',
  authMiddleware,
  uploadMiddleware.single('profilePicture'), // 'profilePicture' is the field name in the form-data
  userController.uploadProfilePicture
);

// GET /api/users/picture/:filename - Serve a profile picture by filename
router.get('/picture/:filename', userController.serveProfilePicture);

// GET /api/users/picture/id/:id - Serve a profile picture by GridFS ID (optional)
router.get('/picture/id/:id', userController.serveProfilePictureById);

module.exports = router;
