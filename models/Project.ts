import { Project } from "@canva-clone/shared-types/dist/models/project";
import { Page, Element } from "@canva-clone/shared-types";
import mongoose from "mongoose";
const { Schema, model, Document } = mongoose;

type ProjectDocument = Project;

// Define the schema for individual elements in a project
const ElementSchema = new Schema<Element>({
  id: { type: String, required: true },
  type: { type: String, required: true }, // text, image, shape, etc.
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  content: { type: String },
  fontSize: { type: Number },
  fontFamily: { type: String },
  textAlign: { type: String },
  isBold: { type: Boolean },
  isItalic: { type: Boolean },
  isUnderlined: { type: Boolean },
  backgroundColor: { type: String },
  borderColor: { type: String },
  borderWidth: { type: Number },
  rotation: { type: Number },
}, { _id: false }); // Don't generate MongoDB _id for nested elements

// Define the schema for pages/artboards in a project
const PageSchema = new Schema<Page>({
  id: { type: String, required: true },
  canvas: {
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      aspectRatio: { type: String, required: true },
    },
    background: {
      type: { type: String, enum: ['color', 'image', 'gradient'], default: 'color' },
      value: { type: String, default: '#ffffff' } // Default to white background
    },
    elements: [ElementSchema], // Array of elements on the page
  },
  thumbnail: { type: String },
}, { _id: false }); // Don't generate MongoDB _id for nested pages

// Main project schema
const ProjectSchema = new Schema<ProjectDocument>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    required: true
  },
  thumbnail: {
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
  pages: [PageSchema],

}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

module.exports = mongoose.models.Project || mongoose.model('Project', ProjectSchema);