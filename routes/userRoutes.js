import express from 'express';
import userController from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';
import uploadMiddleware from '../middleware/upload.js'; // Multer middleware for file uploads

const router = express.Router();

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

export default router;
