
import mongoose, { InferSchemaType } from 'mongoose';
import { BaseElementSchema } from './Element';


const PageSchema = new mongoose.Schema({
  name: String,
  canvas: { width: Number, height: Number },
  background: {
    type: { type: String, enum: ['color', 'image', 'gradient'], default: 'color' },
    value: String
  },
  elements: [BaseElementSchema]
}, { _id: false });

const LayoutSchema = new mongoose.Schema({
  pages: [PageSchema]
});

export type Layout = InferSchemaType<typeof LayoutSchema>;

export default mongoose.model('Layout', LayoutSchema);
