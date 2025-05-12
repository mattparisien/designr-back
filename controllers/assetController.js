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
const cloudinary = require('../config/cloudinary');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');

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
      // Delete the temp file if validation fails
      if (req.file.path) {
        try {
          await unlinkAsync(req.file.path);
        } catch (err) {
          console.error('Error deleting temp file:', err);
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
    
    // Upload to Cloudinary
    const cloudinaryFolder = `users/${userId}/${assetType}s`;
    const uploadResult = await uploadToCloudinary(req.file.path, cloudinaryFolder);
    
    // Create the asset record
    const newAsset = new Asset({
      name: name || req.file.originalname,
      originalFilename: req.file.originalname,
      userId,
      folderId: folderIdValue,
      type: assetType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      // Use Cloudinary URL for the asset
      cloudinaryId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
      url: uploadResult.secure_url,
      tags: parsedTags,
      metadata: {
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        resource_type: uploadResult.resource_type
      }
    });
    
    // For image files, Cloudinary automatically generates transformations
    if (assetType === 'image') {
      // Create thumbnail URL using Cloudinary's transformation capabilities
      const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
        width: 200,
        height: 200,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      });
      
      newAsset.thumbnail = thumbnailUrl;
    }
    
    const savedAsset = await newAsset.save();
    res.status(201).json(savedAsset);
  } catch (error) {
    console.error('Error uploading asset:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (err) {
        console.error('Error deleting temp file after failed upload:', err);
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
    
    // Delete from Cloudinary if applicable
    if (asset.cloudinaryId) {
      try {
        const resourceType = asset.type === 'image' ? 'image' : 
                            asset.type === 'video' ? 'video' : 'raw';
        await deleteFromCloudinary(asset.cloudinaryId, resourceType);
      } catch (cloudinaryError) {
        console.warn('Could not delete from Cloudinary:', cloudinaryError);
        // Continue anyway, as we still want to delete the database record
      }
    }
    
    // Delete GridFS file if applicable (for backward compatibility)
    if (asset.gridFsId) {
      try {
        const gridFsBucket = getGridFsBucket();
        await gridFsBucket.delete(new mongoose.Types.ObjectId(asset.gridFsId));
        
        // Also delete the thumbnail if it exists
        if (asset.thumbnail && !asset.cloudinaryId) { // Only for old GridFS thumbnails
          const thumbnailFilename = asset.thumbnail.split('/').pop();
          const filesCollection = mongoose.connection.db.collection('uploads.files');
          const fileInfo = await filesCollection.findOne({ filename: thumbnailFilename });
          if (fileInfo && fileInfo._id) {
            await gridFsBucket.delete(fileInfo._id);
          }
        }
      } catch (gfsError) {
        console.warn('Could not delete GridFS file:', gfsError);
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

// Configure multer for file uploads - using local disk storage temporarily before Cloudinary upload
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
  
  // Use disk storage for temporary file storage before uploading to Cloudinary
  const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const tempDir = path.join(__dirname, '../temp-uploads');
      // Ensure the directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: function (req, file, cb) {
      // Generate unique filename
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  
  return multer({ 
    storage: diskStorage, 
    fileFilter, 
    limits 
  });
};