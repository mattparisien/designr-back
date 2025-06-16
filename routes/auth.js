// import express from 'express';
// import authController from '../controllers/authController.js';
// import authMiddleware from '../middleware/auth.js';

// const router = express.Router();

// // POST /api/auth/register - Register a new user
// router.post('/register', authController.register);

// // POST /api/auth/login - Login a user
// router.post('/login', authController.login);

// // GET /api/auth/me - Get current user (protected route)
// router.get('/me', authMiddleware, authController.getCurrentUser);

// // GET /api/auth/verify - Verify token is valid
// router.get('/verify', authMiddleware, authController.verifyToken);

// // POST /api/auth/logout - Logout a user
// router.post('/logout', authMiddleware, authController.logout);

// // POST /api/auth/forgot-password - Request password reset
// router.post('/forgot-password', authController.forgotPassword);

// // POST /api/auth/reset-password/:token - Reset password with token
// router.post('/reset-password/:token', authController.resetPassword);

// // PUT /api/auth/update-profile - Update user profile (protected route)
// router.put('/update-profile', authMiddleware, authController.updateProfile);

// // Google OAuth routes
// router.get('/google', authController.googleAuth);
// router.get('/google/callback', authController.googleCallback);

// export default router;