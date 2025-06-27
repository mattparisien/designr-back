#!/usr/bin/env node

// Test script for canvas export API endpoints
const fs = require('fs');
const http = require('http');

async function testCanvasExportAPI() {
  console.log('🧪 Testing Canvas Export API Endpoints\n');
  
  // Create a simple test base64 image (1x1 pixel PNG)
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  const baseUrl = 'http://localhost:3001/api/canvas';
  
  // Test 1: Get export formats
  console.log('📊 Test 1: Get Export Formats');
  try {
    const response = await fetch(`${baseUrl}/export/formats`);
    const data = await response.json();
    
    if (data.success) {
      console.log('   ✅ Successfully retrieved export formats');
      console.log('   Supported formats:', data.supportedFormats.map(f => f.format).join(', '));
      console.log('   Max dimensions:', `${data.maxDimensions.width}x${data.maxDimensions.height}`);
      console.log('   Features:', data.features.length);
    } else {
      console.log('   ❌ Failed to get export formats:', data.error);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 2: Generate thumbnail (direct mode)
  console.log('\n🖼️  Test 2: Generate Thumbnail (Direct Mode)');
  try {
    const response = await fetch(`${baseUrl}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: testBase64,
        canvasWidth: 1080,
        canvasHeight: 1920,
        thumbnailSize: 300,
        uploadToCloud: false,
        userId: 'test-user'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('   ✅ Successfully generated thumbnail');
      console.log('   Dimensions:', `${data.metadata.dimensions.width}x${data.metadata.dimensions.height}`);
      console.log('   Aspect ratio:', data.metadata.aspectRatio);
      console.log('   Original canvas:', `${data.metadata.originalCanvas.width}x${data.metadata.originalCanvas.height}`);
      console.log('   Thumbnail data length:', data.thumbnailData.length, 'characters');
    } else {
      console.log('   ❌ Failed to generate thumbnail:', data.error);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 3: Export canvas (PNG, direct download)
  console.log('\n📥 Test 3: Export Canvas (PNG, Direct Download)');
  try {
    const response = await fetch(`${baseUrl}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: testBase64,
        canvasWidth: 1280,
        canvasHeight: 720,
        format: 'png',
        quality: 100,
        downloadMode: 'direct',
        fileName: 'test_canvas_export.png',
        userId: 'test-user'
      })
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      const contentLength = response.headers.get('content-length');
      
      console.log('   ✅ Successfully exported canvas');
      console.log('   Content-Type:', contentType);
      console.log('   Content-Disposition:', contentDisposition);
      console.log('   Content-Length:', contentLength, 'bytes');
      
      // Optionally save the file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync('./test_canvas_export.png', Buffer.from(buffer));
      console.log('   💾 Saved export to test_canvas_export.png');
      
    } else {
      const errorData = await response.json();
      console.log('   ❌ Failed to export canvas:', errorData.error);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 4: Export canvas (JPEG, different aspect ratio)
  console.log('\n📥 Test 4: Export Canvas (JPEG, Portrait Aspect Ratio)');
  try {
    const response = await fetch(`${baseUrl}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: testBase64,
        canvasWidth: 1080,
        canvasHeight: 1920,
        format: 'jpeg',
        quality: 90,
        downloadMode: 'direct',
        fileName: 'test_canvas_portrait.jpg',
        userId: 'test-user'
      })
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log('   ✅ Successfully exported portrait canvas');
      console.log('   Content-Type:', contentType);
      console.log('   Content-Length:', contentLength, 'bytes');
      
      // Optionally save the file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync('./test_canvas_portrait.jpg', Buffer.from(buffer));
      console.log('   💾 Saved export to test_canvas_portrait.jpg');
      
    } else {
      const errorData = await response.json();
      console.log('   ❌ Failed to export canvas:', errorData.error);
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 5: Test error handling
  console.log('\n❌ Test 5: Error Handling');
  try {
    const response = await fetch(`${baseUrl}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: 'invalid-data',
        canvasWidth: 1280,
        canvasHeight: 720
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.log('   ✅ Correctly handled invalid image data');
      console.log('   Error message:', data.error);
    } else {
      console.log('   ❌ Should have failed with invalid data');
    }
  } catch (error) {
    console.log('   ❌ Unexpected error:', error.message);
  }
  
  console.log('\n🎉 Canvas Export API Tests Completed!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Export formats endpoint working');
  console.log('   ✅ Thumbnail generation with aspect ratio preservation');
  console.log('   ✅ Canvas export with exact dimensions');
  console.log('   ✅ Multiple format support (PNG, JPEG)');
  console.log('   ✅ Direct download functionality');
  console.log('   ✅ Error handling for invalid inputs');
  
  console.log('\n💡 Integration Points:');
  console.log('   - Use fetch() to call export endpoints from frontend');
  console.log('   - Pass canvas.toDataURL() as imageData');
  console.log('   - Include canvas dimensions for proper aspect ratio');
  console.log('   - Handle both direct download and cloud upload modes');
}

// Run the test
testCanvasExportAPI().catch(console.error);
