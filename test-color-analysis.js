// test-color-analysis.js - Test the new color analysis functionality
const ImageAnalysisService = require('./services/imageAnalysisService');
const path = require('path');
const fs = require('fs');

async function testColorAnalysis() {
  console.log('🧪 Testing Color Analysis Service');
  
  const service = new ImageAnalysisService();
  
  try {
    // Initialize the service
    await service.initialize();
    console.log('✅ Service initialized successfully');
    
    // Check if we have any test images
    const testImagePaths = [
      './test_youtube.jpg',
      './test_export.png',
      './assets/screenshot.png'
    ];
    
    let testImagePath = null;
    for (const imagePath of testImagePaths) {
      if (fs.existsSync(imagePath)) {
        testImagePath = imagePath;
        break;
      }
    }
    
    if (!testImagePath) {
      console.log('⚠️  No test images found. Skipping color analysis test.');
      console.log('   Available test paths searched:', testImagePaths);
      return;
    }
    
    console.log(`🔍 Testing with image: ${testImagePath}`);
    
    // Run color analysis
    const colorAnalysis = await service.analyzeImageColors(testImagePath);
    
    console.log('🎨 Color Analysis Results:');
    console.log('  Background Color:', colorAnalysis.backgroundColor);
    console.log('  Background Style:', colorAnalysis.backgroundStyle);
    console.log('  Dominant Colors:', colorAnalysis.dominantColors);
    console.log('  Text Colors:', colorAnalysis.textColors);
    console.log('  Accent Colors:', colorAnalysis.accentColors);
    console.log('  Color Scheme:', colorAnalysis.colorScheme);
    console.log('  Style Characteristics:', colorAnalysis.styleCharacteristics);
    console.log('  Has Background Image:', colorAnalysis.hasBackgroundImage);
    console.log('  Contrast Level:', colorAnalysis.contrastLevel);
    console.log('  Color Temperature:', colorAnalysis.colorTemperature);
    
    if (colorAnalysis.error) {
      console.log('  Error:', colorAnalysis.error);
    }
    
    console.log('✅ Color analysis completed successfully');
    
  } catch (error) {
    console.error('❌ Color analysis test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testColorAnalysis()
    .then(() => {
      console.log('🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testColorAnalysis };
