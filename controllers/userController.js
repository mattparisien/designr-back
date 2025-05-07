const User = require('../models/User');
const { getGridFsBucket } = require('../config/db'); // To access GridFS bucket
const mongoose = require('mongoose');
const sharp = require('sharp'); // Add Sharp for image resizing
const stream = require('stream');

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Construct profile picture URL if it exists
    let profilePictureUrl = user.profilePictureUrl; // This might already be the full URL if stored directly
    
    // If we only stored a filename or ID and need to construct a full path:
    if (user.profilePictureGridFsId && !profilePictureUrl) {
        // Assuming you have a route like /api/users/picture/:filename
        // And user.profilePictureFileName holds the name of the file in GridFS
        // This part depends on how you decide to store/retrieve the URL.
        // For now, let's assume profilePictureUrl is correctly populated or will be.
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      company: user.company,
      location: user.location,
      bio: user.bio,
      joinedAt: user.createdAt, // Assuming joinedAt is createdAt
      profilePictureUrl: user.profilePictureUrl, // Send the direct URL
    });
  } catch (error) {
    console.error('Get User Profile Error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// Update user profile data (non-sensitive)
exports.updateUserProfileData = async (req, res) => {
  try {
    const { name, company, location, bio } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (company !== undefined) user.company = company;
    if (location !== undefined) user.location = location;
    if (bio !== undefined) user.bio = bio;
    
    // Add other fields like company, location, bio to user schema if they don't exist
    // For now, assuming they exist or will be added to the schema:
    // user.company = company || user.company;
    // user.location = location || user.location;
    // user.bio = bio || user.bio;


    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        location: user.location,
        bio: user.bio,
        profilePictureUrl: user.profilePictureUrl,
        joinedAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Update User Profile Error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// Upload or update profile picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // If there was an old picture, delete it from GridFS
    if (user.profilePictureGridFsId) {
      try {
        const gridFsBucket = getGridFsBucket();
        // Ensure profilePictureGridFsId is a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(user.profilePictureGridFsId)) {
          await gridFsBucket.delete(new mongoose.Types.ObjectId(user.profilePictureGridFsId));
        } else {
          console.warn(`Invalid GridFS ID for deletion: ${user.profilePictureGridFsId}`);
        }
      } catch (gridfsError) {
        // Log error but don't fail the whole upload if deletion fails
        console.error('Error deleting old profile picture from GridFS:', gridfsError);
      }
    }
    
    // Get the API base URL from environment or use a default
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    // The file is uploaded by multer-gridfs-storage. req.file contains info about the uploaded file.
    // req.file.id is the GridFS ID, and req.file.filename is the name in the 'uploads.files' collection.
    user.profilePictureGridFsId = req.file.id; 
    user.profilePictureUrl = `${apiBaseUrl}/api/users/picture/${req.file.filename}`; 

    await user.save();

    res.status(200).json({
      message: 'Profile picture updated successfully.',
      profilePictureUrl: user.profilePictureUrl,
      fileInfo: req.file // Send back file info for debugging or client use
    });

  } catch (error) {
    console.error('Upload Profile Picture Error:', error);
    // If an error occurs and a file was uploaded, try to delete it to avoid orphaned files
    if (req.file && req.file.id) {
        try {
            const gridFsBucket = getGridFsBucket();
            await gridFsBucket.delete(new mongoose.Types.ObjectId(req.file.id));
            console.log(`Cleaned up orphaned file: ${req.file.filename}`);
        } catch (cleanupError) {
            console.error('Error cleaning up orphaned file:', cleanupError);
        }
    }
    res.status(500).json({ message: 'Server error while uploading profile picture.' });
  }
};

// Serve profile picture from GridFS
exports.serveProfilePicture = async (req, res) => {
  try {
    const gridFsBucket = getGridFsBucket();
    if (!gridFsBucket) {
        return res.status(500).json({ message: 'GridFS not initialized.' });
    }

    const filename = req.params.filename;
    
    // Get width and height from query parameters
    const width = req.query.width ? parseInt(req.query.width) : null;
    const height = req.query.height ? parseInt(req.query.height) : null;
    
    // If no resize needed, stream directly
    if (!width && !height) {
      const readStream = gridFsBucket.openDownloadStreamByName(filename);
      
      readStream.on('error', (error) => {
        console.error(`Error streaming file ${filename}:`, error);
        if (error.code === 'ENOENT' || (error.message && error.message.startsWith('FileNotFound'))) {
          return res.status(404).json({ message: 'File not found.' });
        }
        return res.status(500).json({ message: 'Error streaming file.' });
      });
      
      // Find the file info to get content type
      const filesCollection = mongoose.connection.db.collection('uploads.files');
      const fileInfo = await filesCollection.findOne({ filename });
      
      if (fileInfo && fileInfo.contentType) {
        res.set('Content-Type', fileInfo.contentType);
      }
      
      return readStream.pipe(res);
    }
    
    // Resize needed - pipe through Sharp
    try {
      const readStream = gridFsBucket.openDownloadStreamByName(filename);
      
      // Create a transform stream with Sharp
      const transformer = sharp();
      
      // Configure resizing based on provided parameters
      if (width && height) {
        transformer.resize(width, height, { fit: 'cover' });
      } else if (width) {
        transformer.resize(width, null, { fit: 'inside' });
      } else if (height) {
        transformer.resize(null, height, { fit: 'inside' });
      }
      
      // Set appropriate content type for the resized image
      res.set('Content-Type', 'image/jpeg'); // Default to JPEG for resized images
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Handle errors
      readStream.on('error', (error) => {
        console.error(`Error reading file ${filename} for resizing:`, error);
        if (error.code === 'ENOENT' || (error.message && error.message.startsWith('FileNotFound'))) {
          return res.status(404).json({ message: 'File not found.' });
        }
        return res.status(500).json({ message: 'Error streaming file.' });
      });
      
      // Pipe the file through Sharp and then to response
      readStream.pipe(transformer).pipe(res);
      
    } catch (resizeError) {
      console.error('Error during image resizing:', resizeError);
      return res.status(500).json({ message: 'Error resizing image.' });
    }
  } catch (error) {
    console.error('Serve Profile Picture Error:', error);
    res.status(500).json({ message: 'Server error while serving profile picture.' });
  }
};

// Optional: Get profile picture by ID (if you prefer using IDs in URLs)
exports.serveProfilePictureById = async (req, res) => {
  try {
    const gridFsBucket = getGridFsBucket();
    if (!gridFsBucket) {
      return res.status(500).json({ message: 'GridFS not initialized.' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
    }
    
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Get width and height from query parameters
    const width = req.query.width ? parseInt(req.query.width) : null;
    const height = req.query.height ? parseInt(req.query.height) : null;
    
    // If no resize needed, stream directly
    if (!width && !height) {
      const readStream = gridFsBucket.openDownloadStream(fileId);
      
      readStream.on('error', (error) => {
        console.error(`Error streaming file ID ${fileId}:`, error);
        if (error.code === 'ENOENT' || (error.message && error.message.startsWith('FileNotFound'))) {
          return res.status(404).json({ message: 'File not found.' });
        }
        return res.status(500).json({ message: 'Error streaming file.' });
      });
      
      // Find the file info to get content type
      const filesCollection = mongoose.connection.db.collection('uploads.files');
      const fileInfo = await filesCollection.findOne({ _id: fileId });
      
      if (fileInfo && fileInfo.contentType) {
        res.set('Content-Type', fileInfo.contentType);
      }
      
      return readStream.pipe(res);
    }
    
    // Resize needed - pipe through Sharp
    try {
      const readStream = gridFsBucket.openDownloadStream(fileId);
      
      // Create a transform stream with Sharp
      const transformer = sharp();
      
      // Configure resizing based on provided parameters
      if (width && height) {
        transformer.resize(width, height, { fit: 'cover' });
      } else if (width) {
        transformer.resize(width, null, { fit: 'inside' });
      } else if (height) {
        transformer.resize(null, height, { fit: 'inside' });
      }
      
      // Set appropriate content type for the resized image
      res.set('Content-Type', 'image/jpeg'); // Default to JPEG for resized images
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Handle errors
      readStream.on('error', (error) => {
        console.error(`Error reading file ${fileId} for resizing:`, error);
        if (error.code === 'ENOENT' || (error.message && error.message.startsWith('FileNotFound'))) {
          return res.status(404).json({ message: 'File not found.' });
        }
        return res.status(500).json({ message: 'Error streaming file.' });
      });
      
      // Pipe the file through Sharp and then to response
      readStream.pipe(transformer).pipe(res);
      
    } catch (resizeError) {
      console.error('Error during image resizing:', resizeError);
      return res.status(500).json({ message: 'Error resizing image.' });
    }
  } catch (error) {
    console.error('Serve Profile Picture By ID Error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
