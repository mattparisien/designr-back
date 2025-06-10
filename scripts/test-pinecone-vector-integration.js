// Comprehensive Pinecone Vector Store Test for Design Agent
const DesignAgentService = require('../services/designAgentService');
const vectorStore = require('../services/vectorStore');

async function testPineconeVectorIntegration() {
  console.log('🔍 Testing Pinecone Vector Store Integration with Design Agent\n');

  try {
    // Phase 1: Test Vector Store Directly
    console.log('📍 Phase 1: Testing Vector Store Service...');
    
    console.log('1.1 Initializing vector store...');
    await vectorStore.initialize();
    console.log('✅ Vector store initialized');

    // Check if Pinecone is actually connected
    if (vectorStore.pinecone && vectorStore.index) {
      console.log('✅ Pinecone connection established');
      console.log(`📊 Index name: ${vectorStore.indexName}`);
    } else {
      console.log('⚠️  Pinecone not connected - falling back to local search');
    }

    // Phase 2: Test Vector Search Capabilities
    console.log('\n📍 Phase 2: Testing Vector Search...');
    
    const testQueries = [
      'nature landscape photos',
      'business presentation templates', 
      'logo design examples',
      'color palettes for branding',
      'modern typography fonts'
    ];

    for (const query of testQueries) {
      console.log(`\n🔎 Testing search: "${query}"`);
      
      try {
        const searchResults = await vectorStore.searchAssets(query, 'test-user', {
          limit: 3,
          threshold: 0.5
        });
        
        console.log(`📋 Found ${searchResults.length} assets`);
        if (searchResults.length > 0) {
          searchResults.forEach((result, idx) => {
            console.log(`   ${idx + 1}. ${result.filename || result.name || 'Unknown'} (score: ${result.score?.toFixed(3)})`);
          });
        } else {
          console.log('   No results found (expected if no data vectorized yet)');
        }
      } catch (error) {
        console.error(`❌ Search error for "${query}":`, error.message);
      }
    }

    // Phase 3: Test Document Search
    console.log('\n📍 Phase 3: Testing Document Search...');
    
    const docQueries = [
      'sustainability principles',
      'design guidelines',
      'brand standards',
      'color theory',
      'typography rules'
    ];

    for (const query of docQueries) {
      console.log(`\n📄 Testing document search: "${query}"`);
      
      try {
        const docResults = await vectorStore.searchDocumentChunks(query, 'test-user', {
          limit: 3,
          threshold: 0.6
        });
        
        console.log(`📄 Found ${docResults.length} document chunks`);
        if (docResults.length > 0) {
          docResults.forEach((result, idx) => {
            console.log(`   ${idx + 1}. ${result.filename} - ${result.content?.substring(0, 100)}...`);
          });
        } else {
          console.log('   No document chunks found (expected if no documents vectorized)');
        }
      } catch (error) {
        console.error(`❌ Document search error for "${query}":`, error.message);
      }
    }

    // Phase 4: Test Design Agent Integration
    console.log('\n📍 Phase 4: Testing Design Agent Vector Integration...');
    
    console.log('4.1 Initializing design agent...');
    const designAgent = new DesignAgentService();
    await designAgent.initialize();
    console.log('✅ Design agent initialized');

    const agentHealth = designAgent.getHealthStatus();
    console.log('🏥 Agent health:', JSON.stringify(agentHealth, null, 2));

    // Test queries that should trigger vector search
    const agentQueries = [
      {
        query: "Find me nature photos in my assets for a presentation",
        expectedTool: "search_assets",
        description: "Should search asset vectors"
      },
      {
        query: "Look for logo design examples in my files",
        expectedTool: "search_assets", 
        description: "Should search for logo assets"
      },
      {
        query: "Search my documents for color theory information",
        expectedTool: "search_documents",
        description: "Should search document vectors"
      },
      {
        query: "Find sustainability content in my uploaded documents",
        expectedTool: "search_documents",
        description: "Should search document chunks"
      }
    ];

    for (let i = 0; i < agentQueries.length; i++) {
      const { query, expectedTool, description } = agentQueries[i];
      
      console.log(`\n🤖 Agent Test ${i + 1}: ${description}`);
      console.log(`Query: "${query}"`);
      
      try {
        const startTime = Date.now();
        const response = await designAgent.chat(query, { userId: 'vector-test-user' });
        const duration = Date.now() - startTime;
        
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`💬 Assistant: ${response.assistant_text?.substring(0, 200)}...`);
        
        const toolsUsed = Object.keys(response.toolOutputs || {});
        console.log(`🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
        
        // Check if expected tool was used
        if (toolsUsed.includes(expectedTool)) {
          console.log(`✅ Expected tool "${expectedTool}" was used!`);
          
          // Show tool output
          const toolOutput = response.toolOutputs[expectedTool];
          if (toolOutput) {
            try {
              const parsed = JSON.parse(toolOutput);
              console.log(`📊 Tool returned ${Array.isArray(parsed) ? parsed.length : 'unknown'} results`);
            } catch {
              console.log(`📊 Tool output: ${toolOutput?.substring(0, 100)}...`);
            }
          }
        } else {
          console.log(`⚠️  Expected tool "${expectedTool}" was not used`);
          if (toolsUsed.length > 0) {
            console.log(`   Instead used: ${toolsUsed.join(', ')}`);
          }
        }
        
        if (response.traceId) {
          console.log(`🔍 Trace ID: ${response.traceId}`);
        }
        
        console.log('✅ Agent query completed');
        
      } catch (error) {
        console.error(`❌ Agent query failed:`, error.message);
        if (error.stack) {
          console.error('Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }
      
      // Small delay between queries
      if (i < agentQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Phase 5: Test Vector Store Stats
    console.log('\n📍 Phase 5: Vector Store Statistics...');
    
    try {
      if (vectorStore.index) {
        const stats = await vectorStore.index.describeIndexStats();
        console.log('📊 Pinecone Index Stats:');
        console.log(`   Total vectors: ${stats.totalVectorCount || 0}`);
        console.log(`   Dimension: ${stats.dimension || 'unknown'}`);
        if (stats.namespaces) {
          console.log('   Namespaces:');
          Object.entries(stats.namespaces).forEach(([ns, info]) => {
            console.log(`     ${ns}: ${info.vectorCount} vectors`);
          });
        }
      } else {
        console.log('📊 Using local vector search (no Pinecone stats available)');
      }
    } catch (error) {
      console.error('❌ Failed to get index stats:', error.message);
    }

    console.log('\n🎉 Pinecone Vector Store Integration Test Completed!');
    console.log('\n📋 Summary:');
    console.log('- Vector store service: ✅ Tested');
    console.log('- Asset search: ✅ Tested');
    console.log('- Document search: ✅ Tested'); 
    console.log('- Design agent integration: ✅ Tested');
    console.log('- Vector statistics: ✅ Tested');

  } catch (error) {
    console.error('❌ Pinecone integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Helper function to add test data if needed
async function addTestVectorData() {
  console.log('\n🔧 Adding test vector data...');
  
  try {
    const testAssets = [
      {
        filename: 'nature-landscape.jpg',
        description: 'Beautiful mountain landscape with trees and lake',
        tags: ['nature', 'landscape', 'mountains', 'trees', 'water']
      },
      {
        filename: 'business-presentation.pdf', 
        description: 'Professional business presentation template with charts',
        tags: ['business', 'presentation', 'charts', 'professional', 'template']
      },
      {
        filename: 'logo-collection.ai',
        description: 'Modern logo designs for tech companies',
        tags: ['logo', 'branding', 'tech', 'modern', 'design']
      }
    ];

    for (const asset of testAssets) {
      try {
        await vectorStore.storeAssetVector({
          id: `test-${Date.now()}-${Math.random()}`,
          filename: asset.filename,
          description: asset.description,
          tags: asset.tags,
          userId: 'test-user',
          metadata: { type: 'test-data' }
        });
        console.log(`✅ Added test asset: ${asset.filename}`);
      } catch (error) {
        console.error(`❌ Failed to add ${asset.filename}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to add test data:', error.message);
  }
}

// Run the test
if (require.main === module) {
  // Uncomment the next line if you want to add test data first
  // addTestVectorData().then(() => testPineconeVectorIntegration());
  
  testPineconeVectorIntegration().catch(console.error);
}

module.exports = { testPineconeVectorIntegration, addTestVectorData };
