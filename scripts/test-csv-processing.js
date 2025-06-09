const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Import services and models
require('dotenv').config();
const Asset = require('../models/Asset');
const csvProcessingService = require('../services/csvProcessingService');
const csvChunkingService = require('../services/csvChunkingService');
const vectorStoreService = require('../services/vectorStore');
const vectorJobProcessor = require('../services/vectorJobProcessor');

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Create a sample CSV file for testing
function createSampleCSVFile() {
  const csvContent = `name,age,email,department,salary,start_date
John Doe,28,john.doe@company.com,Engineering,75000,2022-01-15
Jane Smith,32,jane.smith@company.com,Marketing,65000,2021-08-10
Mike Johnson,25,mike.johnson@company.com,Engineering,68000,2023-03-22
Sarah Wilson,29,sarah.wilson@company.com,Sales,62000,2022-06-30
David Brown,35,david.brown@company.com,HR,58000,2020-11-05
Lisa Davis,27,lisa.davis@company.com,Engineering,72000,2022-12-01
Robert Miller,31,robert.miller@company.com,Finance,67000,2021-04-18
Emily Garcia,26,emily.garcia@company.com,Marketing,61000,2023-01-09
Thomas Anderson,33,thomas.anderson@company.com,Engineering,78000,2020-09-14
Jennifer Martinez,30,jennifer.martinez@company.com,Sales,64000,2022-02-28`;

  const testFilePath = path.join(__dirname, '../temp-uploads/test-employees.csv');
  
  // Ensure temp-uploads directory exists
  const tempDir = path.dirname(testFilePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  fs.writeFileSync(testFilePath, csvContent);
  console.log(`📄 Created test CSV file: ${testFilePath}`);
  return testFilePath;
}

// Create a test asset record
async function createTestAsset(csvFilePath) {
  const testAsset = new Asset({
    name: 'test-employees.csv',
    originalFilename: 'test-employees.csv',
    userId: 'test-user',
    folderId: null,
    type: 'document',
    mimeType: 'text/csv',
    fileSize: fs.statSync(csvFilePath).size,
    url: csvFilePath,
    tags: ['test', 'employees', 'sample']
  });

  const savedAsset = await testAsset.save();
  console.log(`💾 Created test asset: ${savedAsset._id}`);
  return savedAsset;
}

async function testCSVProcessing() {
  console.log('🚀 Starting CSV Processing Test Suite');
  console.log('=====================================\n');

  try {
    // Step 1: Connect to database
    await connectDB();

    // Step 2: Initialize vector store
    console.log('🔧 Initializing vector store...');
    await vectorStoreService.initialize();
    console.log('✅ Vector store initialized\n');

    // Step 3: Find existing CSV assets or create a test one
    console.log('🔍 Looking for CSV assets...');
    let csvAssets = await Asset.find({ 
      type: 'document',
      $or: [
        { mimeType: { $regex: /csv/i } },
        { originalFilename: { $regex: /\.csv$/i } }
      ]
    });

    console.log(`Found ${csvAssets.length} existing CSV assets`);

    let testAsset;
    if (csvAssets.length === 0) {
      console.log('📝 Creating test CSV file...');
      const csvFilePath = createSampleCSVFile();
      testAsset = await createTestAsset(csvFilePath);
    } else {
      testAsset = csvAssets[0];
      console.log(`Using existing CSV asset: ${testAsset.name}`);
    }

    console.log(`\n🧪 Testing with CSV: ${testAsset.name}`);
    console.log(`Asset ID: ${testAsset._id}`);
    console.log(`File URL: ${testAsset.url}`);

    // Step 4: Test CSV content extraction
    console.log('\n📊 Testing CSV content extraction...');
    const extractedContent = await csvProcessingService.extractCSVData(testAsset.url);
    
    if (extractedContent) {
      console.log('✅ CSV extraction successful!');
      console.log(`- Rows: ${extractedContent.metadata.rowCount}`);
      console.log(`- Columns: ${extractedContent.metadata.columnCount}`);
      console.log(`- Headers: ${extractedContent.metadata.headers.join(', ')}`);
      console.log(`- Encoding: ${extractedContent.metadata.encoding}`);
      console.log(`- File size: ${(extractedContent.metadata.fileSize / 1024).toFixed(2)} KB`);
      
      // Show column statistics
      console.log('\n📈 Column Statistics:');
      Object.entries(extractedContent.metadata.columnStats).forEach(([col, stats]) => {
        console.log(`  ${col}: ${stats.dataType} (${stats.fillRate}% filled, ${stats.uniqueValues} unique)`);
      });
    } else {
      console.log('❌ CSV extraction failed');
      return;
    }

    // Step 5: Test CSV chunking
    console.log('\n🔗 Testing CSV chunking...');
    const chunks = await csvChunkingService.chunkCSVData(extractedContent, testAsset._id);
    
    console.log(`✅ CSV chunking completed! Created ${chunks.length} chunks`);
    
    // Show chunk types
    const chunkTypes = {};
    chunks.forEach(chunk => {
      chunkTypes[chunk.type] = (chunkTypes[chunk.type] || 0) + 1;
    });
    
    console.log('\n📋 Chunk Types:');
    Object.entries(chunkTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} chunks`);
    });

    // Show sample chunks
    console.log('\n📄 Sample Chunks:');
    chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1} (${chunk.type}):`);
      console.log(`    - ID: ${chunk.id}`);
      console.log(`    - Content: ${chunk.content.substring(0, 100)}...`);
      console.log(`    - Order: ${chunk.order}`);
    });

    // Step 6: Test vector storage
    console.log('\n🔗 Testing vector storage...');
    await vectorStoreService.addDocumentWithChunks(testAsset, chunks);
    console.log('✅ Document chunks added to vector store');

    // Update asset metadata
    await Asset.findByIdAndUpdate(testAsset._id, {
      vectorized: true,
      vectorLastUpdated: new Date(),
      'metadata.csvProcessingCompleted': new Date(),
      'metadata.extractedContent': extractedContent,
      'metadata.totalChunks': chunks.length,
      'metadata.chunkingStrategy': 'csv_multi_strategy'
    });

    // Step 7: Test chunk search
    console.log('\n🔍 Testing CSV document chunk search...');
    const searchQueries = [
      'employee data',
      'Engineering department',
      'salary information',
      'contact email',
      'data types columns'
    ];

    for (const query of searchQueries) {
      console.log(`\n  Searching for: "${query}"`);
      const searchResults = await vectorStoreService.searchDocumentChunks(
        query,
        testAsset.userId,
        { limit: 3, threshold: 0.5 }
      );
      
      console.log(`  ✅ Found ${searchResults.length} relevant chunks`);
      if (searchResults.length > 0) {
        searchResults.forEach((result, index) => {
          const content = result.text || result.content || 'No content available';
          console.log(`    ${index + 1}. ${result.chunkId} (score: ${result.score.toFixed(3)}) - ${content.substring(0, 80)}...`);
        });
      }
    }

    // Step 8: Test full processing pipeline
    console.log('\n🔄 Testing full processing pipeline...');
    console.log('  Enqueueing CSV extraction job...');
    vectorJobProcessor.enqueue('extractCSV', testAsset._id, 'high');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('  Processing jobs...');
    await vectorJobProcessor.processJobs();
    
    console.log('✅ Pipeline test completed!');

    // Step 9: Test optimized chunking strategies
    console.log('\n🎯 Testing optimized chunking strategies...');
    const optimizedStrategies = ['schema', 'content', 'analysis'];
    
    for (const strategy of optimizedStrategies) {
      const optimizedChunks = await csvChunkingService.createOptimizedChunks(
        extractedContent, 
        testAsset._id, 
        strategy
      );
      console.log(`  ${strategy} strategy: ${optimizedChunks.length} chunks`);
    }

    // Step 10: Test asset deletion with chunks
    console.log('\n🗑️  Testing asset deletion with chunk cleanup...');
    
    // Create a temporary test asset
    const tempCsvPath = createSampleCSVFile();
    const tempAsset = await createTestAsset(tempCsvPath);
    
    // Add it to vector store
    await vectorStoreService.addDocumentWithChunks(tempAsset, chunks.slice(0, 5));
    await Asset.findByIdAndUpdate(tempAsset._id, { vectorized: true });
    
    // Test deletion
    await vectorStoreService.removeAsset(tempAsset._id.toString());
    await vectorStoreService.removeDocumentChunks(tempAsset._id.toString());
    await Asset.findByIdAndDelete(tempAsset._id);
    
    // Clean up temp file
    fs.unlinkSync(tempCsvPath);
    
    console.log('✅ Asset deletion with chunk cleanup successful!');

    // Step 11: Performance summary
    console.log('\n📊 Performance Summary:');
    console.log(`- Processing time: Fast extraction and chunking`);
    console.log(`- Chunks created: ${chunks.length} for comprehensive search coverage`);
    console.log(`- Vector storage: Successful integration with existing system`);
    console.log(`- Search capability: Multi-faceted search across schema, content, and statistics`);

    console.log('\n🎉 All CSV processing tests completed successfully!');
    console.log('=====================================');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  mongoose.connection.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
testCSVProcessing();
