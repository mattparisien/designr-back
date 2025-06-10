// Basic Vector Store Test (without Agents SDK)
require('dotenv').config();

async function basicVectorStoreTest() {
  console.log('🧪 Basic Vector Store Test (No Agents SDK)\n');

  try {
    console.log('1. Testing direct vector store import...');
    const vectorStore = require('../services/vectorStore');
    console.log('✅ Vector store imported');

    console.log('2. Testing initialization...');
    console.log('   OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('   Pinecone API Key present:', !!process.env.PINECONE_API_KEY);
    
    await vectorStore.initialize();
    console.log('✅ Vector store initialized');

    console.log('3. Testing search function...');
    const searchResults = await vectorStore.searchAssets('test', 'user123', { limit: 1 });
    console.log(`✅ Search completed - found ${searchResults.length} results`);

    console.log('4. Testing document search...');
    const docResults = await vectorStore.searchDocumentChunks('test', 'user123', { limit: 1 });
    console.log(`✅ Document search completed - found ${docResults.length} results`);

    console.log('\n🎉 Basic vector store test passed!');
    console.log('The vector store is working correctly.');
    console.log('Issue appears to be with the Agents SDK integration.');

  } catch (error) {
    console.error('❌ Basic test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 8).join('\n'));
    }
  }
}

basicVectorStoreTest();
