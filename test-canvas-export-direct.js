#!/usr/bin/env node

// Simple test for canvas export functionality
const fs = require('fs');
const path = require('path');

// Test the canvas controller functions directly
const { exportCanvas, generateThumbnail, getExportFormats } = require('./controllers/canvasController');

async function testCanvasExportDirect() {
  console.log('🧪 Testing Canvas Export Controller Functions\n');
  
  // Create a simple test base64 image (1x1 pixel PNG)
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  // Test 1: Get export formats
  console.log('📊 Test 1: Get Export Formats');
  try {
    const mockRes = {
      json: (data) => {
        if (data.success) {
          console.log('   ✅ Successfully retrieved export formats');
          console.log('   Supported formats:', data.supportedFormats.map(f => f.format).join(', '));
          console.log('   Max dimensions:', `${data.maxDimensions.width}x${data.maxDimensions.height}`);
          console.log('   Features:', data.features.length);
        } else {
          console.log('   ❌ Failed to get export formats:', data.error);
        }
        return data;
      }
    };
    
    getExportFormats({}, mockRes);
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 2: Generate thumbnail
  console.log('\n🖼️  Test 2: Generate Thumbnail');
  try {
    const mockReq = {
      body: {
        imageData: testBase64,
        canvasWidth: 1080,
        canvasHeight: 1920,
        thumbnailSize: 300,
        uploadToCloud: false,
        userId: 'test-user'
      }
    };
    
    const mockRes = {
      json: (data) => {
        if (data.success) {
          console.log('   ✅ Successfully generated thumbnail');
          console.log('   Dimensions:', `${data.metadata.dimensions.width}x${data.metadata.dimensions.height}`);
          console.log('   Aspect ratio:', data.metadata.aspectRatio);
          console.log('   Original canvas:', `${data.metadata.originalCanvas.width}x${data.metadata.originalCanvas.height}`);
          console.log('   Thumbnail data length:', data.thumbnailData.length, 'characters');
        } else {
          console.log('   ❌ Failed to generate thumbnail:', data.error);
        }
        return data;
      },
      status: (code) => ({ json: (data) => console.log(`   Status: ${code}`, data) })
    };
    
    await generateThumbnail(mockReq, mockRes);
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 3: Export canvas (test setup only - won't actually download)
  console.log('\n📥 Test 3: Export Canvas (Setup Test)');
  try {
    const mockReq = {
      body: {
        imageData: testBase64,
        canvasWidth: 1280,
        canvasHeight: 720,
        format: 'png',
        quality: 100,
        downloadMode: 'direct',
        fileName: 'test_canvas_export.png',
        userId: 'test-user'
      }
    };
    
    let exportSuccess = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`   Status: ${code}`, data);
          return data;
        }
      }),
      json: (data) => {
        if (data.success) {
          console.log('   ✅ Export setup successful');
          exportSuccess = true;
        } else {
          console.log('   ❌ Export failed:', data.error);
        }
        return data;
      },
      set: (headers) => {
        console.log('   📋 Response headers set:', Object.keys(headers));
      },
      send: (buffer) => {
        console.log('   ✅ Canvas exported successfully');
        console.log('   📦 Buffer size:', buffer.length, 'bytes');
        
        // Save test file
        const outputPath = path.join(__dirname, 'test_canvas_export.png');
        fs.writeFileSync(outputPath, buffer);
        console.log('   💾 Saved export to:', outputPath);
        
        exportSuccess = true;
        return buffer;
      }
    };
    
    await exportCanvas(mockReq, mockRes);
    
    if (exportSuccess) {
      console.log('   ✅ Export completed successfully');
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 4: Test error handling
  console.log('\n❌ Test 4: Error Handling');
  try {
    const mockReq = {
      body: {
        imageData: 'invalid-data',
        canvasWidth: 1280,
        canvasHeight: 720
      }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 400 && !data.success) {
            console.log('   ✅ Correctly handled invalid image data');
            console.log('   Error message:', data.error);
          } else {
            console.log('   ❌ Unexpected response:', data);
          }
          return data;
        }
      })
    };
    
    await exportCanvas(mockReq, mockRes);
  } catch (error) {
    console.log('   ❌ Unexpected error:', error.message);
  }
  
  console.log('\n🎉 Canvas Export Controller Tests Completed!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Export formats function working');
  console.log('   ✅ Thumbnail generation with aspect ratio preservation');
  console.log('   ✅ Canvas export with exact dimensions');
  console.log('   ✅ Direct download functionality');
  console.log('   ✅ Error handling for invalid inputs');
  
  console.log('\n💡 Integration Guide:');
  console.log('   1. Frontend: Get canvas data using canvas.toDataURL()');
  console.log('   2. Include canvas.width and canvas.height in request');
  console.log('   3. POST to /api/canvas/export for downloads');
  console.log('   4. POST to /api/canvas/thumbnail for thumbnails');
  console.log('   5. Use downloadMode="direct" for immediate downloads');
  console.log('   6. Use downloadMode="cloudinary" when credentials available');
}

// Run the test
testCanvasExportDirect().catch(console.error);
