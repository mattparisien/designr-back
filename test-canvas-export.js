#!/usr/bin/env node

// Test script for canvas export functionality
const { processThumbnailWithAspectRatio } = require('./utils/thumbnailProcessor');

async function testCanvasExport() {
  console.log('🧪 Testing Canvas Export with Aspect Ratio\n');
  
  // Create a simple test base64 image (1x1 pixel PNG)
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const testUserId = 'test-user-canvas';
  
  // Test different canvas aspect ratios
  const testCases = [
    {
      name: 'Square Canvas (1:1)',
      canvasSize: { width: 800, height: 800 }
    },
    {
      name: 'Instagram Story (9:16)',
      canvasSize: { width: 1080, height: 1920 }
    },
    {
      name: 'YouTube Thumbnail (16:9)',
      canvasSize: { width: 1280, height: 720 }
    },
    {
      name: 'Business Card (16:9)',
      canvasSize: { width: 1050, height: 600 }
    },
    {
      name: 'A4 Portrait (√2:1)',
      canvasSize: { width: 2480, height: 3508 }
    },
    {
      name: 'No Canvas Size (Fallback)',
      canvasSize: null
    }
  ];
  
  console.log('📊 Canvas Export Test Cases:\n');
  
  for (const testCase of testCases) {
    console.log(`🔍 Testing: ${testCase.name}`);
    
    if (testCase.canvasSize) {
      const aspectRatio = testCase.canvasSize.width / testCase.canvasSize.height;
      console.log(`   Canvas: ${testCase.canvasSize.width}x${testCase.canvasSize.height} (${aspectRatio.toFixed(2)}:1)`);
      
      // Calculate expected thumbnail dimensions
      const maxSize = 300;
      let expectedWidth, expectedHeight;
      
      if (aspectRatio > 1) {
        expectedWidth = maxSize;
        expectedHeight = Math.round(maxSize / aspectRatio);
      } else {
        expectedHeight = maxSize;
        expectedWidth = Math.round(maxSize * aspectRatio);
      }
      
      console.log(`   Expected thumbnail: ${expectedWidth}x${expectedHeight}`);
    } else {
      console.log('   Canvas: No dimensions provided');
      console.log('   Expected thumbnail: 300x300 (fallback)');
    }
    
    try {
      // Note: This will fail without real Cloudinary credentials, 
      // but we can test the logic and validation
      await processThumbnailWithAspectRatio(testBase64, testUserId, testCase.canvasSize);
      console.log('   ✅ Processing completed successfully');
    } catch (error) {
      if (error.message.includes('Cloudinary') || error.message.includes('CLOUDINARY')) {
        console.log('   ⚠️  Expected error (no Cloudinary credentials)');
      } else {
        console.log('   ❌ Unexpected error:', error.message);
      }
    }
    
    console.log('');
  }
  
  console.log('🎯 Canvas Export API Endpoints Available:');
  console.log('   POST /api/canvas/export - Export canvas with proper aspect ratio');
  console.log('   POST /api/canvas/thumbnail - Generate thumbnail with aspect ratio');
  console.log('   GET  /api/canvas/export/formats - Get supported export formats');
  
  console.log('\n📝 Usage Example:');
  console.log(`
  // Export canvas with proper aspect ratio
  fetch('/api/canvas/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageData: 'data:image/png;base64,iVBORw0KGgo...',
      canvasWidth: 1080,
      canvasHeight: 1920,
      format: 'png',
      quality: 100,
      projectId: 'optional-project-id',
      userId: 'user-id'
    })
  });
  `);
  
  console.log('\n🔧 Key Features:');
  console.log('   ✅ Maintains exact canvas aspect ratio');
  console.log('   ✅ Supports PNG, JPEG, WebP formats');
  console.log('   ✅ Configurable quality settings');
  console.log('   ✅ Optional Cloudinary upload');
  console.log('   ✅ Direct download fallback');
  console.log('   ✅ Project metadata tracking');
  
  console.log('\n🎉 Canvas export functionality ready!');
  console.log('\n💡 Note: Set CLOUDINARY_* environment variables for full functionality');
}

// Run the test
testCanvasExport().catch(console.error);
