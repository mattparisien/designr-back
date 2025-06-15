import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  googleId: {
    type: String,
    sparse: true
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  profilePictureUrl: { // To store the direct URL of the profile picture
    type: String,
    trim: true
  },
  profilePictureGridFsId: { // To store the GridFS file ID
    type: mongoose.Schema.Types.ObjectId 
  },
  company: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  
  // User role and status
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date
  },
  
  // Subscription information
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'team', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due', 'trialing'],
      default: 'active'
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      profilePublic: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false }
    },
    editor: {
      autoSave: { type: Boolean, default: true },
      snapToGrid: { type: Boolean, default: false },
      showRulers: { type: Boolean, default: true }
    }
  },
  
  // Usage statistics
  usage: {
    projectsCount: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in bytes
    storageLimit: { type: Number, default: 1073741824 }, // 1GB in bytes
    lastActiveAt: { type: Date }
  },
  
  // Social features
  social: {
    website: { type: String },
    twitter: { type: String },
    linkedin: { type: String },
    github: { type: String }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('User', userSchema);