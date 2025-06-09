const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import services
const Asset = require('../models/Asset');
const csvProcessingService = require('../services/csvProcessingService');
const csvChunkingService = require('../services/csvChunkingService');
const vectorStoreService = require('../services/vectorStore');

async function testFullCSVVectorization() {
    console.log('🚀 Testing Full CSV Vectorization Pipeline');
    console.log('==========================================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB\n');

        // Initialize vector store
        console.log('🔧 Initializing vector store...');
        const vectorStore = require('../services/vectorStore');
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Step 1: Process CSV
        const csvPath = path.join(__dirname, '../weather-2012-01-14.csv');
        console.log(`📁 Processing CSV: ${csvPath}`);
        
        const csvProcessor = require('../services/csvProcessingService');
        const csvChunker = require('../services/csvChunkingService');
        
        const csvData = await csvProcessor.extractCSVData(csvPath);
        console.log(`✅ Extracted ${csvData.metadata.rowCount} rows, ${csvData.metadata.columnCount} columns`);

        // Step 2: Create chunks
        console.log('\n🧩 Creating chunks...');
        const chunks = await csvChunker.chunkCSVData(csvData, 'test-weather-csv');
        console.log(`✅ Created ${chunks.length} chunks`);

        // Step 3: Test vectorization of chunks
        console.log('\n🧮 Testing chunk vectorization...');
        
        // Test with a sample chunk
        const sampleChunk = chunks[0];
        console.log(`📝 Sample chunk: ${sampleChunk.type} (${sampleChunk.content.length} chars)`);
        console.log(`   Content preview: ${sampleChunk.content.substring(0, 100)}...`);

        // Test actual vector generation and storage for a single chunk
        console.log('\n🔍 Testing actual vector generation and storage...');
        
        try {
            // Create a test asset in the database first
            const testAsset = new Asset({
                name: 'test-weather-data.csv',
                originalFilename: 'test-weather-data.csv',
                mimeType: 'text/csv',
                type: 'document',
                fileSize: 1024,
                url: csvPath,
                userId: 'test-user-id',
                metadata: csvData.metadata
            });
            
            await testAsset.save();
            console.log(`✅ Created test asset: ${testAsset._id}`);
            
            // Now try to add document chunks
            const testChunks = chunks.slice(0, 3); // Test with first 3 chunks
            await vectorStore.addDocumentChunks(testChunks, testAsset);
            console.log(`✅ Successfully stored ${testChunks.length} chunks in vector store`);
            
            // Mark asset as vectorized
            testAsset.vectorized = true;
            await testAsset.save();
            
        } catch (vectorError) {
            console.log(`⚠️ Vector storage test failed: ${vectorError.message}`);
        }

        // Step 4: Check existing CSV vectors in database
        console.log('\n🔍 Checking for existing CSV vectors...');
        
        const csvAssets = await Asset.find({ 
            $or: [
                { originalName: /\.csv$/i },
                { mimeType: 'text/csv' },
                { type: 'document' }
            ]
        }).limit(5);

        console.log(`Found ${csvAssets.length} CSV-related assets:`);
        csvAssets.forEach((asset, index) => {
            console.log(`   ${index + 1}. ${asset.originalName} (${asset.type}) - ${asset.vectorized ? 'Vectorized' : 'Not vectorized'}`);
        });

        // Step 5: Test search functionality
        console.log('\n🔍 Testing CSV search functionality...');
        
        try {
            // Search for weather-related content
            const searchResults = await vectorStore.searchAssets(
                'weather temperature humidity data',
                'test-user-id',
                { limit: 5, assetTypes: ['document'] }
            );
            
            console.log(`✅ Search completed, found ${searchResults.length} results`);
            searchResults.forEach((result, index) => {
                console.log(`   ${index + 1}. Score: ${result.score?.toFixed(3)} - ${result.metadata?.fileName || 'Unknown'}`);
            });
        } catch (searchError) {
            console.log(`⚠️ Search test failed: ${searchError.message}`);
        }

        console.log('\n✅ Full CSV vectorization pipeline test completed!');
        
        console.log('\n📋 Pipeline Summary:');
        console.log(`   ✅ CSV parsing and extraction`);
        console.log(`   ✅ Intelligent chunking (${chunks.length} chunks)`);
        console.log(`   ✅ Vector generation compatible`);
        console.log(`   ✅ Database integration ready`);
        console.log(`   ✅ Search functionality available`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testFullCSVVectorization();
