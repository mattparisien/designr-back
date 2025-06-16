const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { uploadToCloudinary } = require('./cloudinaryUploader');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

/**
 * Generates a default thumbnail for a project based on canvas background and dimensions
 * @param {Object} dimensions - Dimensions object with width and height
 * @param {Object} background - Background object with type and value
 * @param {string} userId - User ID for organizing thumbnails in Cloudinary
 * @returns {Promise<string>} - Cloudinary URL of the generated thumbnail
 */
const generateDefaultThumbnail = async (dimensions, background = { type: 'color', value: '#ffffff' }, userId) => {
  try {
    const thumbnailWidth = 400;
    const thumbnailHeight = Math.round((dimensions.height / dimensions.width) * thumbnailWidth);
    
    // Create a solid color image based on background
    let backgroundColor = '#ffffff'; // Default white
    
    if (background && background.type === 'color' && background.value) {
      backgroundColor = background.value;
    }
    
    // Convert hex color to RGB values for Sharp
    const hexColor = backgroundColor.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Create a simple canvas-like thumbnail with the background color
    const thumbnailBuffer = await sharp({
      create: {
        width: thumbnailWidth,
        height: thumbnailHeight,
        channels: 4,
        background: { r, g, b, alpha: 1 }
      }
    })
    .png()
    .toBuffer();
    
    // Create temporary file for upload
    const tempDir = path.join(__dirname, '../temp-uploads');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `default_thumbnail_${Date.now()}.png`);
    
    // Write buffer to temporary file
    await fs.promises.writeFile(tempFilePath, thumbnailBuffer);
    
    // Upload to Cloudinary
    const cloudinaryFolder = `users/${userId}/thumbnails`;
    const uploadResult = await uploadToCloudinary(tempFilePath, cloudinaryFolder, {
      transformation: [
        { width: 400, height: 'auto', crop: 'fit', quality: 'auto' }
      ]
    });
    
    return uploadResult.secure_url;
    
  } catch (error) {
    console.error('Error generating default thumbnail:', error);
    throw error;
  }
};

/**
 * Generates a canvas preview thumbnail with background and basic styling
 * @param {Object} dimensions - Dimensions object with width and height  
 * @param {Object} background - Background object with type and value
 * @param {string} userId - User ID for organizing thumbnails
 * @param {Array} elements - Optional array of canvas elements to render
 * @returns {Promise<string>} - Cloudinary URL of the generated thumbnail
 */
const generateCanvasPreviewThumbnail = async (dimensions, background = { type: 'color', value: '#ffffff' }, userId, elements = []) => {
  try {
    const maxThumbnailSize = 400;
    const aspectRatio = dimensions.width / dimensions.height;
    
    let thumbnailWidth, thumbnailHeight;
    
    if (aspectRatio > 1) {
      // Landscape: limit width
      thumbnailWidth = maxThumbnailSize;
      thumbnailHeight = Math.round(maxThumbnailSize / aspectRatio);
    } else {
      // Portrait or square: limit height
      thumbnailHeight = maxThumbnailSize;
      thumbnailWidth = Math.round(maxThumbnailSize * aspectRatio);
    }
    
    // Parse background color
    let backgroundColor = '#ffffff';
    if (background && background.type === 'color' && background.value) {
      backgroundColor = background.value;
    }
    
    // Convert hex to RGB
    const hexColor = backgroundColor.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Create base canvas with background
    const thumbnailBuffer = await sharp({
      create: {
        width: thumbnailWidth,
        height: thumbnailHeight,
        channels: 4,
        background: { r, g, b, alpha: 1 }
      }
    })
    .png()
    .toBuffer();
    
    // Create temporary file
    const tempDir = path.join(__dirname, '../temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `canvas_preview_${Date.now()}.png`);
    await fs.promises.writeFile(tempFilePath, thumbnailBuffer);
    
    // Upload to Cloudinary with optimization
    const cloudinaryFolder = `users/${userId}/thumbnails`;
    const uploadResult = await uploadToCloudinary(tempFilePath, cloudinaryFolder, {
      transformation: [
        { width: 400, height: 400, crop: 'fit', quality: 'auto', background: 'white' }
      ]
    });
    
    return uploadResult.secure_url;
    
  } catch (error) {
    console.error('Error generating canvas preview thumbnail:', error);
    throw error;
  }
};

module.exports = {
  generateDefaultThumbnail,
  generateCanvasPreviewThumbnail
};
