import mongoose, { InferSchemaType } from 'mongoose';

/* ------------ project.model.ts ------------ */
const ProjectSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: String,
  type:        { type: String, enum: ['presentation','social','print','custom'], default: 'custom' },
  thumbnail:   String,
  tags:        [String],
  ownerId:     { type: mongoose.Types.ObjectId, index: true },
  starred:     { type: Boolean, default: false },
  sharedWith:  [mongoose.Types.ObjectId],
  layoutId:    { type: mongoose.Types.ObjectId, ref: 'Layout', required: true },

  // template linkage (if it was duplicated from one)
  sourceTemplateId: { type: mongoose.Types.ObjectId, ref: 'Template' }
}, { timestamps: true });

// Create the model
const ProjectModel = mongoose.model('Project', ProjectSchema);

// Export the inferred type
export type Project = InferSchemaType<typeof ProjectSchema>;

// Export the document type (includes Mongoose methods)
export type ProjectDocument = InstanceType<typeof ProjectModel>;

export default ProjectModel;