const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import services
const Asset = require('../models/Asset');
const csvProcessingService = require('../services/csvProcessingService');
const csvChunkingService = require('../services/csvChunkingService');
const vectorStore = require('../services/vectorStore');

async function vectorizeExistingCSVs() {
    console.log('🔄 Vectorizing Existing CSV Files');
    console.log('=================================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');

        // Initialize vector store
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Find all CSV assets that are not vectorized (check both mimeType and filename)
        const csvAssets = await Asset.find({
            $and: [
                {
                    $or: [
                        { mimeType: 'text/csv' },
                        { name: { $regex: /\.csv$/i } },
                        { originalFilename: { $regex: /\.csv$/i } }
                    ]
                },
                { vectorized: { $ne: true } }
            ]
        });

        console.log(`📊 Found ${csvAssets.length} CSV files to vectorize:`);
        csvAssets.forEach(asset => {
            console.log(`  - ${asset.name} (User: ${asset.userId}, ID: ${asset._id}, MimeType: ${asset.mimeType})`);
        });

        console.log(`📊 Found ${csvAssets.length} CSV files to vectorize:`);
        
        for (const asset of csvAssets) {
            console.log(`\n🔄 Processing: ${asset.name} (User: ${asset.userId})`);
            
            try {
                // Get the file path
                let csvPath;
                if (asset.url && asset.url.startsWith('/')) {
                    // Local file path
                    csvPath = path.join(__dirname, '..', asset.url);
                } else if (asset.name.includes('weather')) {
                    // Use our test weather file
                    csvPath = path.join(__dirname, '../weather-2012-01-14.csv');
                } else {
                    console.log(`   ⚠️ Skipping - no local file path available`);
                    continue;
                }

                // Extract CSV data
                const csvData = await csvProcessingService.extractCSVData(csvPath);
                console.log(`   ✅ Extracted: ${csvData.metadata.rowCount} rows, ${csvData.metadata.columnCount} columns`);

                // Create chunks
                const chunks = await csvChunkingService.chunkCSVData(csvData, asset.name.replace('.csv', ''));
                console.log(`   ✅ Generated: ${chunks.length} chunks`);

                // Store in vector database
                await vectorStore.addDocumentChunks(chunks, asset);
                console.log(`   ✅ Vectorized: ${chunks.length} chunks stored`);

                // Mark as vectorized
                asset.vectorized = true;
                await asset.save();
                console.log(`   ✅ Marked as vectorized in database`);

            } catch (error) {
                console.log(`   ❌ Error processing ${asset.name}: ${error.message}`);
            }
        }

        // Test search with default user
        console.log('\n🔍 Testing Search for Default User:');
        console.log('===================================');
        
        const defaultUserAssets = await Asset.find({ userId: 'default-user' });
        console.log(`Found ${defaultUserAssets.length} assets for default-user:`);
        
        defaultUserAssets.forEach(asset => {
            console.log(`  - ${asset.name} (Type: ${asset.type}, Vectorized: ${asset.vectorized ? '✅' : '❌'})`);
        });

        // Test weather search
        const weatherResults = await vectorStore.searchAssets('weather', 'default-user', { limit: 3 });
        console.log(`\nWeather search for default-user: ${weatherResults.length} results`);
        
        weatherResults.forEach((result, i) => {
            console.log(`  ${i + 1}. Score: ${result.score?.toFixed(3)} - Asset: ${result.metadata?.assetId}`);
        });

        console.log('\n🎉 CSV Vectorization Complete!');

    } catch (error) {
        console.error('❌ Vectorization failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the vectorization
vectorizeExistingCSVs();
