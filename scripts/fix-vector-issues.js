const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const Asset = require('../models/Asset');
const vectorStore = require('../services/vectorStore');

async function fixGlobalSearchAndMetadata() {
    console.log('🔧 Fixing Global Search and Metadata Issues');
    console.log('============================================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');
        
        // Initialize vector store
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Test 1: Check existing vectors and their metadata
        console.log('📊 Testing Vector Metadata:');
        console.log('===========================');
        
        try {
            // Test with specific user first
            const userResults = await vectorStore.searchAssets('weather', 'test-user-comprehensive', { limit: 3 });
            console.log(`✅ User-specific search worked: ${userResults.length} results`);
            
            if (userResults.length > 0) {
                console.log('Sample result metadata:');
                console.log(JSON.stringify(userResults[0].metadata, null, 2));
            }
        } catch (error) {
            console.log(`❌ User-specific search failed: ${error.message}`);
        }

        // Test 2: Check the problematic global search
        console.log('\n🔍 Testing Global Search Issue:');
        console.log('===============================');
        
        try {
            // This should fail with the current code
            const globalResults = await vectorStore.searchAssets('weather', null, { limit: 3 });
            console.log(`✅ Global search worked: ${globalResults.length} results`);
        } catch (error) {
            console.log(`❌ Global search failed: ${error.message}`);
            console.log('This is the expected error - filter with null userId');
        }

        // Test 3: Check the specific problematic asset
        console.log('\n🔍 Testing Specific Asset:');
        console.log('==========================');
        
        const problemAssetId = '68470450a0183fea032c97af';
        const asset = await Asset.findById(problemAssetId);
        
        if (asset) {
            console.log(`Found asset: ${asset.name}`);
            console.log(`   User ID: ${asset.userId}`);
            console.log(`   Vectorized: ${asset.vectorized}`);
            console.log(`   URL: ${asset.url}`);
            console.log(`   File Path: ${asset.filePath}`);
            
            // Check if it has any chunks in the vector store
            try {
                const chunks = await vectorStore.searchDocumentChunks('weather', asset.userId, { 
                    limit: 5,
                    filter: { assetId: asset._id.toString() }
                });
                console.log(`   Found ${chunks.length} chunks for this asset`);
                
                if (chunks.length > 0) {
                    console.log('   Sample chunk metadata:');
                    console.log('   ', JSON.stringify(chunks[0].metadata, null, 4));
                }
            } catch (chunkError) {
                console.log(`   Error searching chunks: ${chunkError.message}`);
            }
        } else {
            console.log('❌ Asset not found');
        }

        // Test 4: Check document chunks with undefined content
        console.log('\n🔍 Investigating Undefined Content:');
        console.log('===================================');
        
        try {
            const chunks = await vectorStore.searchDocumentChunks('weather', 'test-user-comprehensive', { limit: 3 });
            console.log(`Found ${chunks.length} document chunks`);
            
            chunks.forEach((chunk, i) => {
                console.log(`Chunk ${i + 1}:`);
                console.log(`  ID: ${chunk.chunkId}`);
                console.log(`  Asset ID: ${chunk.assetId}`);
                console.log(`  Content: ${chunk.text || chunk.metadata?.content || 'UNDEFINED'}`);
                console.log(`  Title: ${chunk.title || chunk.metadata?.title || 'UNDEFINED'}`);
                console.log(`  Chunk ID: ${chunk.metadata?.chunkId || chunk.chunkId || 'UNDEFINED'}`);
                console.log(`  File Name: ${chunk.metadata?.parentName || 'UNDEFINED'}`);
                console.log('');
            });
        } catch (error) {
            console.log(`❌ Error searching chunks: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the debug
fixGlobalSearchAndMetadata();
