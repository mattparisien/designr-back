const Brand = require('../models/Brand');
const Asset = require('../models/Asset');
const User = require('../models/User');
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types;
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');
const { OpenAI } = require('openai');
const { path } = require("path");
const fs = require('fs');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get all brands for a user
 */
exports.getBrands = async (req, res) => {
    try {
        const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing
        const brands = await Brand.find({ userId });
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
        const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing
        const brand = await Brand.findOneAndDelete({ _id: req.params.id, userId: userId });
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
        const userId = req.userId || "6825167ffe3452cafe0c8440";


        if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Asset IDs are required' });
        }

        if (!brandName) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        // Get assets that belong to the user

        const assets = await Asset.find({
            _id: { $in: assetIds.map(id => new ObjectId(id)) },
            // userId: req.userId
        });


        if (!assets || assets.length === 0) {
            return res.status(404).json({ success: false, message: 'No valid assets found' });
        }

        // Process assets to extract colors, text, and imagery
        const brandData = await analyzeAssetsWithAI(assets, brandName, userId);

        // return res.status(201).json({ success: true, data: brandData });


        // Create a new brand with the generated data
        const brand = await Brand.create({
            name: brandName,
            userId: userId,
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

async function analyzeAssetsWithAI(assets, brandName) {
    // ----- Summarise the inputs -----
    const assetSummaries = assets.map(a => ({
        type: a.type,
        name: a.name,
        mimeType: a.mimeType,
        url: a.url || a.cloudinaryUrl,
        tags: a.tags ?? []
    }));

    const assetInputs = assets.map(a => ({
        type: "input_image",
        image_url: a.url || a.cloudinaryUrl
    }));

    // Create files for OpenAI from assets (handle multiple files)
    // const uploadedFiles = [];

        const brandSchema = {
        type: "object",
        additionalProperties: false,            // 👈 root
        properties: {
            colorPalettes: {
                type: "object",
                additionalProperties: false,        // 👈 nested
                properties: {
                    name: { type: "string" },
                    primary: { type: "string" },
                    secondary: { type: "array", items: { type: "string" } },
                    accent: { type: "array", items: { type: "string" } }
                },
                required: ["name", "primary", "secondary", "accent"]
            },


            brandVoice: {
                type: "object",
                additionalProperties: false,
                properties: {
                    tone: { type: "string" },
                    keywords: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
                    sampleCopy: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                title: { type: "string" },
                                content: { type: "string" }
                            },
                            required: ["title", "content"]
                        }
                    },
                },
                required: ["tone", "keywords", "description", "sampleCopy"]
            },

            guidelines: { type: "string" },
            industry: { type: "string" }
        },
        required: [
            "colorPalettes",
            "brandVoice",
            "guidelines",
            "industry"
        ]
    };

    try {
        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [{
                role: "user",
                content: [
                    { type: "input_text", text: `Extract a brand identity from the following images. Please use the following json schema to answer: ${JSON.stringify(brandSchema)}` },
                    ...assetInputs
                ],
            }],
        })

        return JSON.parse(response.output_text);

        // for (const asset of assets) {
        //     // Only process image assets for vision analysis
        //     if (asset.type === 'image' && (asset.url || asset.cloudinaryUrl)) {
        //         try {
        //             // Download the image from URL
        //             const imageUrl = asset.url || asset.cloudinaryUrl;
        //             const response = await axios({
        //                 method: 'GET',
        //                 url: imageUrl,
        //                 responseType: 'stream'
        //             });

        //             // Create a temporary file path
        //             const tempFileName = `temp_${asset._id || Date.now()}_${asset.name || 'asset'}`;
        //             const tempFilePath = path.join(__dirname, '..', 'temp-uploads', tempFileName);

        //             // Write the stream to a temporary file
        //             const writer = fs.createWriteStream(tempFilePath);
        //             response.data.pipe(writer);

        //             await new Promise((resolve, reject) => {
        //                 writer.on('finish', resolve);
        //                 writer.on('error', reject);
        //             });

        //             // Upload to OpenAI
        //             const file = await openai.files.create({
        //                 file: fs.createReadStream(tempFilePath),
        //                 purpose: "vision"
        //             });

        //             uploadedFiles.push({
        //                 file_id: file.id,
        //                 assetInfo: asset
        //             });

        //             // Clean up temporary file
        //             fs.unlinkSync(tempFilePath);

        //         } catch (fileError) {
        //             console.error(`Error processing asset ${asset.name}:`, fileError);
        //             // Continue with other assets even if one fails
        //         }
        //     }
        // }
    } catch (error) {
        console.error('Error processing assets for OpenAI:', error);
    }

    const extractedColors =
        assets.some(a => a.type === "image")
            ? ["#3A5A9B", "#FFFFFF", "#E63946", "#F1FAEE", "#A8DADC"]
            : [];

    const userPrompt = `
Create a complete brand identity for **${brandName}** from the supplied assets.

Assets:
${JSON.stringify(assetSummaries, null, 2)}

Please analyze any attached images for color schemes, design elements, typography hints, and brand personality.
If multiple images are provided, consider them as a cohesive brand system.
Extract actual colors from the images rather than using placeholder colors.
`;

    // ----- Optional JSON-Schema helper -----
    // const brandSchema = {
    //     type: "object",
    //     additionalProperties: false,            // 👈 root
    //     properties: {
    //         colorPalettes: {
    //             type: "object",
    //             additionalProperties: false,        // 👈 nested
    //             properties: {
    //                 name: { type: "string" },
    //                 primary: { type: "string" },
    //                 secondary: { type: "array", items: { type: "string" } },
    //                 accent: { type: "array", items: { type: "string" } }
    //             },
    //             required: ["name", "primary", "secondary", "accent"]
    //         },


    //         brandVoice: {
    //             type: "object",
    //             additionalProperties: false,
    //             properties: {
    //                 tone: { type: "string" },
    //                 keywords: { type: "array", items: { type: "string" } },
    //                 description: { type: "string" },
    //                 sampleCopy: {
    //                     type: "array",
    //                     items: {
    //                         type: "object",
    //                         additionalProperties: false,
    //                         properties: {
    //                             title: { type: "string" },
    //                             content: { type: "string" }
    //                         },
    //                         required: ["title", "content"]
    //                     }
    //                 },
    //             },
    //             required: ["tone", "keywords", "description", "sampleCopy"]
    //         },

    //         guidelines: { type: "string" },
    //         industry: { type: "string" }
    //     },
    //     required: [
    //         "colorPalettes",
    //         "brandVoice",
    //         "guidelines",
    //         "industry"
    //     ]
    // };


    try {

        console.log(uploadedFiles, 'uplaodef ifle')

        // ----- NEW Responses API call -----
        const response = await openai.responses.parse({
            model: "gpt-4o-2024-08-06",            // swap for the model you have access to
            input: [{
                role: "system",
                content: userPrompt
            }],
            attachments: uploadedFiles.map(f => ({ file_id: f.file_id })),

            text: {                     // replaces response_format/tools combo
                format: {
                    type: "json_schema",
                    name: "brand_identity",
                    schema: brandSchema
                }
            },
            // store: false               // uncomment if you don't want OpenAI to retain the response 
        });

        // ----- Parse & normalise -----
        const data = response.output_parsed;

        // Clean up uploaded files from OpenAI
        for (const uploadedFile of uploadedFiles) {
            try {
                await openai.files.del(uploadedFile.file_id);
            } catch (cleanupError) {
                console.error(`Error cleaning up file ${uploadedFile.file_id}:`, cleanupError);
            }
        }

        return data;

    } catch (err) {
        console.error("⚠️  AI brand-generation failed:", err);

        // Clean up uploaded files on error
        for (const uploadedFile of uploadedFiles) {
            try {
                await openai.files.del(uploadedFile.file_id);
            } catch (cleanupError) {
                console.error(`Error cleaning up file ${uploadedFile.file_id}:`, cleanupError);
            }
        }

        return generateFallbackBrandData(brandName, assets);
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