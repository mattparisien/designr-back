const fs = require('fs');
const path = require('path');

// Simple CSV processing test without database dependencies
const csvProcessingService = require('../services/csvProcessingService');
const csvChunkingService = require('../services/csvChunkingService');

// Create a sample CSV file for testing
function createSampleCSVFile() {
  const csvContent = `name,age,email,department,salary
John Doe,28,john.doe@company.com,Engineering,75000
Jane Smith,32,jane.smith@company.com,Marketing,65000
Mike Johnson,25,mike.johnson@company.com,Engineering,68000
Sarah Wilson,29,sarah.wilson@company.com,Sales,62000
David Brown,35,david.brown@company.com,HR,58000`;

  const testFilePath = path.join(__dirname, '../temp-uploads/simple-test.csv');
  
  // Ensure temp-uploads directory exists
  const tempDir = path.dirname(testFilePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  fs.writeFileSync(testFilePath, csvContent);
  console.log(`📄 Created test CSV file: ${testFilePath}`);
  return testFilePath;
}

async function runSimpleTest() {
  console.log('🚀 Simple CSV Processing Test');
  console.log('============================\n');

  try {
    // Step 1: Create test CSV
    const csvFilePath = createSampleCSVFile();
    
    // Step 2: Test CSV extraction
    console.log('📊 Testing CSV content extraction...');
    const extractedContent = await csvProcessingService.extractCSVData(csvFilePath);
    
    if (extractedContent) {
      console.log('✅ CSV extraction successful!');
      console.log(`- Rows: ${extractedContent.metadata.rowCount}`);
      console.log(`- Columns: ${extractedContent.metadata.columnCount}`);
      console.log(`- Headers: ${extractedContent.metadata.headers.join(', ')}`);
      console.log(`- Encoding: ${extractedContent.metadata.encoding}`);
      
      // Step 3: Test CSV chunking
      console.log('\n🔗 Testing CSV chunking...');
      const chunks = await csvChunkingService.chunkCSVData(extractedContent, 'test-asset-id');
      
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
      });

      // Step 4: Test optimized chunking
      console.log('\n🎯 Testing optimized chunking strategies...');
      const optimizedStrategies = ['schema', 'content', 'analysis'];
      
      for (const strategy of optimizedStrategies) {
        const optimizedChunks = await csvChunkingService.createOptimizedChunks(
          extractedContent, 
          'test-asset-id', 
          strategy
        );
        console.log(`  ${strategy} strategy: ${optimizedChunks.length} chunks`);
      }

      console.log('\n🎉 All CSV processing tests completed successfully!');
      
      // Clean up
      fs.unlinkSync(csvFilePath);
      console.log('🧹 Cleaned up test files');
      
    } else {
      console.log('❌ CSV extraction failed');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
runSimpleTest();
