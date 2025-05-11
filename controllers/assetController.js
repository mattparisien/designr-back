const Asset = require('../models/Asset');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const { storage, getGridFsBucket } = require('../config/db');

// Determine asset type from MIME type
const getAssetTypeFromMime = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.match(/pdf|word|excel|powerpoint|text|rtf|doc|xls|ppt|pages|numbers|keynote/i)) return 'document';
  return 'other';
};

// Get assets (with filtering options)
exports.getAssets = async (req, res) => {
  try {
    const { userId, folderId, type } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const filter = { userId };
    
    // Filter by folder
    if (folderId !== undefined) {
      if (folderId === 'null') {
        filter.folderId = null;
      } else {
        filter.folderId = folderId;
      }
    }
    
    // Filter by type
    if (type) {
      filter.type = type;
    }
    
    const assets = await Asset.find(filter).sort({ createdAt: -1 });
    res.status(200).json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single asset by ID
exports.getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const asset = await Asset.findById(id);
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    res.status(200).json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload an asset (requires multer middleware)
exports.uploadAsset = async (req, res) => {
  try {
    // This function assumes multer has already processed the file
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { userId, folderId, name, tags } = req.body;
    
    if (!userId) {
      // For GridFS, we need to delete the file from GridFS if validation fails
      if (req.file.id) {
        try {
          const gridFsBucket = getGridFsBucket();
          await gridFsBucket.delete(new mongoose.Types.ObjectId(req.file.id));
        } catch (gridfsError) {
          console.error('Error cleaning up GridFS file:', gridfsError);
        }
      }
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Parse the tags if they exist
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        console.warn('Could not parse tags as JSON:', e);
      }
    }
    
    // Determine asset type from MIME type
    const assetType = getAssetTypeFromMime(req.file.mimetype);
    
    // Handle folderId correctly - if it's null, undefined, "null", or empty string, set it to null
    const folderIdValue = folderId && folderId !== "null" && folderId !== "" ? folderId : null;
    
    // Get the API base URL from environment or use a default
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    // Create the asset record
    const newAsset = new Asset({
      name: name || req.file.originalname,
      originalFilename: req.file.originalname,
      userId,
      folderId: folderIdValue,
      type: assetType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      // Now we use the GridFS ID and filename for the URL
      gridFsId: req.file.id,
      url: `${apiBaseUrl}/api/assets/file/${req.file.filename}`,
      tags: parsedTags,
      metadata: {
        // Additional metadata can be added here, like image dimensions
      }
    });
    
    // For image files, create a thumbnail
    if (assetType === 'image') {
      try {
        // Get the GridFS file
        const gridFsBucket = getGridFsBucket();
        const readStream = gridFsBucket.openDownloadStream(new mongoose.Types.ObjectId(req.file.id));
        
        // Create a thumbnail using sharp
        const thumbnailBuffer = await new Promise((resolve, reject) => {
          const chunks = [];
          readStream
            .on('data', chunk => chunks.push(chunk))
            .on('end', () => {
              const buffer = Buffer.concat(chunks);
              sharp(buffer)
                .resize({ width: 200, height: 200, fit: 'inside' })
                .toBuffer()
                .then(resizedBuffer => resolve(resizedBuffer))
                .catch(err => reject(err));
            })
            .on('error', err => reject(err));
        });
        
        // Upload the thumbnail to GridFS
        const thumbnailUploadStream = gridFsBucket.openUploadStream(
          `thumb_${req.file.filename}`,
          { contentType: 'image/jpeg' }
        );
        
        const thumbnailId = thumbnailUploadStream.id;
        
        thumbnailUploadStream.write(thumbnailBuffer);
        thumbnailUploadStream.end();
        
        // Wait for the upload to complete
        await new Promise((resolve, reject) => {
          thumbnailUploadStream.on('finish', resolve);
          thumbnailUploadStream.on('error', reject);
        });
        
        // Set the thumbnail URL
        newAsset.thumbnail = `${apiBaseUrl}/api/assets/file/thumb_${req.file.filename}`;
      } catch (thumbnailError) {
        console.error('Error creating thumbnail:', thumbnailError);
        // Continue without a thumbnail
      }
    }
    
    const savedAsset = await newAsset.save();
    res.status(201).json(savedAsset);
  } catch (error) {
    console.error('Error uploading asset:', error);
    // Clean up GridFS file if it exists
    if (req.file && req.file.id) {
      try {
        const gridFsBucket = getGridFsBucket();
        await gridFsBucket.delete(new mongoose.Types.ObjectId(req.file.id));
      } catch (gridfsError) {
        console.error('Error cleaning up GridFS file after failed upload:', gridfsError);
      }
    }
    res.status(400).json({ message: 'Failed to upload asset', error: error.message });
  }
};

// Update asset metadata
exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow changing certain fields directly
    const restrictedFields = ['url', 'gridFsId', 'userId', 'fileSize', 'mimeType', 'type'];
    restrictedFields.forEach(field => {
      if (updates[field] !== undefined) delete updates[field];
    });
    
    const asset = await Asset.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    res.status(200).json(asset);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(400).json({ message: 'Failed to update asset', error: error.message });
  }
};

// Delete asset
exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    // Delete GridFS file if applicable
    if (asset.gridFsId) {
      try {
        const gridFsBucket = getGridFsBucket();
        await gridFsBucket.delete(new mongoose.Types.ObjectId(asset.gridFsId));
        
        // Also delete the thumbnail if it exists (extract filename from the thumbnail URL)
        if (asset.thumbnail) {
          const thumbnailFilename = asset.thumbnail.split('/').pop();
          // Find the file info to get the ID
          const filesCollection = mongoose.connection.db.collection('uploads.files');
          const fileInfo = await filesCollection.findOne({ filename: thumbnailFilename });
          if (fileInfo && fileInfo._id) {
            await gridFsBucket.delete(fileInfo._id);
          }
        }
      } catch (gfsError) {
        console.warn('Could not delete GridFS file:', gfsError);
        // Continue anyway, as we still want to delete the database record
      }
    }
    
    // Delete the database record
    await Asset.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Move asset to a different folder
exports.moveAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    
    // Handle folderId correctly - if it's null, undefined, "null", or empty string, set it to null
    const folderIdValue = folderId && folderId !== "null" && folderId !== "" ? folderId : null;
    
    // Validate folder if specified (null is valid for root)
    if (folderIdValue) {
      const folderExists = await mongoose.model('Folder').exists({ _id: folderIdValue });
      if (!folderExists) {
        return res.status(404).json({ message: 'Target folder not found' });
      }
    }
    
    const asset = await Asset.findByIdAndUpdate(
      id,
      { folderId: folderIdValue },
      { new: true }
    );
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    res.status(200).json(asset);
  } catch (error) {
    console.error('Error moving asset:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Serve asset file from GridFS
exports.serveAssetFile = async (req, res) => {
  try {
    const gridFsBucket = getGridFsBucket();
    if (!gridFsBucket) {
      return res.status(500).json({ message: 'GridFS not initialized.' });
    }

    const filename = req.params.filename;
    
    // Get width and height from query parameters for resizing (optional)
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
      
      // Set caching headers
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      return readStream.pipe(res);
    }
    
    // Resize needed (for images only) - pipe through Sharp
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
    console.error('Serve Asset File Error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Configure multer for file uploads - now using GridFS storage
exports.configureMulter = () => {
  // File filter function
  const fileFilter = (req, file, cb) => {
    // Accept images, videos, docs and common file types
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|mp4|mov|avi|webm|pdf|doc|docx|xls|xlsx|ppt|pptx/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed!'), false);
    }
  };
  
  // Set up size limits: 20MB for regular uploads
  const limits = {
    fileSize: 20 * 1024 * 1024
  };
  
  // Use the GridFS storage from db.js
  return multer({ 
    storage, 
    fileFilter, 
    limits 
  });
};