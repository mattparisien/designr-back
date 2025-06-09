const mongoose = require('mongoose');
require('dotenv').config();

// Import services
const vectorStore = require('../services/vectorStore');

async function testWeatherSearch() {
    console.log('🔍 Testing Weather Search in Vector Store');
    console.log('=========================================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');

        // Initialize vector store
        await vectorStore.initialize();
        console.log('✅ Vector store initialized\n');

        // Test different weather-related searches
        const searchQueries = [
            'weather',
            'weather data',
            'temperature',
            'humidity',
            'precipitation',
            'weather conditions',
            'sunny',
            'CSV weather'
        ];

        console.log('🔍 Testing Asset Search:');
        console.log('========================');
        
        for (const query of searchQueries) {
            try {
                const results = await vectorStore.searchAssets(query, 'test-user-comprehensive', { limit: 5 });
                console.log(`\n"${query}" → ${results.length} asset results`);
                
                if (results.length > 0) {
                    results.forEach((result, i) => {
                        console.log(`   ${i + 1}. Score: ${result.score?.toFixed(3)} - ${result.metadata?.parentName || result.metadata?.name || result.id}`);
                        if (result.metadata) {
                            console.log(`      Type: ${result.metadata.type || 'unknown'}`);
                            console.log(`      Size: ${result.metadata.fileSize || 'unknown'} bytes`);
                        }
                    });
                } else {
                    console.log('   No results found');
                }
            } catch (error) {
                console.log(`   Error searching "${query}": ${error.message}`);
            }
        }

        console.log('\n🔍 Testing Document Chunk Search:');
        console.log('==================================');
        
        for (const query of searchQueries) {
            try {
                const chunkResults = await vectorStore.searchDocumentChunks(query, 'test-user-comprehensive', { limit: 3 });
                console.log(`\n"${query}" → ${chunkResults.length} chunk results`);
                
                if (chunkResults.length > 0) {
                    chunkResults.forEach((chunk, i) => {
                        console.log(`   ${i + 1}. ${chunk.metadata?.chunkId || chunk.chunkId || 'unknown'} - Score: ${chunk.score?.toFixed(3)}`);
                        console.log(`      Content preview: ${chunk.text?.substring(0, 80) || chunk.metadata?.content?.substring(0, 80)}...`);
                        if (chunk.metadata) {
                            console.log(`      Asset: ${chunk.metadata.assetId || 'unknown'}`);
                        }
                    });
                } else {
                    console.log('   No chunk results found');
                }
            } catch (error) {
                console.log(`   Error searching chunks for "${query}": ${error.message}`);
            }
        }

        // Also test with different user contexts
        console.log('\n🔍 Testing Different User Context:');
        console.log('==================================');
        
        try {
            const globalResults = await vectorStore.searchAssets('weather', null, { limit: 5 });
            console.log(`\nGlobal "weather" search → ${globalResults.length} results`);
            
            if (globalResults.length > 0) {
                globalResults.forEach((result, i) => {
                    console.log(`   ${i + 1}. Score: ${result.score?.toFixed(3)} - ${result.metadata?.parentName || result.metadata?.name || result.id}`);
                });
            }
        } catch (error) {
            console.log(`   Error in global search: ${error.message}`);
        }

        // Check vector store statistics
        console.log('\n📊 Vector Store Statistics:');
        console.log('============================');
        
        try {
            const stats = await vectorStore.getStats();
            console.log('Current vector store status:');
            console.log(`   - Total vectors: ${stats.totalVectors || 'Unknown'}`);
            console.log(`   - Namespaces: ${stats.namespaces || 'Unknown'}`);
            console.log(`   - Index status: ${stats.indexStatus || 'Unknown'}`);
        } catch (error) {
            console.log(`   Stats error: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Weather search test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testWeatherSearch();
