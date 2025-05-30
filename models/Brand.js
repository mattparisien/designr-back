const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for color palettes
const ColorPaletteSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    primary: {
        type: String, // Hex color code
        required: true
    },
    secondary: [{
        type: String // Array of hex color codes
    }],
    accent: [{
        type: String // Array of hex color codes
    }],
    isDefault: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Schema for typography
const TypographySchema = new Schema({
    headingFont: {
        type: String,
        required: true
    },
    bodyFont: {
        type: String,
        required: true
    },
    fontPairings: [{
        heading: String,
        body: String,
        name: String
    }],
    isDefault: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Schema for logos
const LogoSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    cloudinaryId: {
        type: String
    },
    usage: {
        type: String,
        enum: ['primary', 'secondary', 'monochrome', 'variant'],
        default: 'primary'
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Schema for brand voice/tone
const BrandVoiceSchema = new Schema({
    tone: {
        type: String, // e.g., "professional", "friendly", "creative"
        required: true
    },
    keywords: [{
        type: String
    }],
    description: {
        type: String
    },
    sampleCopy: [{
        title: String,
        content: String
    }]
}, { _id: false });

// Main Brand Schema
const BrandSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: String,
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    industry: {
        type: String,
        trim: true
    },
    colorPalettes: [ColorPaletteSchema],
    logos: [LogoSchema],
    brandVoice: BrandVoiceSchema,
    images: [{
        url: String,
        cloudinaryId: String,
        category: String, // e.g., "product", "lifestyle", "team"
        tags: [String]
    }],
    guidelines: {
        type: String, // Rich text or markdown for brand guidelines
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    shared: {
        type: Boolean,
        default: false
    },
    sharedWith: [{
        type: String // User IDs
    }],
    createdFromAssets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
    }],
    aiInsights: {
        type: mongoose.Schema.Types.Mixed, // Flexible structure for AI-generated insights
        default: {}
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// Index for faster lookups by userId
BrandSchema.index({ userId: 1 });
// Index for searches by name
BrandSchema.index({ name: 'text' });

module.exports = mongoose.model('Brand', BrandSchema);