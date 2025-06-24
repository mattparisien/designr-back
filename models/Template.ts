/* --------------------------------------------------------------
 * Template model – token‑driven design schema
 * --------------------------------------------------------------*/
import mongoose, { InferSchemaType } from 'mongoose';

/* -------------------------------------------------- *
 * Helper sub‑schemas for token definitions
 * -------------------------------------------------- */
const SimpleTokenSchema = new mongoose.Schema({
  default: { type: String, required: true }
}, { _id: false });

const CopyTokenSchema = new mongoose.Schema({
  default: { type: String, required: true },
  required: { type: Boolean, default: false },
  maxLength: { type: Number }
}, { _id: false });

/* -------------------------------------------------- *
 * Main template schema
 * -------------------------------------------------- */
const TemplateSchema = new mongoose.Schema({
  /* 1️⃣  Retrieval metadata  */
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true },
  aspectRatio: { type: String, enum: ['1:1', '4:5', '9:16', '16:9'], required: true },
  categories:  [String],                  // “Retail”, “Food”, …
  tags:        [String],                  // “bold”, “pastel”
  embedding:   { type: [Number], required: true }, // 768 / 1536 floats
  popularity:  { type: Number, default: 0 },

  /* 2️⃣  Design variables (tokens)  */
  tokens: {
    colors: { type: Map, of: SimpleTokenSchema },   // colors.primary → "#FFAA00"
    fonts:  { type: Map, of: SimpleTokenSchema },   // fonts.primary → "Poppins"
    images: { type: Map, of: SimpleTokenSchema },   // images.hero  → CDN URL / asset id
    copy:   { type: Map, of: CopyTokenSchema }      // copy.headline → "Summer Sale"
  },

  /* 3️⃣  Design payload (layout reference & preview) */
  thumbnailUrl: { type: String },
  layoutId:     { type: mongoose.Types.ObjectId, ref: 'Layout', required: true },

  /* 4️⃣  Lifecycle  */
  status:  { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
  version: { type: Number, default: 1 }
}, { timestamps: true });

/* -------------------------------------------------- *
 * Indexes – createSearchIndex (Atlas) or external vector DB
 * -------------------------------------------------- */
// Example Atlas vector index (run once via admin script):
// TemplateSchema.index({ embedding: 'vector', dims: 1536, similarity: 'cosine' });

export type Template = InferSchemaType<typeof TemplateSchema>;
export default mongoose.model('Template', TemplateSchema);
