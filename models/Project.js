const mongoose = require('mongoose');

// Define the schema for individual elements in a project
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

// Define the schema for pages/artboards in a project
const PageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String },
  canvasSize: {
    name: { type: String },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  thumbnail: { type: String },
  elements: [ElementSchema],
  background: {
    type: { type: String, enum: ['color', 'image', 'gradient'], default: 'color' },
    value: { type: String, default: '#ffffff' }
  }
}, { _id: false }); // Don't generate MongoDB _id for nested pages

// Main project schema
const ProjectSchema = new mongoose.Schema({
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
  thumbnail: {
    type: String
  },
  category: {
    type: String
  },
  tags: [{
    type: String
  }],
  starred: {
    type: Boolean,
    default: false
  },
  shared: {
    type: Boolean,
    default: false
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: String
  }],
  pages: [PageSchema],
  canvasSize: {
    name: { type: String },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

module.exports = mongoose.model('Project', ProjectSchema);