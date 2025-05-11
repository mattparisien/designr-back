const dotenv = require('dotenv');

// Load environment variables from .env file FIRST
// This must come before any imports that might use environment variables
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Now require modules that need environment variables
const { connectDB } = require('./config/db'); // Import connectDB from db.js
const authController = require('./controllers/authController');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for large design data
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const designRoutes = require('./routes/designs');
const authRoutes = require('./routes/auth');
const presentationRoutes = require('./routes/presentations');
const userRoutes = require('./routes/userRoutes'); // Import user routes
const folderRoutes = require('./routes/folders');
const assetRoutes = require('./routes/assets');

// Routes
app.use('/api/designs', designRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/presentations', presentationRoutes);
app.use('/api/users', userRoutes); // Use user routes
app.use('/api/folders', folderRoutes);
app.use('/api/assets', assetRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Canva Clone API is running');
});


// Connect to MongoDB and initialize GridFS
connectDB() // Use connectDB from db.js
  .then(() => {
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