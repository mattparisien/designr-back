// routes/ocr.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ocrService = require('../services/ocrService');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp-uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/ocr/analyze
 * Analyze an image URL with OCR
 */
router.post('/analyze', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    console.log(`🔍 Starting OCR analysis for URL: ${imageUrl}`);

    // Run OCR analysis
    const ocrResults = await ocrService.detectLines(imageUrl);

    // Get image dimensions
    let imageDimensions = null;
    try {
      const metadata = await sharp(imageUrl).metadata();
      imageDimensions = {
        width: metadata.width || 0,
        height: metadata.height || 0
      };
    } catch (dimError) {
      console.warn('Could not get image dimensions:', dimError.message);
    }

    console.log(`✅ OCR analysis completed. Found ${ocrResults.length} text blocks.`);

    res.json({
      success: true,
      ocrResults,
      imageDimensions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OCR analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'OCR analysis failed: ' + error.message
    });
  }
});

/**
 * POST /api/ocr/analyze-file
 * Analyze an uploaded file with OCR
 */
router.post('/analyze-file', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const filePath = req.file.path;
    console.log(`🔍 Starting OCR analysis for uploaded file: ${req.file.originalname}`);

    try {
      // Run OCR analysis on the uploaded file
      const ocrResults = await ocrService.detectLines(filePath);

      // Get image dimensions
      let imageDimensions = null;
      try {
        const metadata = await sharp(filePath).metadata();
        imageDimensions = {
          width: metadata.width || 0,
          height: metadata.height || 0
        };
      } catch (dimError) {
        console.warn('Could not get image dimensions:', dimError.message);
      }

      console.log(`✅ OCR analysis completed. Found ${ocrResults.length} text blocks.`);

      res.json({
        success: true,
        ocrResults,
        imageDimensions,
        filename: req.file.originalname,
        timestamp: new Date().toISOString()
      });

    } finally {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn('Could not clean up uploaded file:', cleanupError.message);
      }
    }

  } catch (error) {
    console.error('OCR file analysis error:', error);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not clean up uploaded file:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'OCR analysis failed: ' + error.message
    });
  }
});

/**
 * GET /api/ocr/status
 * Get OCR service status and capabilities
 */
router.get('/status', async (req, res) => {
  try {
    // Test if OCR service is available
    const isAvailable = typeof ocrService.detectLines === 'function';
    
    res.json({
      available: isAvailable,
      service: 'Tesseract.js',
      version: '5.x',
      languages: ['eng'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OCR status check error:', error);
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ocr/save-analysis
 * Save OCR analysis results to a local JSON file
 */
router.post('/save-analysis', async (req, res) => {
  try {
    const { ocrResults, imagePath, metadata } = req.body;

    if (!ocrResults || !Array.isArray(ocrResults)) {
      return res.status(400).json({
        success: false,
        error: 'OCR results array is required'
      });
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '..', 'ocr-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ocr-analysis-${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);

    // Prepare enhanced data
    const enhancedData = {
      metadata: {
        timestamp: new Date().toISOString(),
        imagePath: imagePath || 'unknown',
        totalBlocks: ocrResults.length,
        totalCharacters: ocrResults.reduce((sum, block) => sum + (block.text?.length || 0), 0),
        averageFontSize: ocrResults.length > 0 
          ? Math.round(ocrResults.reduce((sum, block) => sum + (block.fontPx || 0), 0) / ocrResults.length)
          : 0,
        ...metadata
      },
      ocrResults
    };

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2));

    console.log(`💾 OCR analysis saved to: ${outputPath}`);

    res.json({
      success: true,
      filename,
      path: outputPath,
      recordCount: ocrResults.length
    });

  } catch (error) {
    console.error('Save OCR analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save OCR analysis: ' + error.message
    });
  }
});

module.exports = router;
