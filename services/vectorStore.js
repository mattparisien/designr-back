const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class VectorStoreService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.openai = null;
    this.indexName = 'canva-assets';
    this.dimension = 1536; // OpenAI text-embedding-ada-002 dimension
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize OpenAI for embeddings
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Initialize Pinecone if API key is available
      if (process.env.PINECONE_API_KEY) {
        this.pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY
        });

        // Check if index exists, create if it doesn't
        await this.ensureIndexExists();
        this.index = this.pinecone.index(this.indexName);
      }

      this.initialized = true;
      console.log('Vector store service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store service:', error);
      // Don't throw error - allow system to work without vector search
    }
  }

  async ensureIndexExists() {
    try {
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        await this.waitForIndexReady();
      }
    } catch (error) {
      console.error('Error ensuring index exists:', error);
      throw error;
    }
  }

  async waitForIndexReady() {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          console.log('Index is ready!');
          return;
        }
      } catch (error) {
        // Index not ready yet, continue waiting
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    throw new Error('Index failed to become ready within expected time');
  }

  // Generate embeddings for asset metadata
  async generateEmbedding(text) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI not initialized');
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Create searchable text from asset metadata
  createSearchableText(asset) {
    const parts = [
      asset.name,
      asset.originalFilename,
      asset.type,
      asset.mimeType,
      ...(asset.tags || []),
    ];

    // Add metadata if available
    if (asset.metadata) {
      if (asset.metadata.description) parts.push(asset.metadata.description);
      if (asset.metadata.alt) parts.push(asset.metadata.alt);
      if (asset.metadata.keywords) parts.push(...asset.metadata.keywords);
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // Add asset to vector store
  async addAsset(asset) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping vectorization');
        return;
      }

      const searchableText = this.createSearchableText(asset);
      const embedding = await this.generateEmbedding(searchableText);

      const vector = {
        id: asset._id.toString(),
        values: embedding,
        metadata: {
          assetId: asset._id.toString(),
          userId: asset.userId,
          name: asset.name,
          type: asset.type,
          mimeType: asset.mimeType,
          tags: asset.tags || [],
          folderId: asset.folderId ? asset.folderId.toString() : null,
          createdAt: asset.createdAt,
          searchableText: searchableText
        }
      };

      await this.index.upsert([vector]);
      console.log(`Asset ${asset._id} added to vector store`);
    } catch (error) {
      console.error('Error adding asset to vector store:', error);
      // Don't throw error - allow normal asset operations to continue
    }
  }

  // Update asset in vector store
  async updateAsset(asset) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping vectorization update');
        return;
      }

      // Remove old vector and add new one
      await this.removeAsset(asset._id.toString());
      await this.addAsset(asset);
    } catch (error) {
      console.error('Error updating asset in vector store:', error);
    }
  }

  // Remove asset from vector store
  async removeAsset(assetId) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping vector removal');
        return;
      }

      await this.index.deleteOne(assetId.toString());
      console.log(`Asset ${assetId} removed from vector store`);
    } catch (error) {
      console.error('Error removing asset from vector store:', error);
    }
  }

  // Search assets using vector similarity
  async searchAssets(query, userId, options = {}) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, returning empty results');
        return [];
      }

      const {
        limit = 20,
        threshold = 0.7,
        type = null,
        folderId = null
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter for user-specific search
      const filter = {
        userId: { $eq: userId }
      };

      if (type) {
        filter.type = { $eq: type };
      }

      if (folderId !== null) {
        filter.folderId = folderId ? { $eq: folderId } : { $eq: null };
      }

      // Perform vector search
      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK: limit,
        filter: filter,
        includeMetadata: true
      });

      // Filter results by similarity threshold
      const results = searchResponse.matches
        .filter(match => match.score >= threshold)
        .map(match => ({
          assetId: match.metadata.assetId,
          score: match.score,
          metadata: match.metadata
        }));

      console.log(`Vector search for "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Error searching assets in vector store:', error);
      return [];
    }
  }

  // Get similar assets to a given asset
  async getSimilarAssets(assetId, userId, limit = 10) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, returning empty results');
        return [];
      }

      // Fetch the asset vector
      const fetchResponse = await this.index.fetch([assetId.toString()]);
      const assetVector = fetchResponse.vectors[assetId.toString()];

      if (!assetVector) {
        console.log(`Asset ${assetId} not found in vector store`);
        return [];
      }

      // Search for similar vectors
      const searchResponse = await this.index.query({
        vector: assetVector.values,
        topK: limit + 1, // +1 to exclude the asset itself
        filter: {
          userId: { $eq: userId },
          assetId: { $ne: assetId.toString() } // Exclude the asset itself
        },
        includeMetadata: true
      });

      const results = searchResponse.matches.map(match => ({
        assetId: match.metadata.assetId,
        score: match.score,
        metadata: match.metadata
      }));

      return results;
    } catch (error) {
      console.error('Error finding similar assets:', error);
      return [];
    }
  }

  // Batch add multiple assets
  async batchAddAssets(assets) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping batch vectorization');
        return;
      }

      const vectors = [];
      
      for (const asset of assets) {
        try {
          const searchableText = this.createSearchableText(asset);
          const embedding = await this.generateEmbedding(searchableText);

          vectors.push({
            id: asset._id.toString(),
            values: embedding,
            metadata: {
              assetId: asset._id.toString(),
              userId: asset.userId,
              name: asset.name,
              type: asset.type,
              mimeType: asset.mimeType,
              tags: asset.tags || [],
              folderId: asset.folderId ? asset.folderId.toString() : null,
              createdAt: asset.createdAt,
              searchableText: searchableText
            }
          });
        } catch (error) {
          console.error(`Error processing asset ${asset._id} for vectorization:`, error);
          // Continue with other assets
        }
      }

      if (vectors.length > 0) {
        await this.index.upsert(vectors);
        console.log(`Batch added ${vectors.length} assets to vector store`);
      }
    } catch (error) {
      console.error('Error batch adding assets to vector store:', error);
    }
  }

  // Get vector store statistics
  async getStats() {
    try {
      if (!this.initialized || !this.index) {
        return { available: false };
      }

      const stats = await this.index.describeIndexStats();
      return {
        available: true,
        totalVectors: stats.totalVectorCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness
      };
    } catch (error) {
      console.error('Error getting vector store stats:', error);
      return { available: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const vectorStoreService = new VectorStoreService();

module.exports = vectorStoreService;
