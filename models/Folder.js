const mongoose = require('mongoose');
const { Schema } = mongoose;

const FolderSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
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

// Index for faster lookups by userId and parentId
FolderSchema.index({ userId: 1, parentId: 1 });
// Index for path-based lookups
FolderSchema.index({ path: 1 });

module.exports = mongoose.model('Folder', FolderSchema);