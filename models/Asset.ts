import { Asset } from '@canva-clone/shared-types/dist/models/asset';
import mongoose from 'mongoose';
const { Schema, model, Document } = mongoose;

export interface AssetDocument
  extends Asset,
  Document {
}

const AssetSchema = new Schema<AssetDocument>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalFilename: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null // null means it's in the root directory
  },
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'font', 'other'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // size in bytes
    required: true
  },
  url: {
    type: String, // URL to the file in storage
    required: true
  },
  cloudinaryId: {
    type: String // Cloudinary public_id for the asset
  },
  cloudinaryUrl: {
    type: String // Full Cloudinary URL for the asset
  },
  gridFsId: {
    type: mongoose.Schema.Types.ObjectId // GridFS file ID if using GridFS for storage
  },
  thumbnail: {
    type: String // URL to thumbnail for images/videos
  },
  thumbnailCloudinaryId: {
    type: String // Cloudinary public_id for the thumbnail
  },

  // Media-specific properties
  width: {
    type: Number // Image/video width
  },
  height: {
    type: Number // Image/video height
  },
  duration: {
    type: Number // Video/audio duration in seconds
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {} // Store additional info like image dimensions, duration, etc.
  },
  tags: [{
    type: String,
    trim: true
  }],
  vectorized: {
    type: Boolean,
    default: false // Track if asset has been added to vector store
  },
  vectorLastUpdated: {
    type: Date // Track when vector was last updated
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt fields
});

// Index for faster lookups by userId and folderId
AssetSchema.index({ userId: 1, folderId: 1 });
// Index for type filtering
AssetSchema.index({ type: 1 });
// Index for text search
AssetSchema.index({ name: 'text', tags: 'text' });

export default mongoose.model('Asset', AssetSchema);