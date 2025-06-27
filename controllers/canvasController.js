// canvasController.js - Controller for canvas export operations with aspect ratio preservation

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');

/**
 * Configuration for canvas export
 */
const EXPORT_CONFIG = {
  // Supported export formats
  FORMATS: ['png', 'jpeg', 'webp'],
  
  // Default quality settings per format
  DEFAULT_QUALITY: {
    'png': 100,
    'jpeg': 90,
    'webp': 80
  },
  
  // Maximum dimensions to prevent abuse
  MAX_DIMENSIONS: {
    width: 8000,
    height: 8000
  },
  
  // Temporary directory for exports
  TEMP_DIR: path.join(__dirname, '../temp-exports'),
  
  // File prefix for exported files
  FILE_PREFIX: 'canvas_export_'
};

/**
 * Ensure temp directory exists
 */
const ensureTempDir = () => {
  if (!fs.existsSync(EXPORT_CONFIG.TEMP_DIR)) {
    fs.mkdirSync(EXPORT_CONFIG.TEMP_DIR, { recursive: true });
  }
};

/**
 * Export canvas with exact aspect ratio preservation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const exportCanvas = async (req, res) => {
  try {
    const {
      imageData,
      canvasWidth,
      canvasHeight,
      format = 'png',
      quality,
      downloadMode = 'direct', // 'direct' or 'cloudinary'
      fileName,
      projectId,
      userId = 'default-user'
    } = req.body;

    // Validate required parameters
    if (!imageData || !imageData.startsWith('data:image')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid imageData: must be a base64 data URL starting with "data:image"' 
      });
    }

    if (!canvasWidth || !canvasHeight) {
      return res.status(400).json({ 
        success: false, 
        error: 'Canvas dimensions (canvasWidth and canvasHeight) are required' 
      });
    }

    // Validate format
    if (!EXPORT_CONFIG.FORMATS.includes(format.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported format. Supported formats: ${EXPORT_CONFIG.FORMATS.join(', ')}` 
      });
    }

    // Validate dimensions
    if (canvasWidth > EXPORT_CONFIG.MAX_DIMENSIONS.width || 
        canvasHeight > EXPORT_CONFIG.MAX_DIMENSIONS.height) {
      return res.status(400).json({ 
        success: false, 
        error: `Canvas dimensions exceed maximum allowed size: ${EXPORT_CONFIG.MAX_DIMENSIONS.width}x${EXPORT_CONFIG.MAX_DIMENSIONS.height}` 
      });
    }

    // Extract base64 data
    const base64Data = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    if (!base64Data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid base64 data: could not extract image data from data URL' 
      });
    }

    // Create buffer from base64
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Set quality based on format and user preference
    const exportQuality = quality || EXPORT_CONFIG.DEFAULT_QUALITY[format.toLowerCase()];

    // Process image with Sharp to ensure exact canvas dimensions
    let sharpInstance = sharp(imageBuffer)
      .resize(canvasWidth, canvasHeight, {
        fit: 'fill', // Ensures exact dimensions matching canvas size
        withoutEnlargement: false
      });

    // Apply format-specific settings
    switch (format.toLowerCase()) {
      case 'png':
        sharpInstance = sharpInstance.png({ 
          quality: exportQuality,
          compressionLevel: 6
        });
        break;
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ 
          quality: exportQuality,
          progressive: true
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ 
          quality: exportQuality,
          lossless: exportQuality >= 100
        });
        break;
    }

    const processedBuffer = await sharpInstance.toBuffer();

    // Handle different download modes
    if (downloadMode === 'cloudinary') {
      try {
        // Ensure temp directory exists
        ensureTempDir();

        // Generate unique temporary file path
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const tempFileName = `${EXPORT_CONFIG.FILE_PREFIX}${timestamp}_${randomSuffix}.${format}`;
        const tempFilePath = path.join(EXPORT_CONFIG.TEMP_DIR, tempFileName);

        // Write to temporary file
        await fs.promises.writeFile(tempFilePath, processedBuffer);

        // Upload to Cloudinary
        const cloudinaryFolder = `users/${userId}/exports`;
        const uploadOptions = {
          resource_type: 'image',
          context: `canvas_width=${canvasWidth}|canvas_height=${canvasHeight}|format=${format}|quality=${exportQuality}`,
          tags: ['canvas_export', format, projectId ? `project_${projectId}` : 'standalone'].filter(Boolean)
        };

        const uploadResult = await uploadToCloudinary(tempFilePath, cloudinaryFolder, uploadOptions);

        // Clean up temp file (uploadToCloudinary already does this, but just in case)
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }

        return res.json({
          success: true,
          exportData: {
            cloudinaryUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            bytes: uploadResult.bytes
          },
          metadata: {
            originalCanvas: { width: canvasWidth, height: canvasHeight },
            format,
            quality: exportQuality,
            projectId,
            exportedAt: new Date().toISOString()
          }
        });

      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, falling back to direct download:', cloudinaryError.message);
        // Fall through to direct download
      }
    }

    // Direct download mode (default and fallback)
    const finalFileName = fileName || `canvas_export_${canvasWidth}x${canvasHeight}_${Date.now()}.${format}`;
    
    // Set response headers for download
    res.set({
      'Content-Type': `image/${format}`,
      'Content-Disposition': `attachment; filename="${finalFileName}"`,
      'Content-Length': processedBuffer.length,
      'Cache-Control': 'no-cache'
    });

    // Send the processed image buffer
    return res.send(processedBuffer);

  } catch (error) {
    console.error('Canvas export error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Canvas export failed', 
      details: error.message 
    });
  }
};

/**
 * Generate thumbnail with preserved aspect ratio
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateThumbnail = async (req, res) => {
  try {
    const {
      imageData,
      canvasWidth,
      canvasHeight,
      thumbnailSize = 300,
      uploadToCloud = false,
      userId = 'default-user',
      projectId
    } = req.body;

    // Validate required parameters
    if (!imageData || !imageData.startsWith('data:image')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid imageData: must be a base64 data URL starting with "data:image"' 
      });
    }

    // Extract base64 data
    const base64Data = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Calculate thumbnail dimensions preserving aspect ratio
    let thumbnailWidth, thumbnailHeight;
    
    if (canvasWidth && canvasHeight) {
      const aspectRatio = canvasWidth / canvasHeight;
      const maxSize = parseInt(thumbnailSize);
      
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
      thumbnailWidth = parseInt(thumbnailSize);
      thumbnailHeight = parseInt(thumbnailSize);
    }

    // Process thumbnail with Sharp
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(thumbnailWidth, thumbnailHeight, {
        fit: 'fill', // Ensures exact dimensions matching canvas aspect ratio
        withoutEnlargement: false
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    if (uploadToCloud) {
      try {
        // Ensure temp directory exists
        ensureTempDir();

        // Generate unique temporary file path
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const tempFileName = `thumbnail_${timestamp}_${randomSuffix}.jpg`;
        const tempFilePath = path.join(EXPORT_CONFIG.TEMP_DIR, tempFileName);

        // Write to temporary file
        await fs.promises.writeFile(tempFilePath, thumbnailBuffer);

        // Upload to Cloudinary
        const cloudinaryFolder = `users/${userId}/thumbnails`;
        const uploadOptions = {
          resource_type: 'image',
          context: canvasWidth && canvasHeight ? 
            `canvas_width=${canvasWidth}|canvas_height=${canvasHeight}|thumbnail_size=${thumbnailSize}` : 
            `thumbnail_size=${thumbnailSize}`,
          tags: ['thumbnail', projectId ? `project_${projectId}` : 'standalone'].filter(Boolean)
        };

        const uploadResult = await uploadToCloudinary(tempFilePath, cloudinaryFolder, uploadOptions);

        return res.json({
          success: true,
          thumbnailUrl: uploadResult.secure_url,
          metadata: {
            dimensions: { width: thumbnailWidth, height: thumbnailHeight },
            originalCanvas: canvasWidth && canvasHeight ? { width: canvasWidth, height: canvasHeight } : null,
            aspectRatio: canvasWidth && canvasHeight ? `${canvasWidth}:${canvasHeight}` : null,
            uploadedAt: new Date().toISOString()
          }
        });

      } catch (cloudinaryError) {
        console.error('Cloudinary thumbnail upload failed:', cloudinaryError.message);
        // Fall through to direct response
      }
    }

    // Return thumbnail as base64 data URL
    const thumbnailBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
    
    return res.json({
      success: true,
      thumbnailData: thumbnailBase64,
      metadata: {
        dimensions: { width: thumbnailWidth, height: thumbnailHeight },
        originalCanvas: canvasWidth && canvasHeight ? { width: canvasWidth, height: canvasHeight } : null,
        aspectRatio: canvasWidth && canvasHeight ? `${canvasWidth}:${canvasHeight}` : null,
        format: 'jpeg',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Thumbnail generation failed', 
      details: error.message 
    });
  }
};

/**
 * Get supported export formats and their configurations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getExportFormats = (req, res) => {
  try {
    const formatInfo = EXPORT_CONFIG.FORMATS.map(format => ({
      format,
      defaultQuality: EXPORT_CONFIG.DEFAULT_QUALITY[format],
      description: getFormatDescription(format)
    }));

    return res.json({
      success: true,
      supportedFormats: formatInfo,
      maxDimensions: EXPORT_CONFIG.MAX_DIMENSIONS,
      features: [
        'Exact aspect ratio preservation',
        'Multiple quality settings',
        'Direct download or cloud upload',
        'Metadata tracking',
        'Batch processing support'
      ]
    });

  } catch (error) {
    console.error('Error getting export formats:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve export formats' 
    });
  }
};

/**
 * Get format description for documentation
 * @param {string} format - The image format
 * @returns {string} - Description of the format
 */
const getFormatDescription = (format) => {
  const descriptions = {
    'png': 'High quality, lossless compression, supports transparency',
    'jpeg': 'Good quality, lossy compression, smaller file sizes',
    'webp': 'Modern format, excellent compression, good browser support'
  };
  
  return descriptions[format] || 'Supported image format';
};

module.exports = {
  exportCanvas,
  generateThumbnail,
  getExportFormats
};