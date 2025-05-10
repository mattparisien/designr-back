const Asset = require('../models/Asset');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const multer = require('multer');
const crypto = require('crypto');

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
      // Clean up the uploaded file since we're not going to use it
      await unlinkAsync(req.file.path);
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
    
    // Create the asset record
    const newAsset = new Asset({
      name: name || req.file.originalname,
      originalFilename: req.file.originalname,
      userId,
      folderId: folderId || null,
      type: assetType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      url: `/uploads/${req.file.filename}`, // Adjust based on your storage setup
      tags: parsedTags,
      metadata: {
        // Additional metadata can be added here, like image dimensions
      }
    });
    
    const savedAsset = await newAsset.save();
    res.status(201).json(savedAsset);
  } catch (error) {
    console.error('Error uploading asset:', error);
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file after failed upload:', unlinkError);
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
    
    // Delete the actual file
    if (asset.url && asset.url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', 'public', asset.url);
      try {
        await unlinkAsync(filePath);
      } catch (unlinkError) {
        console.warn('Could not delete file:', unlinkError);
        // Continue anyway, as we still want to delete the database record
      }
    }
    
    // Delete GridFS file if applicable
    if (asset.gridFsId) {
      try {
        const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
        await gfs.delete(asset.gridFsId);
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
    
    // Validate folder if specified (null is valid for root)
    if (folderId) {
      const folderExists = await mongoose.model('Folder').exists({ _id: folderId });
      if (!folderExists) {
        return res.status(404).json({ message: 'Target folder not found' });
      }
    }
    
    const asset = await Asset.findByIdAndUpdate(
      id,
      { folderId: folderId || null },
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

// Configure multer for file uploads
exports.configureMulter = () => {
  // Set up storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate a unique filename with original extension
      const uniquePrefix = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(file.originalname);
      cb(null, `${uniquePrefix}${extension}`);
    }
  });
  
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
  
  return multer({ storage, fileFilter, limits });
};