import mongoose from "mongoose";

const baseOptions = { _id:false, discriminatorKey:'kind' };

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

const TextElementSchema  = new mongoose.Schema({
  content:    String,
  fontSize:   Number,
  fontFamily: String,
  textAlign:  { type: String, enum:['left','center','right'] },
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
  shapeType:      { type: String, enum:['rect','circle','triangle'] },
  backgroundColor:String,
  borderColor:    String,
  borderWidth:    Number
}, baseOptions);


const ElementModel = mongoose.model('Element', BaseElementSchema);
ElementModel.discriminator('text',  TextElementSchema);
ElementModel.discriminator('image', ImageElementSchema);
ElementModel.discriminator('shape', ShapeElementSchema);

export default ElementModel;