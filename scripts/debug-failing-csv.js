const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const Asset = require('../models/Asset');
const vectorJobProcessor = require('../services/vectorJobProcessor');
const vectorStore = require('../services/vectorStore');

async function debugFailingCSV() {
    console.log('🔍 Debugging Failing CSV Asset');
    console.log('==============================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');
        
        // Initialize vector store
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Find the problematic asset
        const problemAssetId = '68470450a0183fea032c97af';
        console.log(`🔍 Looking for asset: ${problemAssetId}`);
        
        const asset = await Asset.findById(problemAssetId);
        if (!asset) {
            console.log('❌ Asset not found!');
            return;
        }

        console.log('📁 Asset Details:');
        console.log('=================');
        console.log(`   Name: ${asset.name}`);
        console.log(`   MIME Type: ${asset.mimeType}`);
        console.log(`   File Path: ${asset.filePath}`);
        console.log(`   URL: ${asset.url}`);
        console.log(`   User ID: ${asset.userId}`);
        console.log(`   File Size: ${asset.fileSize} bytes`);
        console.log(`   Vectorized: ${asset.vectorized}`);
        console.log(`   Extraction Failed: ${asset.extractionFailed}`);
        console.log(`   Created: ${asset.createdAt}`);
        console.log(`   Updated: ${asset.updatedAt}\n`);

        // Check if vectors exist for this asset
        console.log('🔍 Checking Existing Vectors:');
        console.log('=============================');
        try {
            const chunks = await vectorStore.searchDocumentChunks('weather', asset.userId, { 
                limit: 10,
                filter: { assetId: asset._id.toString() }
            });
            console.log(`   Found ${chunks.length} chunks for this asset`);
            
            if (chunks.length > 0) {
                chunks.forEach((chunk, i) => {
                    console.log(`   ${i + 1}. Type: ${chunk.metadata?.chunkType || 'unknown'}`);
                    console.log(`      Content: ${chunk.pageContent?.substring(0, 100) || 'undefined'}...`);
                    console.log(`      Asset ID: ${chunk.metadata?.assetId}`);
                    console.log(`      File Name: ${chunk.metadata?.fileName || 'undefined'}`);
                });
            }
        } catch (error) {
            console.log(`   Error checking vectors: ${error.message}`);
        }

        // Test the CSV extraction process step by step
        console.log('\n🧪 Testing CSV Extraction Process:');
        console.log('===================================');
        
        try {
            // Test URL access
            if (asset.url) {
                console.log(`   Testing URL access: ${asset.url}`);
                
                const fetch = require('node-fetch');
                const response = await fetch(asset.url, { method: 'HEAD' });
                console.log(`   URL Status: ${response.status} ${response.statusText}`);
                console.log(`   Content-Type: ${response.headers.get('content-type')}`);
                console.log(`   Content-Length: ${response.headers.get('content-length')}`);
            }
            
            // Test local file access
            if (asset.filePath) {
                console.log(`   Testing local file: ${asset.filePath}`);
                const fs = require('fs').promises;
                try {
                    const stats = await fs.stat(asset.filePath);
                    console.log(`   File exists, size: ${stats.size} bytes`);
                } catch (error) {
                    console.log(`   File access error: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.log(`   URL/File test error: ${error.message}`);
        }

        // Try to manually trigger the extraction
        console.log('\n🔧 Manual Extraction Test:');
        console.log('==========================');
        
        try {
            console.log('   Attempting manual CSV extraction...');
            await vectorJobProcessor.processCSVExtraction(asset._id.toString());
            console.log('   ✅ Manual extraction completed');
            
            // Check asset status after extraction
            const updatedAsset = await Asset.findById(problemAssetId);
            console.log(`   Updated - Vectorized: ${updatedAsset.vectorized}`);
            console.log(`   Updated - Extraction Failed: ${updatedAsset.extractionFailed}`);
            
        } catch (error) {
            console.log(`   ❌ Manual extraction failed: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
        }

        // Check vectors again after manual extraction
        console.log('\n🔍 Re-checking Vectors After Extraction:');
        console.log('========================================');
        try {
            const chunks = await vectorStore.searchDocumentChunks('weather', asset.userId, { 
                limit: 5,
                filter: { assetId: asset._id.toString() }
            });
            console.log(`   Found ${chunks.length} chunks after extraction`);
            
            if (chunks.length > 0) {
                chunks.forEach((chunk, i) => {
                    console.log(`   ${i + 1}. Type: ${chunk.metadata?.chunkType || 'unknown'}`);
                    console.log(`      Content: ${chunk.pageContent?.substring(0, 100) || 'undefined'}...`);
                    console.log(`      Score: ${chunk.score?.toFixed(3)}`);
                });
            }
        } catch (error) {
            console.log(`   Error re-checking vectors: ${error.message}`);
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
debugFailingCSV();
