const Brand = require('../models/Brand');
const Asset = require('../models/Asset');
const User = require('../models/User');
const mongoose = require('mongoose');
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get all brands for a user
 */
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ userId: req.userId });
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brands', error: error.message });
  }
};

/**
 * Get a single brand by ID
 */
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, userId: req.userId });
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand', error: error.message });
  }
};

/**
 * Create a new brand
 */
exports.createBrand = async (req, res) => {
  try {
    const { name, description, industry, colorPalettes, typography, logos, brandVoice } = req.body;
    
    const brand = await Brand.create({
      name,
      description,
      industry,
      userId: req.userId,
      colorPalettes: colorPalettes || [],
      typography: typography || [],
      logos: logos || [],
      brandVoice: brandVoice || {}
    });
    
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ success: false, message: 'Failed to create brand', error: error.message });
  }
};

/**
 * Update a brand
 */
exports.updateBrand = async (req, res) => {
  try {
    const { name, description, industry, colorPalettes, typography, logos, brandVoice, images, guidelines, isActive } = req.body;
    
    // Find brand and check ownership
    const brand = await Brand.findOne({ _id: req.params.id, userId: req.userId });
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found or access denied' });
    }
    
    // Update fields
    if (name) brand.name = name;
    if (description) brand.description = description;
    if (industry) brand.industry = industry;
    if (colorPalettes) brand.colorPalettes = colorPalettes;
    if (typography) brand.typography = typography;
    if (logos) brand.logos = logos;
    if (brandVoice) brand.brandVoice = brandVoice;
    if (images) brand.images = images;
    if (guidelines) brand.guidelines = guidelines;
    if (typeof isActive === 'boolean') brand.isActive = isActive;
    
    await brand.save();
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ success: false, message: 'Failed to update brand', error: error.message });
  }
};

/**
 * Delete a brand
 */
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found or access denied' });
    }
    res.status(200).json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ success: false, message: 'Failed to delete brand', error: error.message });
  }
};

/**
 * Generate a brand from uploaded assets
 * This function uses OpenAI to analyze uploaded assets and create a brand identity
 */
exports.generateBrandFromAssets = async (req, res) => {
  try {
    const { assetIds, brandName } = req.body;
    
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Asset IDs are required' });
    }
    
    if (!brandName) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    
    // Get assets that belong to the user
    const assets = await Asset.find({ 
      _id: { $in: assetIds }, 
      userId: req.userId 
    });
    
    if (!assets || assets.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid assets found' });
    }
    
    // Process assets to extract colors, text, and imagery
    const brandData = await analyzeAssetsWithAI(assets, brandName, req.userId);
    
    // Create a new brand with the generated data
    const brand = await Brand.create({
      name: brandName,
      userId: req.userId,
      ...brandData,
      createdFromAssets: assets.map(asset => asset._id)
    });
    
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error generating brand from assets:', error);
    res.status(500).json({ success: false, message: 'Failed to generate brand', error: error.message });
  }
};

/**
 * Update the brand by adding a new asset for analysis
 */
exports.updateBrandWithAsset = async (req, res) => {
  try {
    const { assetId } = req.body;
    const brandId = req.params.id;
    
    // Check if the asset and brand exist and belong to the user
    const [brand, asset] = await Promise.all([
      Brand.findOne({ _id: brandId, userId: req.userId }),
      Asset.findOne({ _id: assetId, userId: req.userId })
    ]);
    
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found or access denied' });
    }
    
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found or access denied' });
    }
    
    // Add the asset to the brand's createdFromAssets array if not already there
    if (!brand.createdFromAssets.includes(asset._id)) {
      brand.createdFromAssets.push(asset._id);
    }
    
    // Analyze the new asset and update the brand
    const updatedData = await analyzeAssetWithAI(asset, brand);
    
    // Update brand with new data
    Object.assign(brand, updatedData);
    await brand.save();
    
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error updating brand with asset:', error);
    res.status(500).json({ success: false, message: 'Failed to update brand', error: error.message });
  }
};

/**
 * Share a brand with other users
 */
exports.shareBrand = async (req, res) => {
  try {
    const { userEmails } = req.body;
    const brandId = req.params.id;
    
    // Validate input
    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({ success: false, message: 'User emails are required' });
    }
    
    // Find the brand and verify ownership
    const brand = await Brand.findOne({ _id: brandId, userId: req.userId });
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found or access denied' });
    }
    
    // Find users by email
    const users = await User.find({ email: { $in: userEmails } });
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid users found' });
    }
    
    // Get user IDs
    const userIds = users.map(user => user._id.toString());
    
    // Update the brand's sharedWith array
    brand.sharedWith = [...new Set([...brand.sharedWith, ...userIds])];
    brand.shared = true;
    
    await brand.save();
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    console.error('Error sharing brand:', error);
    res.status(500).json({ success: false, message: 'Failed to share brand', error: error.message });
  }
};

/**
 * Use OpenAI to analyze assets and generate brand identity
 * @param {Array} assets - The assets to analyze
 * @param {String} brandName - The name of the brand
 * @param {String} userId - The user ID
 * @returns {Object} - The generated brand data
 */
async function analyzeAssetsWithAI(assets, brandName, userId) {
  try {
    // Prepare data about assets for OpenAI
    const assetDescriptions = assets.map(asset => {
      return {
        type: asset.type,
        name: asset.name,
        mimeType: asset.mimeType,
        url: asset.url || asset.cloudinaryUrl,
        tags: asset.tags || []
      };
    });

    // Extracting text content from text-based assets could be done here
    // For now, we'll focus on image analysis which is more straightforward
    const imageAssets = assets.filter(asset => asset.type === 'image');
    
    // Extract colors from image assets if available
    let extractedColors = [];
    if (imageAssets.length > 0) {
      // We would have a more sophisticated color extraction implementation in production
      // For now, just use a placeholder as if we've analyzed the images
      extractedColors = ['#3A5A9B', '#FFFFFF', '#E63946', '#F1FAEE', '#A8DADC'];
    }
    
    // Use OpenAI to generate brand identity based on assets
    const prompt = `
    I need to create a brand identity for a company called "${brandName}".
    
    I have the following assets:
    ${JSON.stringify(assetDescriptions)}
    
    If color extraction was performed, these colors were found:
    ${extractedColors.join(', ')}
    
    Based on these assets, please generate a comprehensive brand identity with:
    1. A color palette with primary, secondary, and accent colors (in hex codes)
    2. Typography recommendations (font pairings for headings and body text)
    3. Brand voice characteristics and tone
    4. Brief brand guidelines
    5. Industry category suggestions
    
    Format your response as a JSON object with these keys: colorPalettes, typography, brandVoice, guidelines, industry
    `;

    // Make API call to OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a professional brand identity designer with expertise in color theory, typography, and marketing. Create a cohesive brand identity based on the provided assets. Return only valid JSON without any explanation or markdown.' },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4-turbo', // Use appropriate model
      response_format: { type: "json_object" }
    });

    // Parse the response
    const responseData = JSON.parse(completion.choices[0].message.content);
    
    // Format the data to match our Brand model structure
    const brandData = {
      description: responseData.description || `Auto-generated brand identity for ${brandName}`,
      industry: responseData.industry || '',
      colorPalettes: responseData.colorPalettes ? formatColorPalettes(responseData.colorPalettes) : [],
      typography: responseData.typography ? formatTypography(responseData.typography) : [],
      brandVoice: responseData.brandVoice || { 
        tone: 'professional', 
        keywords: [], 
        description: '', 
        sampleCopy: [] 
      },
      guidelines: responseData.guidelines || '',
      aiInsights: {
        generationDate: new Date().toISOString(),
        assetsAnalyzed: assets.length,
        confidence: 'medium',
        rawResponse: responseData
      }
    };

    return brandData;
  } catch (error) {
    console.error('Error analyzing assets with AI:', error);
    // Return a basic template if AI analysis fails
    return generateFallbackBrandData(brandName, assets);
  }
}

/**
 * Use OpenAI to analyze a single asset and update brand data
 */
async function analyzeAssetWithAI(asset, existingBrand) {
  try {
    // Prepare asset data for OpenAI
    const assetDescription = {
      type: asset.type,
      name: asset.name,
      mimeType: asset.mimeType,
      url: asset.url || asset.cloudinaryUrl,
      tags: asset.tags || []
    };

    // Use OpenAI to analyze the asset in the context of the existing brand
    const prompt = `
    I have an existing brand called "${existingBrand.name}" with these details:
    ${JSON.stringify({
      colorPalettes: existingBrand.colorPalettes,
      typography: existingBrand.typography,
      brandVoice: existingBrand.brandVoice,
      industry: existingBrand.industry
    })}
    
    I've added a new asset:
    ${JSON.stringify(assetDescription)}
    
    Based on this new asset, please suggest updates to the brand identity that incorporate elements from this asset while maintaining brand consistency.
    Format your response as a JSON object with these keys: colorPalettes, typography, brandVoice, guidelines, industry
    `;

    // Make API call to OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a professional brand identity designer. You need to update an existing brand identity based on a new asset, ensuring consistency with the existing brand while incorporating new elements. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4-turbo', // Use appropriate model
      response_format: { type: "json_object" }
    });

    // Parse the response
    const responseData = JSON.parse(completion.choices[0].message.content);
    
    // Update the AI insights
    const aiInsights = existingBrand.aiInsights || {};
    aiInsights.lastUpdated = new Date().toISOString();
    aiInsights.assetAdditions = aiInsights.assetAdditions || [];
    aiInsights.assetAdditions.push({
      assetId: asset._id,
      date: new Date().toISOString(),
      impact: responseData.impact || 'minor'
    });
    
    // Return the updated brand data
    return {
      colorPalettes: responseData.colorPalettes ? formatColorPalettes(responseData.colorPalettes) : existingBrand.colorPalettes,
      typography: responseData.typography ? formatTypography(responseData.typography) : existingBrand.typography,
      brandVoice: responseData.brandVoice || existingBrand.brandVoice,
      guidelines: responseData.guidelines || existingBrand.guidelines,
      industry: responseData.industry || existingBrand.industry,
      aiInsights
    };
  } catch (error) {
    console.error('Error analyzing asset with AI:', error);
    // Return the existing brand data if AI analysis fails
    return existingBrand;
  }
}

/**
 * Format color palettes from AI response to match our schema
 */
function formatColorPalettes(aiColorPalettes) {
  // Check if the AI response is already in our format
  if (Array.isArray(aiColorPalettes) && 
      aiColorPalettes.length > 0 && 
      aiColorPalettes[0].primary) {
    return aiColorPalettes;
  }
  
  // Convert to our format
  let formatted = [];
  
  // If it's an object with primary, secondary keys
  if (aiColorPalettes.primary) {
    formatted.push({
      name: 'Main Palette',
      primary: aiColorPalettes.primary,
      secondary: Array.isArray(aiColorPalettes.secondary) ? aiColorPalettes.secondary : [aiColorPalettes.secondary],
      accent: Array.isArray(aiColorPalettes.accent) ? aiColorPalettes.accent : [aiColorPalettes.accent],
      isDefault: true
    });
  } 
  // If it's an array of different palettes
  else if (Array.isArray(aiColorPalettes)) {
    formatted = aiColorPalettes.map((palette, index) => ({
      name: palette.name || `Palette ${index + 1}`,
      primary: palette.primary,
      secondary: Array.isArray(palette.secondary) ? palette.secondary : [palette.secondary],
      accent: Array.isArray(palette.accent) ? palette.accent : [palette.accent],
      isDefault: index === 0
    }));
  }
  
  return formatted;
}

/**
 * Format typography from AI response to match our schema
 */
function formatTypography(aiTypography) {
  // Check if the AI response is already in our format
  if (Array.isArray(aiTypography) && 
      aiTypography.length > 0 && 
      aiTypography[0].headingFont) {
    return aiTypography;
  }
  
  // Convert to our format
  let formatted = [];
  
  // If it's an object with heading and body font properties
  if (aiTypography.headingFont && aiTypography.bodyFont) {
    formatted.push({
      headingFont: aiTypography.headingFont,
      bodyFont: aiTypography.bodyFont,
      fontPairings: aiTypography.fontPairings || [],
      isDefault: true
    });
  }
  // If it's an array of font pairings
  else if (Array.isArray(aiTypography)) {
    aiTypography.forEach((pair, index) => {
      formatted.push({
        headingFont: pair.headingFont || pair.heading,
        bodyFont: pair.bodyFont || pair.body,
        fontPairings: [{ 
          heading: pair.headingFont || pair.heading, 
          body: pair.bodyFont || pair.body,
          name: pair.name || `Pairing ${index + 1}` 
        }],
        isDefault: index === 0
      });
    });
  }
  
  return formatted;
}

/**
 * Generate fallback brand data if AI fails
 */
function generateFallbackBrandData(brandName, assets) {
  return {
    description: `Auto-generated brand identity for ${brandName}`,
    industry: 'General',
    colorPalettes: [{
      name: 'Default Palette',
      primary: '#3A5A9B',
      secondary: ['#FFFFFF', '#F5F5F5'],
      accent: ['#E63946'],
      isDefault: true
    }],
    typography: [{
      headingFont: 'Montserrat',
      bodyFont: 'Roboto',
      fontPairings: [{
        heading: 'Montserrat',
        body: 'Roboto',
        name: 'Default Pairing'
      }],
      isDefault: true
    }],
    brandVoice: {
      tone: 'professional',
      keywords: ['reliable', 'trustworthy', 'modern'],
      description: 'Professional and clear communication that builds trust.',
      sampleCopy: []
    },
    guidelines: 'Use the primary color for main elements, secondary colors for backgrounds, and accent colors sparingly for call-to-action elements.',
    aiInsights: {
      generationDate: new Date().toISOString(),
      assetsAnalyzed: assets.length,
      generationMethod: 'fallback',
      note: 'Generated with default values due to AI processing error'
    }
  };
}