#!/usr/bin/env node

// Test script for asynchronous image analysis during upload
// This tests that uploads are fast and AI analysis happens in background

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function testAsyncImageUpload() {
  console.log('🧪 Testing Asynchronous Image Upload with Background AI Analysis\n');
  
  try {
    // Test image path
    const testImagePath = path.join(__dirname, '../public/uploads/96aa3a103d9333fdeeb49094ba7e8147.jpeg');
    
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found at:', testImagePath);
      return;
    }

    console.log('📸 Uploading test image...');
    const uploadStartTime = Date.now();

    // Create form data for upload
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testImagePath));
    formData.append('name', 'test-async-upload.jpeg');
    formData.append('tags', JSON.stringify(['test', 'async']));

    // Upload the image
    const uploadResponse = await axios.post(`${API_BASE}/assets/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    const uploadTime = Date.now() - uploadStartTime;
    const asset = uploadResponse.data;

    console.log(`✅ Upload completed in ${uploadTime}ms`);
    console.log(`📄 Asset ID: ${asset._id}`);
    console.log(`🏷️  Asset name: ${asset.name}`);
    console.log(`🖼️  Thumbnail: ${asset.thumbnail ? 'Generated' : 'Not generated'}`);
    console.log(`🔍 AI Analysis Pending: ${asset.metadata?.aiAnalysisPending || false}`);
    console.log(`🔍 Vectorized: ${asset.vectorized || false}`);

    // Verify upload was fast (should be under 3 seconds for async)
    if (uploadTime < 3000) {
      console.log(`🚀 Upload was fast (${uploadTime}ms) - AI analysis is likely async!`);
    } else {
      console.log(`⚠️  Upload took ${uploadTime}ms - may still be synchronous`);
    }

    // Wait a bit for background processing
    console.log('\n⏳ Waiting for background AI analysis...');
    
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds total
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
      
      try {
        // Check if analysis is complete
        const assetResponse = await axios.get(`${API_BASE}/assets/${asset._id}`);
        const updatedAsset = assetResponse.data;
        
        console.log(`🔄 Check ${attempts}: AI Analysis Pending: ${updatedAsset.metadata?.aiAnalysisPending || false}, Vectorized: ${updatedAsset.vectorized || false}`);
        
        if (!updatedAsset.metadata?.aiAnalysisPending && updatedAsset.vectorized) {
          console.log('\n✅ Background AI analysis completed!');
          
          // Show analysis results
          if (updatedAsset.metadata?.aiDescription) {
            console.log(`📝 Description: ${updatedAsset.metadata.aiDescription}`);
          }
          if (updatedAsset.metadata?.detectedObjects?.length > 0) {
            console.log(`🎯 Objects: ${updatedAsset.metadata.detectedObjects.join(', ')}`);
          }
          if (updatedAsset.metadata?.dominantColors?.length > 0) {
            console.log(`🎨 Colors: ${updatedAsset.metadata.dominantColors.join(', ')}`);
          }
          if (updatedAsset.metadata?.visualThemes?.length > 0) {
            console.log(`🎭 Themes: ${updatedAsset.metadata.visualThemes.join(', ')}`);
          }
          if (updatedAsset.metadata?.mood) {
            console.log(`😊 Mood: ${updatedAsset.metadata.mood}`);
          }
          
          // Test semantic search
          console.log('\n🔍 Testing semantic search...');
          const searchResponse = await axios.get(`${API_BASE}/assets/search/vector`, {
            params: {
              query: 'abstract colorful shapes',
              limit: 5
            }
          });
          
          const searchResults = searchResponse.data.results;
          const foundAsset = searchResults.find(result => result._id === asset._id);
          
          if (foundAsset) {
            console.log(`✅ Asset found in semantic search with similarity: ${(foundAsset.similarity * 100).toFixed(2)}%`);
          } else {
            console.log('❌ Asset not found in semantic search');
          }
          
          break;
        }
        
        if (updatedAsset.metadata?.aiAnalysisFailed) {
          console.log('❌ AI analysis failed');
          break;
        }
      } catch (error) {
        console.error(`Error checking asset status:`, error.response?.data || error.message);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('⏰ Timeout waiting for background processing');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAsyncImageUpload().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
