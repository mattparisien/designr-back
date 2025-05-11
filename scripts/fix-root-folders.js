const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

// Import models after environment variables are loaded
const User = require('../models/User');
const Folder = require('../models/Folder');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/canva-clone', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Ensure root folder exists for a user
const ensureRootFolder = async (userId) => {
  try {
    // Check if root folder exists
    let rootFolder = await Folder.findOne({ 
      userId, 
      name: 'Root', 
      parentId: null 
    });
    
    if (rootFolder) {
      // Update existing root folder if needed
      if (!rootFolder.path || rootFolder.path !== '/root') {
        rootFolder.path = '/root';
        if (!rootFolder.slug) {
          rootFolder.slug = 'root';
        }
        await rootFolder.save();
        console.log(`Updated root folder for user ${userId}`);
      } else {
        console.log(`Root folder already correct for user ${userId}`);
      }
      return rootFolder;
    } else {
      // Create root folder if it doesn't exist
      const newRootFolder = new Folder({
        name: 'Root',
        slug: 'root',
        userId,
        parentId: null,
        path: '/root',
        isShared: false
      });
      
      await newRootFolder.save();
      console.log(`Created new root folder for user ${userId}`);
      return newRootFolder;
    }
  } catch (error) {
    console.error(`Error ensuring root folder exists for user ${userId}:`, error);
    throw error;
  }
};

// Fix root folders for all users
const fixRootFolders = async () => {
  try {
    console.log('Starting root folder check and repair process...');
    // Get all users
    const users = await User.find({}, '_id');
    console.log(`Found ${users.length} users to process`);
    
    // Create/update root folder for each user
    for (const user of users) {
      await ensureRootFolder(user._id);
    }
    
    console.log('✅ Root folder check and repair completed successfully');
  } catch (error) {
    console.error('❌ Error fixing root folders:', error);
    process.exit(1);
  }
};

// Run the script
(async () => {
  await connectDB();
  await fixRootFolders();
  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
})();