const mongoose = require('mongoose');

// Define the schema for individual elements in a template
const ElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true }, // text, image, shape, etc.
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  // Text-specific properties
  content: { type: String },
  fontSize: { type: Number },
  fontFamily: { type: String },
  textAlign: { type: String },
  isBold: { type: Boolean },
  isItalic: { type: Boolean },
  isUnderlined: { type: Boolean },
  color: { type: String },
  // Image-specific properties
  src: { type: String },
  alt: { type: String },
  // Shape-specific properties
  shapeType: { type: String }, // rectangle, circle, etc.
  backgroundColor: { type: String },
  borderColor: { type: String },
  borderWidth: { type: Number },
  // Common style properties
  opacity: { type: Number },
  rotation: { type: Number },
  zIndex: { type: Number },
}, { _id: false }); // Don't generate MongoDB _id for nested elements

// Define the schema for pages/artboards in a template
const PageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String },
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: { type: String, required: true }
  },
  thumbnail: { type: String },
  elements: [ElementSchema],
  background: {
    type: { type: String, enum: ['color', 'image', 'gradient'], default: 'color' },
    value: { type: String, default: '#ffffff' }
  }
}, { _id: false }); // Don't generate MongoDB _id for nested pages

// Design specification schema (nested object for hierarchical design types)
const DesignSpecSchema = new mongoose.Schema({
  mainType: {
    type: String,
    enum: ['social', 'presentation', 'print', 'custom'],
    required: true
  },
  platform: {
    type: String // e.g., 'instagram', 'facebook', 'widescreen', 'document'
  },
  format: {
    type: String // e.g., 'post', 'story', 'standard', 'a4'
  },
  category: {
    type: String // e.g., 'marketing', 'stationery' for print designs
  },
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: { type: String, required: true }
  }
}, { _id: false });

// Main template schema
const TemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['presentation', 'social', 'print', 'custom'],
    default: 'custom'
  },
  category: {
    type: String,
    required: true,
    enum: ['marketing', 'education', 'events', 'personal', 'other']
  },
  thumbnail: {
    type: String
  },
  previewImages: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  author: {
    type: String, // User ID of the creator
    required: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  popular: {
    type: Boolean,
    default: false
  },
  pages: [PageSchema],
  
  // Legacy dimensions field for backward compatibility
  dimensions: {
    width: { type: Number },
    height: { type: Number },
    aspectRatio: { type: String }
  },
  
  // New hierarchical design specification (replaces simple dimensions)
  designSpec: DesignSpecSchema,
  
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

module.exports = mongoose.model('Template', TemplateSchema);