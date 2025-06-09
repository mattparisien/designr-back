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
      
      // AI-generated image content analysis
      if (asset.type === 'image') {
        // Main AI description
        if (asset.metadata.aiDescription) {
          parts.push(asset.metadata.aiDescription);
        }
        
        // Detected objects
        if (asset.metadata.detectedObjects && Array.isArray(asset.metadata.detectedObjects)) {
          parts.push(...asset.metadata.detectedObjects);
        }
        
        // Dominant colors
        if (asset.metadata.dominantColors && Array.isArray(asset.metadata.dominantColors)) {
          parts.push(...asset.metadata.dominantColors);
        }
        
        // Text extracted from image (OCR)
        if (asset.metadata.extractedText) {
          parts.push(asset.metadata.extractedText);
        }
        
        // Visual themes and concepts
        if (asset.metadata.visualThemes && Array.isArray(asset.metadata.visualThemes)) {
          parts.push(...asset.metadata.visualThemes);
        }
        
        // Mood and atmosphere
        if (asset.metadata.mood) {
          parts.push(asset.metadata.mood);
        }
        
        // Artistic style
        if (asset.metadata.style) {
          parts.push(asset.metadata.style);
        }
        
        // Categories for broader classification
        if (asset.metadata.categories && Array.isArray(asset.metadata.categories)) {
          parts.push(...asset.metadata.categories);
        }
        
        // Composition description
        if (asset.metadata.composition) {
          parts.push(asset.metadata.composition);
        }
        
        // Lighting conditions
        if (asset.metadata.lighting) {
          parts.push(asset.metadata.lighting);
        }
        
        // Setting or environment
        if (asset.metadata.setting) {
          parts.push(asset.metadata.setting);
        }
      }
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // Create searchable text from document chunk
  createChunkSearchableText(chunk, parentAsset) {
    const parts = [
      chunk.text || chunk.content || '',
      chunk.title || '',
      chunk.section || '',
      ...(chunk.keywords || []),
      ...(parentAsset.tags || []),
      parentAsset.name,
      parentAsset.originalFilename
    ];

    // Add parent asset metadata
    if (parentAsset.metadata) {
      if (parentAsset.metadata.title) parts.push(parentAsset.metadata.title);
      if (parentAsset.metadata.author) parts.push(parentAsset.metadata.author);
      if (parentAsset.metadata.subject) parts.push(parentAsset.metadata.subject);
      if (parentAsset.metadata.keywords) parts.push(...parentAsset.metadata.keywords);
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

      let embedding;
      let vectorSource = 'text';
      
      // Use hybrid vector if available (for images with AI analysis)
      if (asset.type === 'image' && asset.metadata?.hybridVector) {
        embedding = asset.metadata.hybridVector;
        vectorSource = 'hybrid';
        console.log(`Using hybrid vector for image: ${asset.name}`);
      } else {
        // Fall back to text-based embedding
        const searchableText = this.createSearchableText(asset);
        embedding = await this.generateEmbedding(searchableText);
        vectorSource = 'text';
      }

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
          folderId: asset.folderId ? asset.folderId.toString() : 'root',
          createdAt: asset.createdAt ? asset.createdAt.toISOString() : new Date().toISOString(),
          searchableText: this.createSearchableText(asset),
          vectorSource: vectorSource, // Track which type of vector this is
          
          // Add AI analysis metadata for better search results
          ...(asset.metadata?.aiDescription && { aiDescription: asset.metadata.aiDescription }),
          ...(asset.metadata?.mood && { mood: asset.metadata.mood }),
          ...(asset.metadata?.style && { style: asset.metadata.style }),
          ...(asset.metadata?.dominantColors && { dominantColors: asset.metadata.dominantColors.slice(0, 3) }), // Top 3 colors
          ...(asset.metadata?.visualThemes && { visualThemes: asset.metadata.visualThemes.slice(0, 3) }) // Top 3 themes
        }
      };

      await this.index.upsert([vector]);
      console.log(`Asset ${asset._id} added to vector store using ${vectorSource} embedding`);
    } catch (error) {
      console.error('Error adding asset to vector store:', error);
      // Don't throw error - allow normal asset operations to continue
    }
  }

  // Add document chunks to vector store
  async addDocumentChunks(chunks, parentAsset) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping chunk vectorization');
        return;
      }

      const vectors = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const searchableText = this.createChunkSearchableText(chunk, parentAsset);
          const embedding = await this.generateEmbedding(searchableText);

          vectors.push({
            id: `${parentAsset._id.toString()}_chunk_${i}`,
            values: embedding,
            metadata: {
              assetId: parentAsset._id.toString(),
              userId: parentAsset.userId,
              type: 'document_chunk',
              chunkIndex: i,
              chunkId: chunk.id || `chunk_${i}`,
              parentName: parentAsset.name,
              parentType: parentAsset.type,
              parentMimeType: parentAsset.mimeType,
              content: (chunk.text || chunk.content || '').substring(0, 1000), // Store first 1000 chars for preview
              title: chunk.title || '',
              section: chunk.section || '',
              ...(chunk.startPage && { startPage: chunk.startPage }),
              ...(chunk.endPage && { endPage: chunk.endPage }),
              ...(chunk.page && { page: chunk.page }),
              wordCount: chunk.wordCount || 0,
              quality: chunk.quality || 'medium',
              language: chunk.language || 'unknown',
              folderId: parentAsset.folderId ? parentAsset.folderId.toString() : 'root',
              createdAt: parentAsset.createdAt ? parentAsset.createdAt.toISOString() : new Date().toISOString(),
              searchableText: searchableText,
              vectorSource: 'document_chunk',
              
              // Add chunk-specific metadata
              ...(chunk.keywords && { keywords: chunk.keywords.slice(0, 5) }),
              ...(chunk.summary && { summary: chunk.summary.substring(0, 500) }),
              ...(chunk.entities && { entities: chunk.entities.slice(0, 10) })
            }
          });
        } catch (error) {
          console.error(`Error processing chunk ${i} for vectorization:`, error);
          // Continue with other chunks
        }
      }

      if (vectors.length > 0) {
        // Batch upsert chunks
        const batchSize = 100; // Pinecone batch size limit
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          await this.index.upsert(batch);
        }
        console.log(`Added ${vectors.length} document chunks to vector store for asset ${parentAsset._id}`);
      }
    } catch (error) {
      console.error('Error adding document chunks to vector store:', error);
      throw error;
    }
  }

  // Add document with chunks - combined method for easier usage
  async addDocumentWithChunks(asset, chunks) {
    try {
      console.log(`Adding document with ${chunks.length} chunks for asset: ${asset.name}`);
      
      // Add the asset to vector store
      await this.addAsset(asset);
      
      // Add all chunks to vector store
      await this.addDocumentChunks(chunks, asset);
      
      console.log(`Successfully added asset and ${chunks.length} chunks to vector store`);
    } catch (error) {
      console.error('Error adding document with chunks to vector store:', error);
      throw error;
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

  // Remove document chunks for an asset
  async removeDocumentChunks(assetId) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, skipping chunk removal');
        return;
      }

      // Query for all chunk IDs for this asset
      const searchResponse = await this.index.query({
        vector: new Array(this.dimension).fill(0), // Dummy vector for metadata-only search
        topK: 1000, // Reasonable limit for chunks per document
        filter: {
          assetId: { $eq: assetId },
          type: { $eq: 'document_chunk' }
        },
        includeMetadata: false
      });

      const chunkIds = searchResponse.matches.map(match => match.id);

      if (chunkIds.length > 0) {
        // Delete chunks in batches
        const batchSize = 100;
        for (let i = 0; i < chunkIds.length; i += batchSize) {
          const batch = chunkIds.slice(i, i + batchSize);
          await this.index.deleteMany(batch);
        }
        console.log(`Removed ${chunkIds.length} document chunks for asset ${assetId}`);
      }
    } catch (error) {
      console.error('Error removing document chunks:', error);
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
      const filter = {};
      
      // Only add userId filter if userId is provided (not null)
      if (userId !== null && userId !== undefined) {
        filter.userId = { $eq: userId };
      }

      if (type) {
        filter.type = { $eq: type };
      }

      if (folderId !== null) {
        filter.folderId = folderId ? { $eq: folderId } : { $eq: 'root' };
      }

      // Prepare query parameters
      const queryParams = {
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true
      };

      // Only add filter if it has any properties
      if (Object.keys(filter).length > 0) {
        queryParams.filter = filter;
      }

      // Perform vector search
      const searchResponse = await this.index.query(queryParams);

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

  // Search document chunks using vector similarity
  async searchDocumentChunks(query, userId, options = {}) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, returning empty results');
        return [];
      }

      const {
        limit = 20,
        threshold = 0.7,
        assetId = null
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter for user-specific chunk search
      const filter = {
        type: { $eq: 'document_chunk' }
      };
      
      // Only add userId filter if userId is provided (not null)
      if (userId !== null && userId !== undefined) {
        filter.userId = { $eq: userId };
      }

      if (assetId) {
        filter.assetId = { $eq: assetId };
      }

      // Prepare query parameters
      const queryParams = {
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true
      };

      // Only add filter if it has any properties beyond the required type filter
      if (Object.keys(filter).length > 1 || filter.type) {
        queryParams.filter = filter;
      }

      // Perform vector search
      const searchResponse = await this.index.query(queryParams);

      // Filter results by similarity threshold
      const results = searchResponse.matches
        .filter(match => match.score >= threshold)
        .map(match => ({
          chunkId: match.id,
          assetId: match.metadata.assetId,
          score: match.score,
          text: match.metadata.content,
          title: match.metadata.title,
          type: match.metadata.parentType,
          section: match.metadata.section,
          page: match.metadata.startPage,
          metadata: match.metadata
        }));

      console.log(`Document chunk search for "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Error searching document chunks:', error);
      return [];
    }
  }

  // Get document content summary by aggregating chunks
  async getDocumentSummary(assetId, userId, maxChunks = 10) {
    try {
      if (!this.initialized || !this.index) {
        return null;
      }

      // Get all chunks for this document
      const searchResponse = await this.index.query({
        vector: new Array(this.dimension).fill(0), // Dummy vector for metadata-only search
        topK: maxChunks,
        filter: {
          userId: { $eq: userId },
          assetId: { $eq: assetId },
          type: { $eq: 'document_chunk' }
        },
        includeMetadata: true
      });

      if (!searchResponse.matches || searchResponse.matches.length === 0) {
        return null;
      }

      const chunks = searchResponse.matches;
      const totalWordCount = chunks.reduce((sum, chunk) => sum + (chunk.metadata.wordCount || 0), 0);
      const sections = [...new Set(chunks.map(chunk => chunk.metadata.section).filter(Boolean))];
      
      // Extract keywords from all chunks
      const allKeywords = chunks.flatMap(chunk => chunk.metadata.keywords || []);
      const keywordCounts = {};
      allKeywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
      const topKeywords = Object.entries(keywordCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([keyword]) => keyword);

      return {
        totalChunks: chunks.length,
        totalWordCount,
        averageQuality: chunks.reduce((sum, chunk) => sum + (chunk.metadata.quality === 'high' ? 3 : chunk.metadata.quality === 'medium' ? 2 : 1), 0) / chunks.length,
        sections,
        topKeywords,
        languages: [...new Set(chunks.map(chunk => chunk.metadata.language).filter(Boolean))],
        summary: chunks.find(chunk => chunk.metadata.type === 'summary')?.metadata.content || null
      };
    } catch (error) {
      console.error('Error getting document summary:', error);
      return null;
    }
  }

  // Hybrid search combining assets and chunks
  async hybridSearch(query, userId, options = {}) {
    try {
      const {
        limit = 20,
        includeAssets = true,
        includeChunks = true,
        assetLimit = 10,
        chunkLimit = 10,
        threshold = 0.7
      } = options;

      const results = {
        assets: [],
        chunks: [],
        totalResults: 0
      };

      // Search assets if requested
      if (includeAssets) {
        results.assets = await this.searchAssets(query, userId, {
          limit: assetLimit,
          threshold
        });
      }

      // Search chunks if requested
      if (includeChunks) {
        results.chunks = await this.searchDocumentChunks(query, userId, {
          limit: chunkLimit,
          threshold
        });
      }

      results.totalResults = results.assets.length + results.chunks.length;
      return results;
    } catch (error) {
      console.error('Error in hybrid search:', error);
      return { assets: [], chunks: [], totalResults: 0 };
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

  // Get document chunks for a specific asset
  async getAssetChunks(assetId, userId, options = {}) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Vector store not available, returning empty results');
        return [];
      }

      const { limit = 100, startIndex = 0 } = options;

      // Query for all chunks of this asset
      const searchResponse = await this.index.query({
        vector: new Array(this.dimension).fill(0), // Dummy vector for metadata-only search
        topK: limit,
        filter: {
          userId: { $eq: userId },
          assetId: { $eq: assetId },
          type: { $eq: 'document_chunk' },
          chunkIndex: { $gte: startIndex }
        },
        includeMetadata: true
      });

      // Sort by chunk index
      const chunks = searchResponse.matches
        .map(match => ({
          chunkId: match.metadata.chunkId,
          chunkIndex: match.metadata.chunkIndex,
          content: match.metadata.content,
          title: match.metadata.title,
          section: match.metadata.section,
          startPage: match.metadata.startPage,
          endPage: match.metadata.endPage,
          wordCount: match.metadata.wordCount,
          quality: match.metadata.quality,
          summary: match.metadata.summary,
          keywords: match.metadata.keywords,
          entities: match.metadata.entities
        }))
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      return chunks;
    } catch (error) {
      console.error('Error retrieving asset chunks:', error);
      return [];
    }
  }
}

// Create and export singleton instance
const vectorStoreService = new VectorStoreService();

module.exports = vectorStoreService;
