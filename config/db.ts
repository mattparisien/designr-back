import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { GridFsStorage } from 'multer-gridfs-storage';
import crypto from 'crypto';
import path from 'path';

let gridFsBucket: GridFSBucket | null = null;

// Main connectDB function for the application
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Attempting to connect to MongoDB...');
    
    // Connect to MongoDB
    const mongooseConnection = await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if the connection object and its critical properties are valid
    if (!mongooseConnection || !mongooseConnection.connection) {
      console.error('Mongoose connection object is invalid after connect attempt.');
      throw new Error('Mongoose connection object is invalid.');
    }
    
    const nativeDb = mongooseConnection.connection.db;
    const host = mongooseConnection.connection.host;
    const connectionState = mongooseConnection.connection.readyState;

    if (connectionState !== 1 || !nativeDb) {
      console.error(`MongoDB native 'db' object not found or connection not established. Host: ${host}, State: ${connectionState}. Ensure MongoDB is running and MONGODB_URI is correct.`);
      throw new Error("MongoDB native 'db' object not found or connection not established. GridFS cannot be initialized.");
    }
    
    // Initialize gridFsBucket here
    gridFsBucket = new GridFSBucket(nativeDb, {
      bucketName: 'uploads'
    });
    
    console.log('MongoDB connected successfully');
    console.log('GridFS bucket initialized for uploads');
    
    return mongoose.connection;
  } catch (error: any) {
    console.error(`MongoDB connection or GridFS setup error: ${error.message}`);
    console.error("Please ensure MONGODB_URI in your .env file is correct and the MongoDB server is running and accessible.");
    throw error;
  }
};

// Create storage engine for multer-gridfs-storage 
const createStorage = () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  return new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            console.error("Crypto randomBytes error during file naming:", err);
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
  });
};

// Lazy initialization of storage
let storage: GridFsStorage | null = null;
const getStorage = () => {
  if (!storage) {
    storage = createStorage();
  }
  return storage;
};

// Function to get the GridFSBucket instance
const getGridFsBucket = () => {
  if (!gridFsBucket) {
    throw new Error("GridFSBucket is not initialized. Make sure to call connectDB() first.");
  }
  return gridFsBucket;
};

export { connectDB, getStorage as storage, getGridFsBucket };
