import multer from 'multer';
import { storage } from '../config/db.js'; // Assuming db.js exports 'storage' for multer

// Initialize upload middleware with the GridFS storage engine
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
});

export default upload;
