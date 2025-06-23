
import mongoose from 'mongoose';

// Define element schema directly here since Element.ts exports a model, not a schema
const BaseElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  kind: { type: String, required: true }, // discriminator key
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  rotation: { type: Number, default: 0 },
  opacity: { type: Number, default: 1 },
  zIndex: { type: Number, default: 0 },
  // Additional fields that might be present
  content: String,
  fontSize: Number,
  fontFamily: String,
  textAlign: String,
  bold: Boolean,
  italic: Boolean,
  underline: Boolean,
  color: String,
  src: String,
  alt: String,
  shapeType: String,
  backgroundColor: String,
  borderColor: String,
  borderWidth: Number
}, { _id: false });

const PageSchema = new mongoose.Schema({
  name: String,
  canvas: { width: Number, height: Number },
  background: {
    type: { type: String, enum:['color','image','gradient'], default:'color' },
    value: String
  },
  elements: [BaseElementSchema]
}, { _id:false });

const LayoutSchema = new mongoose.Schema({
  pages: [PageSchema]
});

export default mongoose.model('Layout', LayoutSchema);
