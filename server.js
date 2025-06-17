import dotenv from 'dotenv';

// Load environment variables from .env file FIRST
// This must come before any imports that might use environment variables
dotenv.config();

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Now import modules that need environment variables
import { connectDB } from './config/db.js'; // Import connectDB from db.js
// import authController from './controllers/authController.js';
import imageAnalysisService from './services/imageAnalysisService.js';
import imageVectorService from './services/imageVectorService.js';
// Temporarily comment out PDF service to debug startup issue
// import pdfProcessingService from './services/pdfProcessingService.js';
import vectorStoreService from './services/vectorStore.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for large project data
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
import projectRoutes from './routes/projects.js'; // Import project routes
// import authRoutes from './routes/auth.js';
// import presentationRoutes from './routes/presentations.js';
// import userRoutes from './routes/userRoutes.js'; // Import user routes
import assetRoutes from './routes/assets.js';
import brandRoutes from './routes/brands.js'; // Import brand routes
import chatRoutes from './routes/chat.js'; // Import chat routes
// import folderRoutes from './routes/folders.js';
import templateRoutes from './routes/templates.js'; // Import template routes

// Routes
app.use('/api/projects', projectRoutes); // Use project routes
// app.use('/api/auth', authRoutes);
// app.use('/api/presentations', presentationRoutes);
// app.use('/api/users', userRoutes); // Use user routes
// app.use('/api/folders', folderRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/templates', templateRoutes); // Use template routes
app.use('/api/brands', brandRoutes); // Use brand routes
app.use('/api/chat', chatRoutes); // Use chat routes

// Base route
app.get('/', (req, res) => {
  res.send('Canva Clone API is running');
});

// Connect to MongoDB and initialize GridFS
connectDB() // Use connectDB from db.js
  .then(async () => {
    // Initialize vector services
    try {
      await vectorStoreService.initialize();
      console.log('Vector store service initialized');
    } catch (error) {
      console.warn('Vector store service initialization failed:', error.message);
      console.warn('Vector search features will be disabled');
    }

    // Initialize image analysis service
    try {
      await imageAnalysisService.initialize();
      console.log('Image analysis service initialized');
    } catch (error) {
      console.warn('Image analysis service initialization failed:', error.message);
      console.warn('Image semantic analysis will be disabled');
    }

    // Initialize image vector service (hybrid approach)
    try {
      await imageVectorService.initialize();
      console.log('Image vector service initialized with hybrid approach');
    } catch (error) {
      console.warn('Image vector service initialization failed:', error.message);
      console.warn('Visual-focused vector generation will be disabled, falling back to text-only');
    }

    // Initialize PDF processing service (temporarily disabled for debugging)
    // try {
    //   await pdfProcessingService.initialize();
    //   console.log('PDF processing service initialized');
    // } catch (error) {
    //   console.warn('PDF processing service initialization failed:', error.message);
    //   console.warn('PDF content extraction will be disabled');
    // }

    // Initialize Passport for Google OAuth (temporarily disabled)
    // authController.initializePassport(app);

    // Start the server after successful DB connection
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});