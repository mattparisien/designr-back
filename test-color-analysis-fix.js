// test-color-analysis-fix.js
// A focused test script to verify the fixed color analysis functionality

const ImageAnalysisService = require('./services/imageAnalysisService');
const fs = require('fs');
const path = require('path');
const imageAnalysisService = require('./services/imageAnalysisService');

// Test images to try (in order of preference)
const TEST_IMAGES = [
  './test_export.png',
  './test_youtube.jpg', 
  './assets/screenshot.png',
  'https://images.unsplash.com/photo-1616587894289-86480e533129'  // Fallback to an online image
];

async function testColorAnalysis() {
  console.log('🧪 Testing Fixed Color Analysis');
  console.log('=================================');
  
  // Create image analysis service
  const service = imageAnalysisService;
  
  try {
    // Initialize the service (will set up OpenAI client)
    await service.initialize();
    console.log('✅ Service initialized successfully');
    
    // Find a valid test image
    let testImage = null;
    let imageType = null;
    
    for (const img of TEST_IMAGES) {
      if (img.startsWith('http')) {
        testImage = img;
        imageType = 'URL';
        console.log(`🔍 Using remote test image: ${img}`);
        break;
      } else if (fs.existsSync(img)) {
        testImage = path.resolve(img);
        imageType = 'File';
        console.log(`🔍 Using local test image: ${img}`);
        break;
      }
    }
    
    if (!testImage) {
      console.error('❌ No test images found. Please provide a valid image path or URL.');
      process.exit(1);
    }
    
    // Run the color analysis
    console.log(`🎨 Running color analysis on ${imageType}...`);
    const startTime = Date.now();
    
    try {
      const colorAnalysis = await service.analyzeImageColors(testImage);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Color analysis successful (${duration}ms):`);
      console.log(JSON.stringify(colorAnalysis, null, 2));
      
      // Validate the results
      const requiredFields = [
        'backgroundColor', 'dominantColors', 'textColors', 
        'colorScheme', 'styleCharacteristics'
      ];
      
      const missingFields = requiredFields.filter(field => !colorAnalysis[field]);
      
      if (missingFields.length > 0) {
        console.warn(`⚠️  Warning: Missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ All required fields are present');
      }
      
    } catch (error) {
      console.error('❌ Color analysis failed:', error);
      console.error(error.stack);
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    console.error(error.stack);
  }
}

// Execute the test if this script is run directly
if (require.main === module) {
  testColorAnalysis()
    .then(() => {
      console.log('🏁 Test completed');
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
    });
}

module.exports = testColorAnalysis;
