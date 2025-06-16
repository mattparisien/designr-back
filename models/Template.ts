import mongoose from "mongoose";
import { Template } from "@canva-clone/shared-types/dist/models/project";
import { BaseProjectSchema } from "./shared/ProjectSchemas.js";

// Template document interface
interface TemplateDocument extends Omit<Template, 'id'>, mongoose.Document {}

const { Schema } = mongoose;

// Template schema - same as Project but with isTemplate: true and template-specific fields
const TemplateSchema = new Schema<TemplateDocument>({
  ...BaseProjectSchema,
  isTemplate: {
    type: Boolean,
    default: true,
    required: true
  },
  // Template-specific fields
  author: {
    type: String,
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
  previewImages: [{
    type: String
  }],
}, {
  timestamps: true,
});

export default mongoose.model<TemplateDocument>('Template', TemplateSchema);