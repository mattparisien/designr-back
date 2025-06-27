const Asset = require('../models/Asset');
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');
const { promisify } = require('util');
const fs = require('fs');
const unlinkAsync = promisify(fs.unlink);

/**
 * Upload a font file as an asset
 */
exports.uploadFont = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No font file uploaded' });
    }

    const { userId, name } = req.body;
    const effectiveUserId = userId || 'default-user';

    // Validate font file types
    const allowedFontTypes = [
      'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 
      'application/font-woff', 'application/font-woff2',
      'application/x-font-ttf', 'application/x-font-otf',
      'application/octet-stream' // Some browsers send this for font files
    ];

    const filename = req.file.originalname.toLowerCase();
    const allowedExtensions = /\.(ttf|otf|woff|woff2)$/i;
    
    if (!allowedFontTypes.includes(req.file.mimetype) && !allowedExtensions.test(filename)) {
      await unlinkAsync(req.file.path);
      return res.status(400).json({ 
        message: 'Invalid font file type. Only TTF, OTF, WOFF, and WOFF2 files are allowed.' 
      });
    }

    // Set proper MIME type based on extension if needed
    let correctedMimeType = req.file.mimetype;
    if (req.file.mimetype === 'application/octet-stream') {
      if (filename.endsWith('.ttf')) correctedMimeType = 'font/ttf';
      else if (filename.endsWith('.otf')) correctedMimeType = 'font/otf';
      else if (filename.endsWith('.woff')) correctedMimeType = 'font/woff';
      else if (filename.endsWith('.woff2')) correctedMimeType = 'font/woff2';
    }

    // Generate font family name from filename if not provided
    const fontFamilyName = name || req.file.originalname.replace(/\.(ttf|otf|woff|woff2)$/i, '');

    // Check if font with this name already exists
    const existingFont = await Asset.findOne({
      userId: effectiveUserId,
      type: 'font',
      name: fontFamilyName
    });

    if (existingFont) {
      await unlinkAsync(req.file.path);
      return res.status(409).json({ 
        message: 'A font with this name already exists',
        existingFont: {
          id: existingFont._id,
          name: existingFont.name,
          createdAt: existingFont.createdAt
        }
      });
    }

    // Upload to Cloudinary
    const cloudinaryFolder = `users/${effectiveUserId}/fonts`;
    const uploadResult = await uploadToCloudinary(req.file.path, cloudinaryFolder, {
      resource_type: 'raw' // Use 'raw' for non-image files
    });

    // Create font asset record
    const fontAsset = new Asset({
      name: fontFamilyName,
      originalFilename: req.file.originalname,
      userId: effectiveUserId,
      folderId: null, // Fonts go to root level
      type: 'font',
      mimeType: correctedMimeType,
      fileSize: req.file.size,
      cloudinaryId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
      url: uploadResult.secure_url,
      tags: ['custom-font'],
      metadata: {
        fontFamily: fontFamilyName,
        fileFormat: filename.split('.').pop().toLowerCase(),
        cloudinaryResourceType: 'raw'
      }
    });

    const savedAsset = await fontAsset.save();

    res.status(201).json({
      message: 'Font uploaded successfully',
      font: savedAsset,
      fontFamily: fontFamilyName
    });

  } catch (error) {
    console.error('Error uploading font:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (err) {
        console.error('Error deleting temp file after failed font upload:', err);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to upload font', 
      error: error.message 
    });
  }
};

/**
 * Get all custom fonts for a user
 */
exports.getUserFonts = async (req, res) => {
  try {
    const { userId } = req.query;
    const effectiveUserId = userId || 'default-user';

    const fonts = await Asset.find({
      userId: effectiveUserId,
      type: 'font'
    }).sort({ createdAt: -1 });

    // Transform to font family format
    const fontFamilies = fonts.map(font => ({
      id: font._id,
      name: font.name,
      url: font.cloudinaryUrl || font.url,
      family: font.metadata?.fontFamily || font.name,
      format: font.metadata?.fileFormat || 'ttf',
      createdAt: font.createdAt
    }));

    res.status(200).json(fontFamilies);
  } catch (error) {
    console.error('Error fetching user fonts:', error);
    res.status(500).json({ 
      message: 'Failed to fetch fonts', 
      error: error.message 
    });
  }
};

/**
 * Delete a custom font
 */
exports.deleteFont = async (req, res) => {
  try {
    const { id } = req.params;
    
    const font = await Asset.findById(id);
    if (!font || font.type !== 'font') {
      return res.status(404).json({ message: 'Font not found' });
    }

    // Delete from Cloudinary if applicable
    if (font.cloudinaryId) {
      try {
        const { deleteFromCloudinary } = require('../utils/cloudinaryUploader');
        await deleteFromCloudinary(font.cloudinaryId, 'raw');
      } catch (cloudinaryError) {
        console.warn('Could not delete font from Cloudinary:', cloudinaryError);
      }
    }

    // Delete the database record
    await Asset.findByIdAndDelete(id);

    res.status(200).json({ message: 'Font deleted successfully' });
  } catch (error) {
    console.error('Error deleting font:', error);
    res.status(500).json({ 
      message: 'Failed to delete font', 
      error: error.message 
    });
  }
};
