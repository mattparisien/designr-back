import mongoose, { Schema, Document, Model } from 'mongoose';

// Define interface for better TypeScript support
interface IFolder extends Document {
  name: string;
  description?: string;
  userId: string;
  parentId?: string;
  slug: string;
  color?: string;
  isStarred: boolean;
  projectCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IFolderModel extends Model<IFolder> {
  findBySlug(slug: string, userId: string): Promise<IFolder | null>;
}

const FolderSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    trim: true,
    // This will be auto-generated from the name
  },
  userId: {
    type: String,
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null // null means it's a root folder
  },
  path: {
    type: String, 
    default: '/' // Stores a path like /root/subfolder for easy navigation
  },
  paths: {
    type: [String],
    default: [] // Stores path segments split by '/' for easy traversal
  },
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: String // List of user IDs the folder is shared with
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt fields
});

// Generate slug from name before saving
FolderSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name.toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
  next();
});

// Index for faster lookups by userId and parentId
FolderSchema.index({ userId: 1, parentId: 1 });
// Index for path-based lookups
FolderSchema.index({ path: 1 });
// Index for slug-based lookups
FolderSchema.index({ slug: 1, userId: 1 });
// Index to ensure folder names are unique per user and parent folder (case-insensitive)
FolderSchema.index({ name: 1, userId: 1, parentId: 1 }, { 
  unique: true,
  collation: { locale: 'en', strength: 2 } // strength: 2 makes it case-insensitive
});

// Static method to find a folder by slug
FolderSchema.statics.findBySlug = function(slug, userId) {
  return this.findOne({ slug, userId });
};

// Method to build the folder path based on parent folders
FolderSchema.methods.buildPath = async function() {
  // Make sure we have a slug before building the path
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  if (!this.parentId) {
    this.path = '/' + (this.slug || 'root');
    return;
  }
  
  let parentFolder = await mongoose.model('Folder').findById(this.parentId);
  if (parentFolder) {
    this.path = parentFolder.path + '/' + (this.slug || 'folder');
  } else {
    this.path = '/' + (this.slug || 'folder');
  }
};

module.exports = mongoose.model('Folder', FolderSchema);