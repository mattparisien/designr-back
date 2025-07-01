const dotenv = require('dotenv');

// Load environment variables from .env file FIRST
// This must come before any imports that might use environment variables
dotenv.config();

// Register ts-node to handle TypeScript imports
require('ts-node/register');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Now require modules that need environment variables
const { connectDB } = require('./config/db'); // Import connectDB from db.js
const authController = require('./controllers/authController');
const vectorStoreService = require('./services/vectorStore');
const templateVectorService = require('./services/templateVectorService');
const vectorJobProcessor = require('./services/vectorJobProcessor');
const imageAnalysisService = require('./services/imageAnalysisService');
const imageVectorService = require('./services/imageVectorService');

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
const projectRoutes = require('./routes/projects');
const authRoutes = require('./routes/auth');
const presentationRoutes = require('./routes/presentations');
const userRoutes = require('./routes/userRoutes'); // Import user routes
const folderRoutes = require('./routes/folders');
const assetRoutes = require('./routes/assets');
const templateRoutes = require('./routes/templates'); // Import template routes
const brandRoutes = require('./routes/brands'); // Import brand routes
const agentRoutes = require('./routes/agent'); // Import agent routes
const canvasRoutes = require('./routes/canvas'); // Import canvas routes
const fontRoutes = require('./routes/fonts'); // Import font routes
const ocrRoutes = require('./routes/ocr'); // Import OCR routes

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/presentations', presentationRoutes);
app.use('/api/users', userRoutes); // Use user routes
app.use('/api/folders', folderRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/templates', templateRoutes); // Use template routes
app.use('/api/brands', brandRoutes); // Use brand routes
app.use('/api/agent', agentRoutes); // Use agent routes
app.use('/api/canvas', canvasRoutes); // Use canvas routes
app.use('/api/fonts', fontRoutes); // Use font routes
app.use('/api/ocr', ocrRoutes); // Use OCR routes

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
    
    // Initialize template vector service
    try {
      await templateVectorService.initialize();
      console.log('Template vector service initialized');
    } catch (error) {
      console.warn('Template vector service initialization failed:', error.message);
      console.warn('Template vector search will be disabled');
    }
    
    // Initialize Passport for Google OAuth
    authController.initializePassport(app);
    
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