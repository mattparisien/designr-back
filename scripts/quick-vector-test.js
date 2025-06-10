// Quick Pinecone Vector Store Test
const vectorStore = require('../services/vectorStore');

async function quickVectorTest() {
  console.log('⚡ Quick Pinecone Vector Store Test\n');

  try {
    console.log('1. Testing vector store initialization...');
    await vectorStore.initialize();
    console.log('✅ Vector store initialized');

    // Check Pinecone connection
    if (vectorStore.pinecone && vectorStore.index) {
      console.log('✅ Pinecone connected');
      console.log(`Index: ${vectorStore.indexName}`);
      
      // Get index stats
      try {
        const stats = await vectorStore.index.describeIndexStats();
        console.log('📊 Index stats:');
        console.log(`   Total vectors: ${stats.totalVectorCount || 0}`);
        console.log(`   Dimension: ${stats.dimension || 'unknown'}`);
      } catch (error) {
        console.error('⚠️  Could not get index stats:', error.message);
      }
    } else {
      console.log('⚠️  Pinecone not connected - using local fallback');
    }

    console.log('\n2. Testing basic search...');
    const searchResult = await vectorStore.searchAssets('test query', null, {
      limit: 3
    });
    
    console.log(`📋 Search returned ${searchResult.length} results`);
    if (searchResult.length > 0) {
      searchResult.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.filename || 'Unknown'} (score: ${result.score?.toFixed(3)})`);
      });
    } else {
      console.log('   No results found (normal if no vectors stored yet)');
    }

    console.log('\n✅ Quick test completed!');

  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
}

quickVectorTest();
