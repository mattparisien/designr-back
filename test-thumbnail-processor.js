#!/usr/bin/env node

// Test script for thumbnail processing utility
const { 
  processThumbnail, 
  processProjectThumbnail, 
  isBase64Thumbnail, 
  validateThumbnail,
  THUMBNAIL_CONFIG 
} = require('./utils/thumbnailProcessor');

async function testThumbnailProcessor() {
  console.log('🧪 Testing Thumbnail Processor Utility\n');
  
  // Test configuration
  console.log('📊 Configuration:');
  console.log('  - Temp directory:', THUMBNAIL_CONFIG.TEMP_DIR);
  console.log('  - File prefix:', THUMBNAIL_CONFIG.FILE_PREFIX);
  console.log('  - File extension:', THUMBNAIL_CONFIG.FILE_EXTENSION);
  console.log('  - Folder template:', THUMBNAIL_CONFIG.FOLDER_TEMPLATE);
  
  // Create a simple base64 test image (1x1 pixel PNG)
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const testUserId = 'test-user-123';
  
  // Test 1: isBase64Thumbnail
  console.log('\n🔍 Test 1: isBase64Thumbnail');
  console.log('  Valid base64:', isBase64Thumbnail(testBase64));
  console.log('  Regular URL:', isBase64Thumbnail('https://example.com/image.png'));
  console.log('  Invalid string:', isBase64Thumbnail('not-an-image'));
  console.log('  Null:', isBase64Thumbnail(null));
  
  // Test 2: validateThumbnail
  console.log('\n✅ Test 2: validateThumbnail');
  try {
    validateThumbnail(testBase64);
    console.log('  Valid thumbnail passed validation');
  } catch (error) {
    console.log('  Validation failed:', error.message);
  }
  
  try {
    validateThumbnail('invalid-thumbnail');
    console.log('  Invalid thumbnail unexpectedly passed');
  } catch (error) {
    console.log('  Invalid thumbnail correctly rejected:', error.message);
  }
  
  // Test 3: processProjectThumbnail with mock data
  console.log('\n📦 Test 3: processProjectThumbnail');
  
  const projectDataWithBase64 = {
    title: 'Test Project',
    userId: testUserId,
    thumbnail: testBase64,
    description: 'Test project with base64 thumbnail'
  };
  
  const projectDataWithUrl = {
    title: 'Test Project 2',
    userId: testUserId,
    thumbnail: 'https://example.com/existing-thumbnail.png',
    description: 'Test project with URL thumbnail'
  };
  
  const projectDataWithoutThumbnail = {
    title: 'Test Project 3',
    userId: testUserId,
    description: 'Test project without thumbnail'
  };
  
  try {
    console.log('  Testing project with base64 thumbnail...');
    // Note: This will fail in test mode without real Cloudinary credentials
    // but we can at least test the input validation
    const processed1 = await processProjectThumbnail(projectDataWithBase64, testUserId);
    console.log('  Base64 project processed - thumbnail type:', typeof processed1.thumbnail);
    
  } catch (error) {
    console.log('  Expected error (no Cloudinary credentials):', error.message.includes('Cloudinary') || error.message.includes('CLOUDINARY'));
  }
  
  try {
    console.log('  Testing project with URL thumbnail...');
    const processed2 = await processProjectThumbnail(projectDataWithUrl, testUserId);
    console.log('  URL project processed - thumbnail unchanged:', processed2.thumbnail === projectDataWithUrl.thumbnail);
    
  } catch (error) {
    console.log('  Unexpected error:', error.message);
  }
  
  try {
    console.log('  Testing project without thumbnail...');
    const processed3 = await processProjectThumbnail(projectDataWithoutThumbnail, testUserId);
    console.log('  No thumbnail project processed - no thumbnail field:', !processed3.thumbnail);
    
  } catch (error) {
    console.log('  Unexpected error:', error.message);
  }
  
  // Test 4: Error handling
  console.log('\n❌ Test 4: Error handling');
  
  try {
    await processProjectThumbnail(null, testUserId);
  } catch (error) {
    console.log('  Null project data correctly rejected:', error.message);
  }
  
  try {
    await processProjectThumbnail(projectDataWithBase64, null);
  } catch (error) {
    console.log('  Null user ID correctly rejected:', error.message);
  }
  
  try {
    await processThumbnail('invalid-base64', testUserId);
  } catch (error) {
    console.log('  Invalid base64 correctly rejected:', error.message);
  }
  
  console.log('\n🎉 Thumbnail processor utility tests completed!');
  console.log('\n💡 Note: Real Cloudinary upload tests require valid credentials');
  console.log('   Set CLOUDINARY_* environment variables for full integration testing');
}

// Run tests
testThumbnailProcessor().catch(console.error);
