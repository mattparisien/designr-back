#!/usr/bin/env node

/**
 * Test script for PDF processing pipeline
 * This script tests the complete PDF vectorization workflow
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { connectDB } = require('../config/db');
const Asset = require('../models/Asset');
const pdfProcessingService = require('../services/pdfProcessingService');
const documentChunkingService = require('../services/documentChunkingService');
const vectorStoreService = require('../services/vectorStore');
const vectorJobProcessor = require('../services/vectorJobProcessor');

async function testPDFProcessing() {
  try {
    console.log('🔧 Initializing services...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Initialize services
    await pdfProcessingService.initialize();
    console.log('✅ PDF processing service initialized');
    
    console.log('✅ Document chunking service ready');
    
    await vectorStoreService.initialize();
    console.log('✅ Vector store service initialized');
    
    // Test 1: Check if we have any PDF assets in the database
    console.log('\n📋 Looking for PDF assets in database...');
    const pdfAssets = await Asset.find({ 
      $and: [
        { type: 'document' },
        {
          $or: [
            { mimeType: 'application/pdf' },
            { mimeType: 'application/octet-stream' },
            { name: { $regex: /\.pdf$/i } }
          ]
        }
      ]
    }).limit(5);
    
    console.log(`Found ${pdfAssets.length} PDF assets`);
    
    if (pdfAssets.length === 0) {
      console.log('⚠️  No PDF assets found. Upload a PDF through the API first.');
      console.log('You can test the upload with:');
      console.log('curl -X POST -F "file=@/path/to/your/document.pdf" http://localhost:5000/api/assets/upload');
      process.exit(0);
    }
    
    // Test 2: Process first PDF asset
    const testAsset = pdfAssets[0];
    console.log(`\n🔍 Testing with PDF: ${testAsset.name}`);
    console.log(`Asset ID: ${testAsset._id}`);
    console.log(`File URL: ${testAsset.url}`);
    
    // Test PDF content extraction
    console.log('\n📖 Testing PDF content extraction...');
    const extractedContent = await pdfProcessingService.extractPDFContent(testAsset.url);
    
    if (extractedContent) {
      console.log('✅ PDF extraction successful!');
      console.log(`- Pages: ${extractedContent.numPages}`);
      console.log(`- Word count: ${extractedContent.wordCount}`);
      console.log(`- Language: ${extractedContent.language}`);
      console.log(`- Quality: ${extractedContent.quality}`);
      console.log(`- Title: ${extractedContent.title || 'N/A'}`);
      console.log(`- Author: ${extractedContent.author || 'N/A'}`);
      console.log(`- Content preview: ${extractedContent.text.substring(0, 200)}...`);
      
      // Test document chunking
      console.log('\n✂️  Testing document chunking...');
      const chunks = await documentChunkingService.chunkDocument(extractedContent, {
        strategy: 'hybrid',
        maxChunkSize: 1000,
        overlap: 100
      });
      
      if (chunks && chunks.length > 0) {
        console.log(`✅ Document chunking successful! Created ${chunks.length} chunks`);
        console.log('Sample chunks:');
        chunks.slice(0, 3).forEach((chunk, index) => {
          console.log(`  Chunk ${index + 1}:`);
          console.log(`    - Content: ${chunk.text.substring(0, 100)}...`);
          console.log(`    - Word count: ${chunk.wordCount}`);
          console.log(`    - Type: ${chunk.type}`);
          console.log(`    - Title: ${chunk.title || 'N/A'}`);
        });
        
        // Test vector storage
        console.log('\n🔗 Testing vector storage...');
        await vectorStoreService.addDocumentChunks(chunks, testAsset);
        console.log('✅ Document chunks added to vector store');
        
        // Test chunk search
        console.log('\n🔍 Testing document chunk search...');
        const searchResults = await vectorStoreService.searchDocumentChunks(
          'document content',
          testAsset.userId,
          { limit: 5, threshold: 0.5 }
        );
        
        console.log(`✅ Search completed! Found ${searchResults.length} relevant chunks`);
        if (searchResults.length > 0) {
          console.log('Top search results:');
          searchResults.slice(0, 2).forEach((result, index) => {
            console.log(`  Result ${index + 1} (score: ${result.score.toFixed(3)}):`);
            console.log(`    - Content: ${result.text ? result.text.substring(0, 100) : result.content ? result.content.substring(0, 100) : 'N/A'}...`);
            console.log(`    - Type: ${result.type || 'N/A'}`);
          });
        }
        
        // Test document summary
        console.log('\n📊 Testing document summary generation...');
        const summary = await vectorStoreService.getDocumentSummary(
          testAsset._id.toString(),
          testAsset.userId,
          10
        );
        
        if (summary) {
          console.log('✅ Document summary generated:');
          console.log(`  - Total chunks: ${summary.totalChunks}`);
          console.log(`  - Total words: ${summary.totalWordCount}`);
          console.log(`  - Average quality: ${summary.averageQuality}`);
          console.log(`  - Sections: ${summary.sections.join(', ')}`);
          console.log(`  - Top keywords: ${summary.topKeywords.slice(0, 10).join(', ')}`);
        }
        
      } else {
        console.log('❌ Document chunking failed');
      }
      
    } else {
      console.log('❌ PDF extraction failed');
    }
    
    // Test 3: Test vector job processor
    console.log('\n⚙️  Testing vector job processor...');
    
    // Queue PDF extraction job
    vectorJobProcessor.enqueue('extractPDF', testAsset._id, 'high');
    console.log('✅ PDF extraction job queued');
    
    // Process jobs
    const results = await vectorJobProcessor.processJobs(1);
    console.log(`✅ Processed ${results.processed} jobs`);
    if (results.failed > 0) {
      console.log(`⚠️  ${results.failed} jobs failed`);
      results.failures.forEach(failure => {
        console.log(`  - ${failure.jobType} for ${failure.assetId}: ${failure.error}`);
      });
    }
    
    console.log('\n🎉 PDF processing pipeline test completed!');
    
    // Test 4: Hybrid search
    console.log('\n🔍 Testing hybrid search (assets + chunks)...');
    const hybridResults = await vectorStoreService.hybridSearch(
      'document',
      testAsset.userId,
      {
        limit: 10,
        includeAssets: true,
        includeChunks: true,
        assetLimit: 5,
        chunkLimit: 5
      }
    );
    
    console.log(`✅ Hybrid search completed!`);
    console.log(`  - Found ${hybridResults.assets.length} matching assets`);
    console.log(`  - Found ${hybridResults.chunks.length} matching chunks`);
    console.log(`  - Total results: ${hybridResults.totalResults}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    console.log('\n🔚 Closing database connection...');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  console.log('🚀 Starting PDF Processing Pipeline Test');
  console.log('=====================================\n');
  testPDFProcessing();
}

module.exports = { testPDFProcessing };
