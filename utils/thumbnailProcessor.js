// thumbnailProcessor.js - Utility for processing base64 thumbnails and uploading to Cloudinary

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sharp = require('sharp');
const { uploadToCloudinary } = require('./cloudinaryUploader');

const unlinkAsync = promisify(fs.unlink);

/**
 * Configuration for thumbnail processing
 */
const THUMBNAIL_CONFIG = {
  // Directory for temporary files relative to the utils folder
  TEMP_DIR: path.join(__dirname, '../temp-uploads'),
  
  // File prefix for generated thumbnails
  FILE_PREFIX: 'thumbnail_',
  
  // File extension for thumbnails
  FILE_EXTENSION: '.png',
  
  // Base64 data URL pattern
  DATA_URL_PATTERN: /^data:image\/\w+;base64,/,
  
  // Cloudinary folder structure template
  FOLDER_TEMPLATE: 'users/{userId}/thumbnails',
  
  // Default thumbnail dimensions
  DEFAULT_THUMBNAIL_SIZE: 300,
  
  // Quality for JPEG thumbnails
  THUMBNAIL_QUALITY: 85
};

/**
 * Processes a base64 thumbnail with aspect ratio preservation
 * @param {string} base64Thumbnail - The base64 data URL thumbnail
 * @param {string} userId - The user ID for organizing uploads in Cloudinary
 * @param {Object} canvasSize - Canvas dimensions {width, height}
 * @returns {Promise<string>} - The Cloudinary secure URL of the uploaded thumbnail
 * @throws {Error} - If thumbnail processing fails
 */
async function processThumbnailWithAspectRatio(base64Thumbnail, userId, canvasSize = null) {
  if (!base64Thumbnail || !base64Thumbnail.startsWith('data:image')) {
    throw new Error('Invalid thumbnail data: must be a base64 data URL starting with "data:image"');
  }
  
  if (!userId) {
    throw new Error('User ID is required for thumbnail processing');
  }
  
  let tmpFilePath = null;
  
  try {
    // Ensure temp directory exists
    if (!fs.existsSync(THUMBNAIL_CONFIG.TEMP_DIR)) {
      fs.mkdirSync(THUMBNAIL_CONFIG.TEMP_DIR, { recursive: true });
    }
    
    // Extract base64 data
    const base64Data = base64Thumbnail.replace(THUMBNAIL_CONFIG.DATA_URL_PATTERN, '');
    if (!base64Data) {
      throw new Error('Invalid base64 data: could not extract image data from data URL');
    }
    
    // Create buffer from base64
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Calculate thumbnail dimensions while preserving aspect ratio
    let thumbnailWidth, thumbnailHeight;
    
    if (canvasSize && canvasSize.width && canvasSize.height) {
      const aspectRatio = canvasSize.width / canvasSize.height;
      const maxSize = THUMBNAIL_CONFIG.DEFAULT_THUMBNAIL_SIZE;
      
      if (aspectRatio > 1) {
        // Landscape
        thumbnailWidth = maxSize;
        thumbnailHeight = Math.round(maxSize / aspectRatio);
      } else {
        // Portrait or square
        thumbnailHeight = maxSize;
        thumbnailWidth = Math.round(maxSize * aspectRatio);
      }
    } else {
      // Fallback to square thumbnail
      thumbnailWidth = THUMBNAIL_CONFIG.DEFAULT_THUMBNAIL_SIZE;
      thumbnailHeight = THUMBNAIL_CONFIG.DEFAULT_THUMBNAIL_SIZE;
    }
    
    // Process image with Sharp
    const processedBuffer = await sharp(imageBuffer)
      .resize(thumbnailWidth, thumbnailHeight, {
        fit: 'fill', // Ensures exact dimensions matching canvas aspect ratio
        withoutEnlargement: false
      })
      .jpeg({ quality: THUMBNAIL_CONFIG.THUMBNAIL_QUALITY })
      .toBuffer();
    
    // Generate unique temporary file path
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${THUMBNAIL_CONFIG.FILE_PREFIX}${timestamp}_${randomSuffix}.jpg`;
    tmpFilePath = path.join(THUMBNAIL_CONFIG.TEMP_DIR, fileName);
    
    // Write processed buffer to temporary file
    await fs.promises.writeFile(tmpFilePath, processedBuffer);
    
    // Generate Cloudinary folder path
    const cloudinaryFolder = THUMBNAIL_CONFIG.FOLDER_TEMPLATE.replace('{userId}', userId);
    
    // Upload to Cloudinary with additional metadata
    const uploadResult = await uploadToCloudinary(tmpFilePath, cloudinaryFolder, {
      resource_type: 'image',
      context: canvasSize ? `canvas_width=${canvasSize.width}|canvas_height=${canvasSize.height}` : undefined
    });
    
    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Cloudinary upload failed: no secure URL returned');
    }
    
    return uploadResult.secure_url;
    
  } catch (error) {
    // Re-throw with more context
    throw new Error(`Thumbnail processing failed: ${error.message}`);
  } finally {
    // Clean up temporary file if it was created
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try {
        await unlinkAsync(tmpFilePath);
      } catch (cleanupError) {
        console.warn(`Warning: Failed to clean up temporary thumbnail file ${tmpFilePath}:`, cleanupError.message);
      }
    }
  }
}

/**
 * Processes a base64 thumbnail by converting it to a file, uploading to Cloudinary, and cleaning up
 * @param {string} base64Thumbnail - The base64 data URL thumbnail
 * @param {string} userId - The user ID for organizing uploads in Cloudinary
 * @returns {Promise<string>} - The Cloudinary secure URL of the uploaded thumbnail
 * @throws {Error} - If thumbnail processing fails
 */
async function processThumbnail(base64Thumbnail, userId) {
  // Use the new aspect ratio function without canvas size (fallback to square)
  return processThumbnailWithAspectRatio(base64Thumbnail, userId, null);
}

/**
 * Processes thumbnail data in project data object, replacing base64 with Cloudinary URL
 * @param {Object} projectData - The project data object containing thumbnail
 * @param {string} userId - The user ID for organizing uploads
 * @returns {Promise<Object>} - The project data with processed thumbnail URL
 */
async function processProjectThumbnail(projectData, userId) {
  if (!projectData) {
    throw new Error('Project data is required');
  }
  
  // Create a copy to avoid mutating the original object
  const processedData = { ...projectData };
  
  // Only process if thumbnail is a base64 data URL
  if (processedData.thumbnail && processedData.thumbnail.startsWith('data:image')) {
    try {
      // Extract canvas dimensions from project data for aspect ratio preservation
      let canvasSize = null;
      
      // Try to get canvas size from various possible locations in project data
      if (processedData.canvasSize) {
        canvasSize = processedData.canvasSize;
      } else if (processedData.layout?.pages?.[0]?.canvas) {
        canvasSize = processedData.layout.pages[0].canvas;
      } else if (processedData.pages?.[0]?.canvas) {
        canvasSize = processedData.pages[0].canvas;
      }
      
      // Use the new aspect ratio preserving function
      const cloudinaryUrl = await processThumbnailWithAspectRatio(
        processedData.thumbnail, 
        userId, 
        canvasSize
      );
      processedData.thumbnail = cloudinaryUrl;
      
      // Add metadata about the thumbnail dimensions if canvas size was available
      if (canvasSize && canvasSize.width && canvasSize.height) {
        processedData.thumbnailMetadata = {
          originalCanvasSize: canvasSize,
          aspectRatio: `${canvasSize.width}:${canvasSize.height}`,
          processedAt: new Date().toISOString()
        };
      }
      
    } catch (error) {
      console.error('Error processing project thumbnail:', error.message);
      // Decide whether to throw or continue - currently continuing to match original behavior
      // You might want to throw here if thumbnail processing is critical
    }
  }
  
  return processedData;
}

/**
 * Checks if a string is a base64 data URL thumbnail
 * @param {string} thumbnail - The thumbnail string to check
 * @returns {boolean} - True if it's a base64 data URL
 */
function isBase64Thumbnail(thumbnail) {
  return typeof thumbnail === 'string' && thumbnail.startsWith('data:image');
}

/**
 * Validates thumbnail data before processing
 * @param {string} thumbnail - The thumbnail to validate
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validateThumbnail(thumbnail) {
  if (!thumbnail || typeof thumbnail !== 'string') {
    throw new Error('Thumbnail must be a non-empty string');
  }
  
  if (!thumbnail.startsWith('data:image')) {
    throw new Error('Thumbnail must be a data URL starting with "data:image"');
  }
  
  if (!THUMBNAIL_CONFIG.DATA_URL_PATTERN.test(thumbnail)) {
    throw new Error('Invalid thumbnail format: must include base64 encoding specification');
  }
  
  // Check if there's actual base64 data after the prefix
  const base64Data = thumbnail.replace(THUMBNAIL_CONFIG.DATA_URL_PATTERN, '');
  if (!base64Data || base64Data.length < 10) {
    throw new Error('Thumbnail contains insufficient base64 data');
  }
  
  return true;
}

module.exports = {
  processThumbnail,
  processThumbnailWithAspectRatio,
  processProjectThumbnail,
  isBase64Thumbnail,
  validateThumbnail,
  THUMBNAIL_CONFIG
};
