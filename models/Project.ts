import { Project } from "@canva-clone/shared-types/dist/models/project";
import mongoose from "mongoose";
import { BaseProjectSchema, PageSchema } from "./shared/ProjectSchemas.js";

const { Schema, model, Document } = mongoose;

export interface ProjectDocument extends Omit<Project, 'id'>, Document {}

// Main project schema using shared base schema
const ProjectSchema = new Schema<ProjectDocument>({
  ...BaseProjectSchema,
  isTemplate: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

export default mongoose.model<ProjectDocument>('Project', ProjectSchema);