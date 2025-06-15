import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';

// Extend Request interface to include userId
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

// Import JavaScript modules using require (since they're CommonJS modules)
import mongoose from 'mongoose';
import { OpenAI } from 'openai';
import Brand from '../models/Brand.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
const { ObjectId } = mongoose.Types;

// Import JavaScript modules with type annotations
const { uploadToCloudinary } = require('../utils/cloudinaryUploader') as { uploadToCloudinary: any };

// Import shared types
import type {
    BrandId,
    CreateBrandPayload,
    DeleteBrandResponse,
    GenerateBrandFromAssetsPayload,
    GenerateBrandFromAssetsResponse,
    ShareBrandPayload,
    ShareBrandResponse,
    UpdateBrandPayload,
    UpdateBrandWithAssetPayload,
    UpdateBrandWithAssetResponse
} from '@canva-clone/shared-types';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get all brands for a user
 */
export const getBrands = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing
    const brands = await Brand.find({ userId });
    res.status(200).json({ success: true, data: brands });
});

/**
 * Get a single brand by ID
 */
export const getBrandById = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing
    const brand = await Brand.findOne({ _id: req.params.id, userId: userId });
    if (!brand) {
        res.status(404).json({ success: false, message: 'Brand not found' });
        return;
    }
    res.status(200).json({ success: true, data: brand });
});

/**
 * Create a new brand
 */
export const createBrand = asyncHandler(async (req: Request<{}, {}, CreateBrandPayload>, res: Response): Promise<void> => {
    const { name, description, tagline, industry, colorPalettes, typography, logos, brandVoice } = req.body;

    const brand = await Brand.create({
        name,
        description,
        tagline,
        industry,
        userId: req.userId,
        colorPalettes: colorPalettes || [],
        typography: typography || [],
        logos: logos || [],
        brandVoice: brandVoice || {}
    });

    res.status(201).json({ success: true, data: brand });
});

/**
 * Update a brand
 */
export const updateBrand = asyncHandler(async (req: Request<{ id: string }, {}, UpdateBrandPayload>, res: Response): Promise<void> => {
    const { name, description, tagline, industry, colorPalettes, typography, logos, brandVoice, images, guidelines, isActive } = req.body;
    const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing

    // Find brand and check ownership
    const brand = await Brand.findOne({ _id: req.params.id, userId });
    if (!brand) {
        res.status(404).json({ success: false, message: 'Brand not found or access denied' });
        return;
    }

    // Update fields
    if (name) brand.name = name;
    if (description) brand.description = description;
    if (tagline) brand.tagline = tagline;
    if (industry) brand.industry = industry;
    if (colorPalettes) (brand as any).colorPalettes = colorPalettes;
    if (typography) (brand as any).typography = typography;
    if (logos) (brand as any).logos = logos;
    if (brandVoice) brand.brandVoice = brandVoice;
    if (images) (brand as any).images = images;
    if (guidelines) brand.guidelines = guidelines;
    if (typeof isActive === 'boolean') brand.isActive = isActive;

    await brand.save();
    res.status(200).json({ success: true, data: brand });
});

/**
 * Delete a brand
 */
export const deleteBrand = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId || "6825167ffe3452cafe0c8440"; // Default user ID for testing
    const brand = await Brand.findOneAndDelete({ _id: req.params.id, userId: userId });
    if (!brand) {
        res.status(404).json({ success: false, message: 'Brand not found or access denied' });
        return;
    }

    const response: DeleteBrandResponse = {
        success: true,
        id: req.params.id as BrandId,
        deleted: true
    };

    res.status(200).json(response);
});

/**
 * Generate a brand from uploaded assets
 * This function uses OpenAI to analyze uploaded assets and create a brand identity
 */
export const generateBrandFromAssets = asyncHandler(async (req: Request<{}, {}, GenerateBrandFromAssetsPayload>, res: Response): Promise<void> => {
    const { assetIds, brandName } = req.body;
    const userId = req.userId || "6825167ffe3452cafe0c8440";

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        res.status(400).json({ success: false, message: 'Asset IDs are required' });
        return;
    }

    if (!brandName) {
        res.status(400).json({ success: false, message: 'Brand name is required' });
        return;
    }

    // Get assets that belong to the user
    const assets = await Asset.find({
        _id: { $in: assetIds.map((id: string) => new ObjectId(id)) },
        // userId: req.userId
    });

    if (!assets || assets.length === 0) {
        res.status(404).json({ success: false, message: 'No valid assets found' });
        return;
    }

    // Process assets to extract colors, text, and imagery
    const brandData = await analyzeAssetsWithAI(assets, brandName);

    // Create a new brand with the generated data
    const brand = await Brand.create({
        name: brandName,
        userId: userId,
        ...brandData,
        createdFromAssets: assets.map((asset: any) => asset._id)
    });

    const response: GenerateBrandFromAssetsResponse = {
        success: true,
        brand: brand.toObject() as any,
        generationMethod: 'ai',
        assetsAnalyzed: assets.length
    };

    res.status(201).json(response);
});

/**
 * Update the brand by adding a new asset for analysis
 */
export const updateBrandWithAsset = asyncHandler(async (req: Request<{ id: string }, {}, UpdateBrandWithAssetPayload>, res: Response): Promise<void> => {
    const { assetId } = req.body;
    const brandId = req.params.id;
    const userId = req.userId || "6825167ffe3452cafe0c8440";

    // Check if the asset and brand exist and belong to the user
    const [brand, asset] = await Promise.all([
        Brand.findOne({ _id: brandId, userId: userId }),
        Asset.findOne({ _id: assetId, userId: userId })
    ]);

    if (!brand) {
        res.status(404).json({ success: false, message: 'Brand not found or access denied' });
        return;
    }

    if (!asset) {
        res.status(404).json({ success: false, message: 'Asset not found or access denied' });
        return;
    }

    // Add the asset to the brand's createdFromAssets array if not already there
    if (!brand.createdFromAssets.includes(asset._id)) {
        brand.createdFromAssets.push(asset._id);
    }

    // Analyze the new asset and update the brand
    const updatedData = await analyzeAssetsWithAI([asset], brand.name);

    // Update brand with new data - merge the analyzed data
    if (updatedData.colorPalettes) {
        (brand as any).colorPalettes = [...(brand as any).colorPalettes, ...updatedData.colorPalettes];
    }
    if (updatedData.typography) {
        (brand as any).typography = [...(brand as any).typography, ...updatedData.typography];
    }
    if (updatedData.brandVoice) {
        brand.brandVoice = { ...brand.brandVoice, ...updatedData.brandVoice };
    }

    await brand.save();

    const response: UpdateBrandWithAssetResponse = {
        success: true,
        brand: brand.toObject() as any,
        assetAdded: assetId
    };

    res.status(200).json(response);
});

/**
 * Share a brand with other users
 */
export const shareBrand = asyncHandler(async (req: Request<{ id: string }, {}, ShareBrandPayload>, res: Response): Promise<void> => {
    const { userEmails } = req.body;
    const brandId = req.params.id;
    const userId = req.userId || "6825167ffe3452cafe0c8440";

    // Validate input
    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
        res.status(400).json({ success: false, message: 'User emails are required' });
        return;
    }

    // Find the brand and verify ownership
    const brand = await Brand.findOne({ _id: brandId, userId: userId });
    if (!brand) {
        res.status(404).json({ success: false, message: 'Brand not found or access denied' });
        return;
    }

    // Find users by email
    const users = await User.find({ email: { $in: userEmails } });
    if (!users || users.length === 0) {
        res.status(404).json({ success: false, message: 'No valid users found' });
        return;
    }

    // Get user IDs
    const userIds = users.map((user: any) => user._id.toString());

    // Update the brand's sharedWith array
    brand.sharedWith = [...new Set([...brand.sharedWith, ...userIds])];
    brand.shared = true;

    await brand.save();

    const response: ShareBrandResponse = {
        success: true,
        brand: brand.toObject() as any,
        sharedWithUsers: userIds
    };

    res.status(200).json(response);
});

async function analyzeAssetsWithAI(assets: any[], brandName: string): Promise<any> {
    // ----- Summarise the inputs -----
    const assetSummaries = assets.map((a: any) => ({
        type: a.type,
        name: a.name,
        mimeType: a.mimeType,
        url: a.url || a.cloudinaryUrl,
        tags: a.tags ?? []
    }));

    const assetInputs = assets.map((a: any) => ({
        type: "image_url",
        image_url: {
            url: a.url || a.cloudinaryUrl
        }
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
            industry: { type: "string" },
            tagline: { type: "string" }
        },
        required: [
            "colorPalettes",
            "brandVoice",
            "guidelines",
            "industry",
            "tagline"
        ]
    };

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract a brand identity from the following images. Please use the following json schema to answer: ${JSON.stringify(brandSchema)}`
                        },
                        ...assetInputs
                    ] as any,
                }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "brand_identity",
                    schema: brandSchema
                }
            }
        });

        const responseText = response.choices[0]?.message?.content;
        if (responseText) {
            return JSON.parse(responseText);
        }

        throw new Error("No response from OpenAI");

    } catch (err) {
        console.error("⚠️  AI brand-generation failed:", err);
        return generateFallbackBrandData(brandName, assets);
    }
}


/**
 * Format color palettes from AI response to match our schema
 */
function formatColorPalettes(aiColorPalettes: any): any[] {
    // Check if the AI response is already in our format
    if (Array.isArray(aiColorPalettes) &&
        aiColorPalettes.length > 0 &&
        aiColorPalettes[0].primary) {
        return aiColorPalettes;
    }

    // Convert to our format
    let formatted: any[] = [];

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
function formatTypography(aiTypography: any): any[] {
    // Check if the AI response is already in our format
    if (Array.isArray(aiTypography) &&
        aiTypography.length > 0 &&
        aiTypography[0].headingFont) {
        return aiTypography;
    }

    // Convert to our format
    let formatted: any[] = [];

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
function generateFallbackBrandData(brandName: string, assets: any[]): any {
    return {
        description: `Auto-generated brand identity for ${brandName}`,
        tagline: `Experience the power of ${brandName}`,
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