import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { GridFsStorage } from 'multer-gridfs-storage';
import crypto from 'crypto';
import path from 'path';

let gridFsBucket; // To be initialized
let dbInstanceForStorage; // To store the native db instance for GridFsStorage

// Create a promise that resolves after attempting to connect to MongoDB and set up GridFS components
const dbInitializationPromise = mongoose.connect(process.env.MONGODB_URI)
  .then(mongooseConnection => { 
    // Check if the connection object and its critical properties are valid
    if (!mongooseConnection || !mongooseConnection.connection) {
      console.error('Mongoose connection object is invalid after connect attempt.');
      throw new Error('Mongoose connection object is invalid.');
    }
    const nativeDb = mongooseConnection.connection.db;
    const host = mongooseConnection.connection.host;
    const connectionState = mongooseConnection.connection.readyState; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting

    if (connectionState !== 1 || !nativeDb) {
      console.error(`MongoDB native 'db' object not found or connection not established. Host: ${host}, State: ${connectionState}. Ensure MongoDB is running and MONGODB_URI is correct.`);
      throw new Error("MongoDB native 'db' object not found or connection not established. GridFS cannot be initialized.");
    }
    
    // Initialize gridFsBucket here
    gridFsBucket = new GridFSBucket(nativeDb, {
      bucketName: 'uploads'
    });

    dbInstanceForStorage = nativeDb; // Store for GridFsStorage
    return dbInstanceForStorage; // Resolve with the native Db instance for GridFsStorage
  })
  .catch(error => {
    console.error(`MongoDB connection or GridFS setup error during initial setup: ${error.message}`);
    console.error("Please ensure MONGODB_URI in your .env file is correct and the MongoDB server is running and accessible.");
    // process.exit(1); // Consider exiting on critical failure
    throw error; // Re-throw to prevent app from starting in a bad state
  });

// Create storage engine for multer-gridfs-storage using the db promise
const storage = new GridFsStorage({
  db: dbInitializationPromise, // Use the promise that resolves to the Db instance
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
          bucketName: 'uploads' // Match the bucket name used in GridFSBucket
        };
        resolve(fileInfo);
      });
    });
  }
});

// Main connectDB function for the application (e.g., called in server.js)
// This function ensures the main DB initialization promise (including GridFS setup) has resolved.
const connectDB = async () => {
  try {
    // Await the main initialization promise. This ensures GridFS is also ready if connection was successful.
    await dbInitializationPromise;

    // Check Mongoose's global connection state after the promise has settled
    const currentState = mongoose.connection.readyState;
    if (currentState !== 1) { // 1 means connected
      console.error(`Mongoose connection not in 'connected' state after dbInitializationPromise. Current state: ${currentState}`);
      throw new Error(`Mongoose connection not ready. State: ${currentState}`);
    }
        
    // Verify gridFsBucket is available (it should have been set by dbInitializationPromise's .then block)
    if (!gridFsBucket) {
      // This case implies dbInitializationPromise resolved, but gridFsBucket wasn't set,
      // which would mean the nativeDb object was missing even if the connection seemed okay.
      // The checks within dbInitializationPromise should prevent this.
      console.error('CRITICAL: GridFSBucket was not initialized by dbInitializationPromise, though the promise may have resolved without erroring earlier. This indicates an issue with obtaining the native DB object.');
      throw new Error('GridFSBucket initialization failed despite the DB connection promise resolving. Check logs for native DB object issues.');
    }
    return mongoose.connection; // Return the Mongoose default connection object
  } catch (error) {
    // This catch block will handle errors from dbInitializationPromise if it rejects,
    // or errors from the checks within this function.
    console.error(`Error in connectDB function (called by server.js): ${error.message}`);
    // process.exit(1); // Consider exiting on critical failure
    throw error; // Re-throw so server.js can catch it and not start
  }
};

export { connectDB };
export const getGridFsBucket = () => {
  if (!gridFsBucket) {
    // This might be called if routes are accessed before connectDB() fully completes or if initialization failed.
    console.error("getGridFsBucket: Attempted to access GridFSBucket, but it's not initialized. Ensure connectDB() in server.js completes successfully before handling requests.");
    // Depending on desired behavior, could throw or return undefined.
    // Throwing an error is safer to prevent further issues.
    throw new Error("GridFSBucket is not initialized. Check server startup logs.");
  }
  return gridFsBucket;
};

export { storage };