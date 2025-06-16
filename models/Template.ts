import mongoose from "mongoose";
import { Template } from "@canva-clone/shared-types/dist/models/project";
import { BaseProjectSchema } from "./shared/ProjectSchemas.js";

// Template document interface
interface TemplateDocument extends Template, mongoose.Document {}

const { Schema } = mongoose;

// Template schema - same as Project but with isTemplate: true and template-specific fields
const TemplateSchema = new Schema<TemplateDocument>({
  ...BaseProjectSchema,
  isTemplate: {
    type: Boolean,
    default: true,
    required: true
  },
}, {
  timestamps: true,
});

export default mongoose.model<TemplateDocument>('Template', TemplateSchema);