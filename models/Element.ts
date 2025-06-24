import mongoose, { InferSchemaType } from "mongoose";

const baseOptions = { _id: false, discriminatorKey: 'kind' };

const BaseElementSchema = new mongoose.Schema({
  id:      { type: String, required: true },
  x:       { type: Number, required: true },
  y:       { type: Number, required: true },
  width:   { type: Number, required: true },
  height:  { type: Number, required: true },
  rotation:{ type: Number, default: 0 },
  opacity: { type: Number, default: 1 },
  zIndex:  { type: Number, default: 0 }
}, baseOptions);

const TextElementSchema = new mongoose.Schema({
  content:    String,
  fontSize:   Number,
  fontFamily: String,
  textAlign:  { type: String, enum: ['left', 'center', 'right'] },
  bold:       Boolean,
  italic:     Boolean,
  underline:  Boolean,
  color:      String
}, baseOptions);

const ImageElementSchema = new mongoose.Schema({
  src: String,
  alt: String
}, baseOptions);

const ShapeElementSchema = new mongoose.Schema({
  shapeType:      { type: String, enum: ['rect', 'circle', 'triangle'] },
  backgroundColor: String,
  borderColor:     String,
  borderWidth:     Number
}, baseOptions);

// Create the model
const ElementModel = mongoose.model('Element', BaseElementSchema);
ElementModel.discriminator('text', TextElementSchema);
ElementModel.discriminator('image', ImageElementSchema);
ElementModel.discriminator('shape', ShapeElementSchema);

// Export types
export type BaseElement = InferSchemaType<typeof BaseElementSchema>;
export type TextElement = InferSchemaType<typeof TextElementSchema> & BaseElement & { kind: 'text' };
export type ImageElement = InferSchemaType<typeof ImageElementSchema> & BaseElement & { kind: 'image' };
export type ShapeElement = InferSchemaType<typeof ShapeElementSchema> & BaseElement & { kind: 'shape' };
export type Element = TextElement | ImageElement | ShapeElement;

// Export the model
export default ElementModel;

// Export schemas if needed elsewhere
export { BaseElementSchema, TextElementSchema, ImageElementSchema, ShapeElementSchema };