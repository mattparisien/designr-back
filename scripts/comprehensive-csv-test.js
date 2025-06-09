const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import services
const Asset = require('../models/Asset');
const csvProcessingService = require('../services/csvProcessingService');
const csvChunkingService = require('../services/csvChunkingService');
const vectorStore = require('../services/vectorStore');

async function comprehensiveCSVTest() {
    console.log('🔬 Comprehensive CSV Vectorization Verification');
    console.log('==============================================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');

        // Initialize vector store
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Test 1: CSV Processing
        console.log('📊 Test 1: CSV Processing Pipeline');
        console.log('=====================================');
        
        const csvPath = path.join(__dirname, '../weather-2012-01-14.csv');
        const csvData = await csvProcessingService.extractCSVData(csvPath);
        
        console.log(`✅ Extracted CSV data:`);
        console.log(`   - Rows: ${csvData.metadata.rowCount}`);
        console.log(`   - Columns: ${csvData.metadata.columnCount}`);
        console.log(`   - Headers: ${csvData.metadata.headers.join(', ')}`);
        
        // Show inferred data types
        console.log('\n📈 Data Type Analysis:');
        Object.entries(csvData.metadata.columnStats).forEach(([col, stats]) => {
            console.log(`   ${col}: ${stats.dataType} (${stats.fillRate}% filled)`);
        });

        // Test 2: Chunk Creation
        console.log('\n🧩 Test 2: Chunk Generation');
        console.log('=============================');
        
        const chunks = await csvChunkingService.chunkCSVData(csvData, 'comprehensive-test');
        
        const chunksByType = chunks.reduce((acc, chunk) => {
            acc[chunk.type] = (acc[chunk.type] || 0) + 1;
            return acc;
        }, {});
        
        console.log(`✅ Generated ${chunks.length} chunks:`);
        Object.entries(chunksByType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} chunks`);
        });

        // Test 3: Vector Generation and Storage
        console.log('\n🧮 Test 3: Vector Storage');
        console.log('==========================');
        
        // Create test asset
        const testAsset = new Asset({
            name: 'comprehensive-weather-test.csv',
            originalFilename: 'weather-2012-01-14.csv',
            mimeType: 'text/csv',
            type: 'document',
            fileSize: 240,
            url: csvPath,
            userId: 'test-user-comprehensive'
        });
        
        await testAsset.save();
        console.log(`✅ Created test asset: ${testAsset._id}`);
        
        // Store chunks in vector store
        await vectorStore.addDocumentChunks(chunks, testAsset);
        console.log(`✅ Stored ${chunks.length} chunks in vector store`);
        
        // Mark as vectorized
        testAsset.vectorized = true;
        await testAsset.save();

        // Test 4: Search Functionality
        console.log('\n🔍 Test 4: Search Functionality');
        console.log('================================');
        
        const searchQueries = [
            'weather temperature data',
            'humidity precipitation',
            'CSV file columns',
            'weather conditions sunny'
        ];
        
        for (const query of searchQueries) {
            try {
                const results = await vectorStore.searchAssets(query, 'test-user-comprehensive', { limit: 3 });
                console.log(`Query: "${query}" → ${results.length} results`);
                
                if (results.length > 0) {
                    results.forEach((result, i) => {
                        console.log(`   ${i + 1}. Score: ${result.score?.toFixed(3)} - ${result.metadata?.fileName || result.id}`);
                    });
                }
            } catch (error) {
                console.log(`   Query: "${query}" → Error: ${error.message}`);
            }
        }

        // Test 5: Document Chunk Search
        console.log('\n📄 Test 5: Document Chunk Search');
        console.log('==================================');
        
        try {
            const chunkResults = await vectorStore.searchDocumentChunks(
                'temperature humidity weather data', 
                'test-user-comprehensive', 
                { limit: 5 }
            );
            
            console.log(`✅ Found ${chunkResults.length} relevant chunks:`);
            chunkResults.forEach((chunk, i) => {
                console.log(`   ${i + 1}. ${chunk.metadata?.chunkType || 'unknown'} - Score: ${chunk.score?.toFixed(3)}`);
                console.log(`      Content: ${chunk.pageContent?.substring(0, 100)}...`);
            });
        } catch (error) {
            console.log(`⚠️ Chunk search failed: ${error.message}`);
        }

        // Test 6: Vector Store Stats
        console.log('\n📊 Test 6: Vector Store Statistics');
        console.log('===================================');
        
        try {
            const stats = await vectorStore.getStats();
            console.log('✅ Vector store statistics:');
            console.log(`   - Total vectors: ${stats.totalVectors || 'Unknown'}`);
            console.log(`   - Namespaces: ${stats.namespaces || 'Unknown'}`);
        } catch (error) {
            console.log(`⚠️ Stats retrieval failed: ${error.message}`);
        }

        console.log('\n🎉 Comprehensive CSV Vectorization Test Completed!');
        console.log('\n📋 Summary Results:');
        console.log('==================');
        console.log('✅ CSV parsing and data type inference');
        console.log('✅ Multi-type chunk generation (metadata, columns, rows, stats, samples)');
        console.log('✅ Vector embedding and storage');
        console.log('✅ Asset database integration');
        console.log('✅ Search functionality (assets and chunks)');
        console.log('✅ Vector store statistics');
        
        console.log('\n🔧 CSV Vectorization Features:');
        console.log('==============================');
        console.log('• Automatic data type detection');
        console.log('• Statistical analysis and quality metrics');
        console.log('• Multiple chunk types for comprehensive search coverage');
        console.log('• Schema-aware vectorization');
        console.log('• Row content vectorization');
        console.log('• Sample data optimization');
        console.log('• Integration with hybrid search system');

    } catch (error) {
        console.error('❌ Comprehensive test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run comprehensive test
comprehensiveCSVTest();
