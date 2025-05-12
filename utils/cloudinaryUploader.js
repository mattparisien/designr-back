const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

/**
 * Uploads a file to Cloudinary
 * @param {string} filePath - Path to the temporary file
 * @param {string} folder - Cloudinary folder to store the file in
 * @param {object} options - Additional Cloudinary upload options
 * @returns {Promise<object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (filePath, folder = 'assets', options = {}) => {
  try {
    // Set default options
    const uploadOptions = {
      folder,
      resource_type: 'auto', // Auto-detect resource type (image, video, raw)
      ...options
    };

    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    // Delete the temporary file
    await unlinkAsync(filePath);
    
    return result;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Deletes a file from Cloudinary
 * @param {string} publicId - Cloudinary public_id of the file
 * @param {string} resourceType - Type of resource (image, video, raw)
 * @returns {Promise<object>} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Creates a thumbnail from an image in Cloudinary
 * @param {string} publicId - Cloudinary public_id of the original image
 * @param {object} options - Transformation options
 * @returns {Promise<object>} - Cloudinary transformation result
 */
const createCloudinaryThumbnail = async (publicId, options = {}) => {
  try {
    // Set default options for thumbnail
    const transformOptions = {
      folder: 'thumbnails',
      transformation: [
        { width: 200, height: 200, crop: 'fill' },
        ...options.transformation || []
      ],
      ...options
    };
    
    // Generate thumbnail
    const result = await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      ...transformOptions
    });
    
    return result;
  } catch (error) {
    console.error('Error creating Cloudinary thumbnail:', error);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  createCloudinaryThumbnail
};