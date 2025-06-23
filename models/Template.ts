/* ------------ template.model.ts ------------ */

import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
  /* 1️⃣  Retrieval metadata  */
  title:  { type: String, required: true, trim: true },
  slug:   { type: String, required: true, unique: true },
  aspectRatio: { type: String, enum: ['1:1','4:5','9:16','16:9'], required: true },
  categories:  [String],          // “Retail”, “Food”, …
  tags:        [String],          // “bold”, “pastel”
  embedding:   { type: [Number],  required: true },   // 768/1536 floats
  popularity:  { type: Number,    default: 0 },

  /* 2️⃣  Design payload  */
  thumbnailUrl: String,
  layoutId:     { type: mongoose.Types.ObjectId, ref: 'Layout' },

  /* 3️⃣  Lifecycle */
  status: { type: String, enum: ['draft','active','archived'], default: 'active' },
  version: { type: Number, default: 1 }
}, { timestamps: true });

// Note: Vector index should be created separately in Pinecone, not in MongoDB
// TemplateSchema.index({ embedding: 'vector', dims: 1536, similarity: 'cosine' });

export default mongoose.model('Template', TemplateSchema);