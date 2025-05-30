const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate a brand identity using the new /v1/responses endpoint.
 */
async function analyzeAssetsWithAI(assets, brandName) {
    // ----- Summarise the inputs -----
    const assetSummaries = assets.map(a => ({
        type: a.type,
        name: a.name,
        mimeType: a.mimeType,
        url: a.url || a.cloudinaryUrl,
        tags: a.tags ?? []
    }));

    // Create files for OpenAI from assets (handle multiple files)
    const uploadedFiles = [];
    
    try {
        for (const asset of assets) {
            // Only process image assets for vision analysis
            if (asset.type === 'image' && (asset.url || asset.cloudinaryUrl)) {
                try {
                    // Download the image from URL
                    const imageUrl = asset.url || asset.cloudinaryUrl;
                    const response = await axios({
                        method: 'GET',
                        url: imageUrl,
                        responseType: 'stream'
                    });
                    
                    // Create a temporary file path
                    const tempFileName = `temp_${asset._id || Date.now()}_${asset.name || 'asset'}`;
                    const tempFilePath = path.join(__dirname, '..', 'temp-uploads', tempFileName);
                    
                    // Write the stream to a temporary file
                    const writer = fs.createWriteStream(tempFilePath);
                    response.data.pipe(writer);
                    
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    
                    // Upload to OpenAI
                    const file = await openai.files.create({
                        file: fs.createReadStream(tempFilePath),
                        purpose: "vision"
                    });
                    
                    uploadedFiles.push({
                        file_id: file.id,
                        assetInfo: asset
                    });
                    
                    // Clean up temporary file
                    fs.unlinkSync(tempFilePath);
                    
                } catch (fileError) {
                    console.error(`Error processing asset ${asset.name}:`, fileError);
                    // Continue with other assets even if one fails
                }
            }
        }
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
 * Generate fallback brand data if AI fails
 */
function generateFallbackBrandData(brandName, assets) {
    return {
        description: `Auto-generated brand identity for ${brandName}`,
        industry: 'General',
        colorPalettes: {
            name: 'Default Palette',
            primary: '#3A5A9B',
            secondary: ['#FFFFFF', '#F5F5F5'],
            accent: ['#E63946']
        },
        brandVoice: {
            tone: 'professional',
            keywords: ['reliable', 'trustworthy', 'modern'],
            description: 'Professional and clear communication that builds trust.',
            sampleCopy: [
                {
                    title: 'Welcome Message',
                    content: 'Welcome to our professional service.'
                }
            ]
        },
        guidelines: 'Use the primary color for main elements, secondary colors for backgrounds, and accent colors sparingly for call-to-action elements.',
        industry: 'Technology'
    };
}

module.exports = {
    analyzeAssetsWithAI
};