import mongoose from "mongoose";
import { Page, Element } from "@canva-clone/shared-types";

const { Schema } = mongoose;

// Shared Element schema for both Projects and Templates
export const ElementSchema = new Schema<Element>({
  id: { type: String, required: true },
  type: { type: String, required: true },
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
}, { _id: false });

// Shared Page schema for both Projects and Templates
export const PageSchema = new Schema<Page>({
  id: { type: String, required: true },
  canvas: {
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      aspectRatio: { type: String, required: true },
    },
    background: {
      type: { type: String, enum: ['color', 'image', 'gradient'], default: 'color' },
      value: { type: String, default: '#ffffff' }
    },
    elements: [ElementSchema],
  },
  thumbnail: { type: String },
}, { _id: false });

// Base schema definition for Projects and Templates
export const BaseProjectSchema = {
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
  pages: [PageSchema],
};
