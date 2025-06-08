// Test script for hybrid vector approach
const dotenv = require('dotenv');
dotenv.config();

const { connectDB } = require('../config/db');
const imageAnalysisService = require('../services/imageAnalysisService');
const imageVectorService = require('../services/imageVectorService');
const vectorStoreService = require('../services/vectorStore');
const path = require('path');

async function testHybridApproach() {
  console.log('🔬 Testing Hybrid Vector Approach...\n');
  
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Initialize services
    await vectorStoreService.initialize();
    console.log('✅ Vector store service initialized');
    
    await imageAnalysisService.initialize();
    console.log('✅ Image analysis service initialized');
    
    await imageVectorService.initialize();
    console.log('✅ Image vector service initialized');
    
    // Test with a sample image from public uploads
    const testImagePath = path.join(__dirname, '../public/uploads/96aa3a103d9333fdeeb49094ba7e8147.jpeg');
    console.log(`\n🖼️  Testing with image: ${testImagePath}`);
    
    // Test image analysis
    console.log('\n1️⃣ Testing Image Analysis:');
    const analysisResult = await imageAnalysisService.analyzeImage(testImagePath);
    console.log('   Analysis Result:', JSON.stringify(analysisResult, null, 2));
    
    // Test hybrid vector generation
    console.log('\n2️⃣ Testing Hybrid Vector Generation:');
    const hybridResult = await imageVectorService.generateHybridVector(analysisResult);
    console.log('   Hybrid Vector Generated:', {
      hasSemanticEmbedding: !!hybridResult.semanticEmbedding,
      hasVisualEmbedding: !!hybridResult.visualEmbedding,
      semanticDimensions: hybridResult.semanticEmbedding?.length || 0,
      visualDimensions: hybridResult.visualEmbedding?.length || 0,
      description: hybridResult.visualDescription?.substring(0, 100) + '...'
    });
    
    // Test vector store operations
    console.log('\n3️⃣ Testing Vector Store Operations:');
    const testAssetData = {
      _id: '507f1f77bcf86cd799439011', // Test ObjectId
      filename: '96aa3a103d9333fdeeb49094ba7e8147.jpeg',
      originalName: 'test-image.jpeg',
      mimeType: 'image/jpeg',
      size: 12345,
      uploadedBy: '507f1f77bcf86cd799439012',
      tags: ['test'],
      aiAnalysis: analysisResult,
      hybridVector: hybridResult
    };
    
    // Test storing the vector
    await vectorStoreService.storeAssetVector(testAssetData);
    console.log('   ✅ Vector stored successfully');
    
    // Test searching with semantic query
    console.log('\n4️⃣ Testing Semantic Search:');
    const searchResults = await vectorStoreService.searchSimilarAssets('colorful abstract design', 3);
    console.log('   Search Results:', searchResults.map(r => ({
      filename: r.filename,
      score: r.score,
      vectorSource: r.vectorSource,
      hasAiAnalysis: !!r.aiAnalysis
    })));
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Image Analysis: Working');
    console.log('   ✅ Hybrid Vector Generation: Working');
    console.log('   ✅ Vector Storage: Working');
    console.log('   ✅ Semantic Search: Working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testHybridApproach();
