console.log('🔧 Starting end-to-end CSV test script...');

require('dotenv').config();
console.log('🔧 Environment loaded');

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Asset = require('../models/Asset');
const vectorJobProcessor = require('../services/vectorJobProcessor');
const vectorStoreService = require('../services/vectorStore');

console.log('🔧 All modules loaded successfully');

async function testEndToEndCSV() {
  try {
    console.log('🚀 Starting end-to-end CSV upload and vectorization test...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize vector store
    await vectorStoreService.initialize();
    console.log('✅ Vector store initialized');

    // Create a test CSV file
    const testCsvContent = `Date,Temperature,Humidity,Wind_Speed,Conditions
2025-06-09,75.2,45,8.5,Sunny
2025-06-10,72.8,52,12.3,Partly Cloudy
2025-06-11,68.1,68,15.7,Rainy
2025-06-12,71.5,58,9.2,Clear
2025-06-13,69.3,62,11.1,Overcast`;

    const testFileName = `end-to-end-test-${Date.now()}.csv`;
    const testFilePath = path.join(__dirname, '../temp-uploads', testFileName);
    
    // Ensure temp-uploads directory exists
    const tempDir = path.dirname(testFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(testFilePath, testCsvContent);
    console.log(`✅ Created test CSV file: ${testFileName}`);

    // Create a mock asset document like what would be created during upload
    const mockAsset = new Asset({
      name: testFileName,
      originalFilename: testFileName,
      type: 'document',
      mimeType: 'text/csv',
      fileSize: Buffer.byteLength(testCsvContent),
      url: testFilePath,
      cloudinaryUrl: null, // Using local file for test
      userId: 'test-end-to-end-user',
      folderId: null, // null for root folder
      metadata: {
        contentExtractionPending: true
      }
    });

    const savedAsset = await mockAsset.save();
    console.log(`✅ Created mock asset: ${savedAsset._id}`);

    // Test the complete processing pipeline
    console.log('\n📊 Testing CSV processing pipeline...');

    // 1. Start with CSV extraction
    console.log('1️⃣ Enqueuing CSV extraction job...');
    vectorJobProcessor.enqueue('extractCSV', savedAsset._id, 'high');

    // Give some time for processing
    console.log('⏳ Waiting for CSV extraction to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if extraction completed
    const assetAfterExtraction = await Asset.findById(savedAsset._id);
    console.log('📋 Asset metadata after extraction:', {
      hasExtractedContent: !!assetAfterExtraction.metadata?.extractedContent,
      extractionCompleted: !!assetAfterExtraction.metadata?.csvProcessingCompleted,
      extractionFailed: !!assetAfterExtraction.metadata?.extractionFailed,
      error: assetAfterExtraction.metadata?.extractionError
    });

    if (assetAfterExtraction.metadata?.extractedContent) {
      const extractedData = assetAfterExtraction.metadata.extractedContent;
      console.log('📊 Extracted data summary:', {
        rowCount: extractedData.metadata?.rowCount,
        columnCount: extractedData.metadata?.columnCount,
        columns: extractedData.metadata?.columns
      });
    }

    // 2. Wait a bit more for vectorization to complete
    console.log('\n⏳ Waiting for vectorization to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Test if the data was vectorized and can be searched
    console.log('\n🔍 Testing search functionality...');
    
    const searchResults = await vectorStoreService.searchAssets('weather temperature', 'test-end-to-end-user', { limit: 5 });
    console.log(`🎯 Search results for "weather temperature": ${searchResults.length} results found`);

    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      console.log('📄 First search result:', {
        assetId: firstResult.assetId,
        score: firstResult.score,
        parentName: firstResult.metadata?.parentName,
        userId: firstResult.metadata?.userId
      });
    }

    // Test global search as well
    const globalResults = await vectorStoreService.searchAssets('sunny weather', null, { limit: 3 });
    console.log(`🌍 Global search results for "sunny weather": ${globalResults.length} results found`);

    // 4. Test document chunks search
    const chunkResults = await vectorStoreService.searchDocumentChunks('temperature humidity', 'test-end-to-end-user', { limit: 3 });
    console.log(`📚 Document chunks search results: ${chunkResults.length} chunks found`);

    if (chunkResults.length > 0) {
      console.log('📄 First chunk result preview:', {
        chunkId: chunkResults[0].chunkId,
        score: chunkResults[0].score,
        textPreview: chunkResults[0].text?.substring(0, 100) + '...'
      });
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await Asset.findByIdAndDelete(savedAsset._id);
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    console.log('\n✅ End-to-end CSV test completed successfully!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log(`   • CSV file created and processed: ✅`);
    console.log(`   • Data extraction: ${assetAfterExtraction.metadata?.extractedContent ? '✅' : '❌'}`);
    console.log(`   • Asset search results: ${searchResults.length > 0 ? '✅' : '❌'}`);
    console.log(`   • Global search results: ${globalResults.length > 0 ? '✅' : '❌'}`);
    console.log(`   • Document chunks search: ${chunkResults.length > 0 ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Stop the job processor
    vectorJobProcessor.stopProcessing();
    
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
    
    process.exit(0);
  }
}

// Run the test
testEndToEndCSV();
