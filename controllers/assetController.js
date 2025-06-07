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
const vectorStoreService = require('../services/vectorStore');
const vectorJobProcessor = require('../services/vectorJobProcessor');

// Determine asset type from MIME type or file extension
const getAssetTypeFromMime = (mimeType, filename = '') => {
  // First try to determine from MIME type
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.match(/pdf|word|excel|powerpoint|text|rtf|doc|xls|ppt|pages|numbers|keynote/i)) return 'document';
  
  // If MIME type is generic (like application/octet-stream), check file extension
  if (mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream') {
    const ext = filename.toLowerCase();
    if (ext.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (ext.match(/\.(mp4|mov|avi|webm)$/)) return 'video';
    if (ext.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
    if (ext.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/)) return 'document';
  }
  
  return 'other';
};

// Calculate file hash for duplicate detection
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

// Get assets (with filtering options)
exports.getAssets = async (req, res) => {
  try {
    const { userId, folderId, type } = req.query;
    
    // Use default user if no userId provided (since auth is disabled)
    const effectiveUserId = userId || 'default-user';
    
    const filter = { userId: effectiveUserId };
    
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
    
    // Use a default userId if none provided (since auth is disabled)
    const effectiveUserId = userId || 'default-user';
    
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
    const assetType = getAssetTypeFromMime(req.file.mimetype, req.file.originalname);
    
    console.log('Processing file upload:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      detectedType: assetType,
      userId: effectiveUserId
    });
    
    // Correct the MIME type if it's generic but we detected the actual type from extension
    let correctedMimeType = req.file.mimetype;
    if (req.file.mimetype === 'application/octet-stream' || req.file.mimetype === 'binary/octet-stream') {
      const ext = req.file.originalname.toLowerCase();
      if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
        correctedMimeType = 'image/jpeg';
      } else if (ext.endsWith('.png')) {
        correctedMimeType = 'image/png';
      } else if (ext.endsWith('.gif')) {
        correctedMimeType = 'image/gif';
      } else if (ext.endsWith('.webp')) {
        correctedMimeType = 'image/webp';
      } else if (ext.endsWith('.svg')) {
        correctedMimeType = 'image/svg+xml';
      }
      
      if (correctedMimeType !== req.file.mimetype) {
        console.log(`Corrected MIME type from ${req.file.mimetype} to ${correctedMimeType} based on extension`);
      }
    }
    
    // Handle folderId correctly - if it's null, undefined, "null", or empty string, set it to null
    const folderIdValue = folderId && folderId !== "null" && folderId !== "" ? folderId : null;
    
    // Check for duplicate filename in the same folder for the same user
    const assetName = name || req.file.originalname;
    const existingAsset = await Asset.findOne({
      userId: effectiveUserId,
      folderId: folderIdValue,
      name: assetName
    });
    
    if (existingAsset) {
      // Clean up temp file
      await unlinkAsync(req.file.path);
      return res.status(409).json({ 
        message: 'A file with this name already exists in this location',
        conflict: 'filename',
        existingAsset: {
          id: existingAsset._id,
          name: existingAsset.name,
          createdAt: existingAsset.createdAt
        }
      });
    }
    
    // Calculate file hash for content-based duplicate detection
    const fileHash = await calculateFileHash(req.file.path);
    const existingHashAsset = await Asset.findOne({
      userId: effectiveUserId,
      'metadata.fileHash': fileHash
    });
    
    if (existingHashAsset) {
      // Clean up temp file
      await unlinkAsync(req.file.path);
      return res.status(409).json({ 
        message: 'This file content already exists in your assets',
        conflict: 'content',
        existingAsset: {
          id: existingHashAsset._id,
          name: existingHashAsset.name,
          url: existingHashAsset.url,
          createdAt: existingHashAsset.createdAt
        }
      });
    }
    
    // Upload to Cloudinary
    const cloudinaryFolder = `users/${effectiveUserId}/${assetType}s`;
    const uploadResult = await uploadToCloudinary(req.file.path, cloudinaryFolder);
    
    // Create the asset record
    const newAsset = new Asset({
      name: name || req.file.originalname,
      originalFilename: req.file.originalname,
      userId: effectiveUserId,
      folderId: folderIdValue,
      type: assetType,
      mimeType: correctedMimeType,
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
    
    // Queue asset for vectorization in background
    try {
      await vectorJobProcessor.queueVectorization(savedAsset._id, effectiveUserId);
    } catch (vectorError) {
      console.warn('Failed to queue asset for vectorization:', vectorError);
      // Don't fail the upload, just log the warning
    }
    
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

    // Re-queue asset for vectorization if metadata was updated
    if (updates.name || updates.tags) {
      try {
        await vectorJobProcessor.queueVectorization(asset._id, asset.userId, 'medium');
      } catch (vectorError) {
        console.warn('Failed to queue asset for re-vectorization:', vectorError);
      }
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
    
    // Delete from vector store if vectorized
    if (asset.vectorized) {
      try {
        await vectorStoreService.deleteVector(asset._id.toString(), asset.userId);
      } catch (vectorError) {
        console.warn('Could not delete from vector store:', vectorError);
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

// Configure multer for file uploads - using local disk storage temporarily before Cloudinary upload
exports.configureMulter = () => {
  // File filter function
  const fileFilter = (req, file, cb) => {
    console.log('File upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    // Define allowed file extensions
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|svg|mp4|mov|avi|webm|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;
    
    // Define allowed MIME types (including common generic ones)
    const allowedMimeTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Videos
      'video/mp4', 'video/quicktime', 'video/avi', 'video/webm',
      // Documents
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Generic types that browsers sometimes send
      'application/octet-stream', 'binary/octet-stream'
    ];
    
    const filename = file.originalname.toLowerCase();
    const hasValidExtension = allowedExtensions.test(filename);
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype.toLowerCase());
    
    // Allow file if it has a valid extension, regardless of MIME type
    // This handles cases where browsers send application/octet-stream for images
    if (hasValidExtension) {
      console.log('File accepted based on extension:', filename);
      return cb(null, true);
    }
    
    // Also allow if MIME type is explicitly valid (for properly detected files)
    if (hasValidMimeType && !file.mimetype.includes('octet-stream')) {
      console.log('File accepted based on MIME type:', file.mimetype);
      return cb(null, true);
    }
    
    console.log('File rejected:', {
      filename,
      mimetype: file.mimetype,
      hasValidExtension,
      hasValidMimeType
    });
    
    cb(new Error(`File type not allowed! Received: ${file.mimetype} for file: ${file.originalname}`), false);
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

// Vector search assets by semantic similarity
exports.searchAssetsByVector = async (req, res) => {
  try {
    const { query, userId, limit = 10, threshold = 0.7 } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Use default user if no userId provided
    const effectiveUserId = userId || 'default-user';
    
    const results = await vectorStoreService.searchSimilarAssets(
      query, 
      effectiveUserId, 
      parseInt(limit), 
      parseFloat(threshold)
    );
    
    // Get full asset details for the results
    const assetIds = results.map(r => r.assetId);
    const assets = await Asset.find({ 
      _id: { $in: assetIds },
      userId: effectiveUserId 
    });
    
    // Merge similarity scores with asset data
    const enrichedResults = assets.map(asset => {
      const result = results.find(r => r.assetId === asset._id.toString());
      return {
        ...asset.toObject(),
        similarity: result?.similarity || 0
      };
    });
    
    // Sort by similarity score
    enrichedResults.sort((a, b) => b.similarity - a.similarity);
    
    res.status(200).json({
      query,
      results: enrichedResults,
      total: enrichedResults.length
    });
  } catch (error) {
    console.error('Error in vector search:', error);
    res.status(500).json({ message: 'Vector search failed', error: error.message });
  }
};

// Find similar assets to a given asset
exports.findSimilarAssets = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5, threshold = 0.8 } = req.query;
    
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    if (!asset.vectorized) {
      return res.status(400).json({ message: 'Asset has not been vectorized yet' });
    }
    
    const results = await vectorStoreService.findSimilarAssets(
      id, 
      asset.userId, 
      parseInt(limit), 
      parseFloat(threshold)
    );
    
    // Get full asset details for the results
    const assetIds = results.map(r => r.assetId);
    const similarAssets = await Asset.find({ 
      _id: { $in: assetIds, $ne: id }, // Exclude the original asset
      userId: asset.userId 
    });
    
    // Merge similarity scores with asset data
    const enrichedResults = similarAssets.map(similarAsset => {
      const result = results.find(r => r.assetId === similarAsset._id.toString());
      return {
        ...similarAsset.toObject(),
        similarity: result?.similarity || 0
      };
    });
    
    // Sort by similarity score
    enrichedResults.sort((a, b) => b.similarity - a.similarity);
    
    res.status(200).json({
      originalAsset: asset,
      similarAssets: enrichedResults,
      total: enrichedResults.length
    });
  } catch (error) {
    console.error('Error finding similar assets:', error);
    res.status(500).json({ message: 'Failed to find similar assets', error: error.message });
  }
};

// Get vector store statistics and management info
exports.getVectorStats = async (req, res) => {
  try {
    const { userId } = req.query;
    const effectiveUserId = userId || 'default-user';
    
    // Get vectorization status counts
    const totalAssets = await Asset.countDocuments({ userId: effectiveUserId });
    const vectorizedAssets = await Asset.countDocuments({ 
      userId: effectiveUserId, 
      vectorized: true 
    });
    const pendingVectorization = totalAssets - vectorizedAssets;
    
    // Get vector store stats
    const vectorStats = await vectorStoreService.getStats(effectiveUserId);
    
    res.status(200).json({
      user: effectiveUserId,
      assets: {
        total: totalAssets,
        vectorized: vectorizedAssets,
        pending: pendingVectorization,
        vectorizationRate: totalAssets > 0 ? (vectorizedAssets / totalAssets * 100).toFixed(2) : 0
      },
      vectorStore: vectorStats,
      queueStats: await vectorJobProcessor.getQueueStats()
    });
  } catch (error) {
    console.error('Error getting vector stats:', error);
    res.status(500).json({ message: 'Failed to get vector statistics', error: error.message });
  }
};

// Force re-vectorization of all assets for a user
exports.reVectorizeAssets = async (req, res) => {
  try {
    const { userId } = req.body;
    const effectiveUserId = userId || 'default-user';
    
    const result = await vectorJobProcessor.processAllUnvectorizedAssets(effectiveUserId, true);
    
    res.status(200).json({
      message: 'Re-vectorization initiated',
      ...result
    });
  } catch (error) {
    console.error('Error initiating re-vectorization:', error);
    res.status(500).json({ message: 'Failed to initiate re-vectorization', error: error.message });
  }
};

// Process pending vectorization jobs
exports.processVectorJobs = async (req, res) => {
  try {
    const { userId } = req.query;
    const effectiveUserId = userId || 'default-user';
    
    const result = await vectorJobProcessor.processAllUnvectorizedAssets(effectiveUserId);
    
    res.status(200).json({
      message: 'Vectorization processing initiated',
      ...result
    });
  } catch (error) {
    console.error('Error processing vector jobs:', error);
    res.status(500).json({ message: 'Failed to process vector jobs', error: error.message });
  }
};