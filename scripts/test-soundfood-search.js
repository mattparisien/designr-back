// Test script for debugging vector search "soundfood" issue
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const vectorStoreService = require('../services/vectorStore');

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Test the vector search for "soundfood"
async function testSoundfoodSearch() {
  try {
    console.log('\n=== Testing Vector Search for "soundfood" ===\n');
    
    // Test parameters
    const query = 'soundfood';
    const userId = 'default-user';
    const threshold = 0.7;
    const limit = 10;
    
    console.log(`Search parameters:`);
    console.log(`- Query: "${query}"`);
    console.log(`- User ID: ${userId}`);
    console.log(`- Threshold: ${threshold}`);
    console.log(`- Limit: ${limit}\n`);
    
    // Initialize vector store service
    await vectorStoreService.initialize();
    
    // First, let's see what assets exist for this user
    const allAssets = await Asset.find({ userId }).select('_id name originalFilename type tags metadata.aiDescription');
    console.log(`Total assets for user "${userId}": ${allAssets.length}\n`);
    
    if (allAssets.length > 0) {
      console.log('All assets:');
      allAssets.forEach((asset, index) => {
        console.log(`${index + 1}. ${asset.name} (ID: ${asset._id})`);
        console.log(`   Type: ${asset.type}`);
        console.log(`   Original: ${asset.originalFilename}`);
        console.log(`   Tags: ${asset.tags ? asset.tags.join(', ') : 'none'}`);
        console.log(`   AI Description: ${asset.metadata?.aiDescription || 'none'}`);
        console.log('');
      });
    }
    
    // Perform the vector search
    console.log('--- Performing Vector Search ---\n');
    const vectorResults = await vectorStoreService.searchAssets(
      query, 
      userId, 
      { limit, threshold }
    );
    
    console.log(`Vector search returned ${vectorResults.length} results:\n`);
    
    if (vectorResults.length > 0) {
      vectorResults.forEach((result, index) => {
        console.log(`${index + 1}. Asset ID: ${result.assetId}`);
        console.log(`   Similarity Score: ${result.score.toFixed(4)} (${(result.score * 100).toFixed(2)}%)`);
        console.log(`   Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
        console.log('');
      });
      
      // Get full asset details for the results
      const assetIds = vectorResults.map(r => r.assetId);
      const assets = await Asset.find({ 
        _id: { $in: assetIds },
        userId 
      });
      
      console.log('--- Full Asset Details ---\n');
      assets.forEach((asset, index) => {
        const vectorResult = vectorResults.find(r => r.assetId === asset._id.toString());
        console.log(`${index + 1}. ${asset.name}`);
        console.log(`   ID: ${asset._id}`);
        console.log(`   Type: ${asset.type}`);
        console.log(`   Original Filename: ${asset.originalFilename}`);
        console.log(`   File Size: ${asset.fileSize ? (asset.fileSize / 1024).toFixed(2) + ' KB' : 'unknown'}`);
        console.log(`   Tags: ${asset.tags ? asset.tags.join(', ') : 'none'}`);
        console.log(`   Similarity Score: ${vectorResult ? (vectorResult.score * 100).toFixed(2) + '%' : 'unknown'}`);
        
        // Show the searchable text that was used for vectorization
        if (asset.metadata) {
          console.log(`   AI Description: ${asset.metadata.aiDescription || 'none'}`);
          console.log(`   Detected Objects: ${asset.metadata.detectedObjects ? asset.metadata.detectedObjects.join(', ') : 'none'}`);
          console.log(`   Visual Themes: ${asset.metadata.visualThemes ? asset.metadata.visualThemes.join(', ') : 'none'}`);
          console.log(`   Extracted Text: ${asset.metadata.extractedText || 'none'}`);
          console.log(`   Categories: ${asset.metadata.categories ? asset.metadata.categories.join(', ') : 'none'}`);
        }
        
        // Generate and show the exact searchable text used for embedding
        const searchableText = vectorStoreService.createSearchableText(asset);
        console.log(`   Searchable Text: "${searchableText}"`);
        console.log('');
      });
    } else {
      console.log('No results found.');
    }
    
    // Test with different thresholds to see more results
    console.log('--- Testing with Lower Threshold (0.5) ---\n');
    const lowerThresholdResults = await vectorStoreService.searchAssets(
      query, 
      userId, 
      { limit: 20, threshold: 0.5 }
    );
    
    console.log(`Results with threshold 0.5: ${lowerThresholdResults.length}`);
    lowerThresholdResults.forEach((result, index) => {
      console.log(`${index + 1}. Asset ID: ${result.assetId}, Score: ${(result.score * 100).toFixed(2)}%`);
    });
    
    // Test with even lower threshold
    console.log('\n--- Testing with Very Low Threshold (0.3) ---\n');
    const veryLowThresholdResults = await vectorStoreService.searchAssets(
      query, 
      userId, 
      { limit: 20, threshold: 0.3 }
    );
    
    console.log(`Results with threshold 0.3: ${veryLowThresholdResults.length}`);
    veryLowThresholdResults.forEach((result, index) => {
      console.log(`${index + 1}. Asset ID: ${result.assetId}, Score: ${(result.score * 100).toFixed(2)}%`);
    });
    
  } catch (error) {
    console.error('Error in soundfood search test:', error);
  }
}

// Test embedding generation for the query
async function testQueryEmbedding() {
  try {
    console.log('\n=== Testing Query Embedding Generation ===\n');
    
    await vectorStoreService.initialize();
    
    const query = 'soundfood';
    console.log(`Generating embedding for query: "${query}"`);
    
    const embedding = await vectorStoreService.generateEmbedding(query);
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log(`First 10 values: [${embedding.slice(0, 10).map(v => v.toFixed(6)).join(', ')}...]`);
    
    // Test with related terms
    const relatedQueries = ['food', 'sound', 'audio', 'meal', 'restaurant', 'cooking'];
    
    console.log('\nTesting related terms:');
    for (const relatedQuery of relatedQueries) {
      const relatedEmbedding = await vectorStoreService.generateEmbedding(relatedQuery);
      
      // Calculate cosine similarity
      const dotProduct = embedding.reduce((sum, val, i) => sum + val * relatedEmbedding[i], 0);
      const magnitude1 = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(relatedEmbedding.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);
      
      console.log(`  "${relatedQuery}": ${(similarity * 100).toFixed(2)}% similarity`);
    }
    
  } catch (error) {
    console.error('Error testing query embedding:', error);
  }
}

// Main test function
async function runTests() {
  try {
    await connectDB();
    await testSoundfoodSearch();
    await testQueryEmbedding();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the tests
if (require.main === module) {
  runTests();
}

module.exports = { testSoundfoodSearch, testQueryEmbedding };
