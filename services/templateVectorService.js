const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

class TemplateVectorService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.openai = null;
    this.indexName = 'canva-templates';
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
      console.log('Template vector store service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize template vector store service:', error);
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
        console.log('Waiting for template index to be ready...');
        await this.waitForIndexReady();
      }
    } catch (error) {
      console.error('Error ensuring template index exists:', error);
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
          console.log('Template index is ready!');
          return;
        }
      } catch (error) {
        // Index not ready yet, continue waiting
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    throw new Error('Template index failed to become ready within expected time');
  }

  // Generate embeddings for template metadata
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
      console.error('Error generating template embedding:', error);
      throw error;
    }
  }

  // Create searchable text from template/project metadata
  createSearchableText(template) {
    const parts = [
      template.title,
      template.description,
      template.type,
      template.category,
      ...(template.tags || [])
    ];

    // Add canvas size information
    if (template.canvasSize) {
      parts.push(`${template.canvasSize.width}x${template.canvasSize.height}`);
      if (template.canvasSize.name) {
        parts.push(template.canvasSize.name);
      }
    }

    // Add information from template pages/elements
    if (template.pages && Array.isArray(template.pages)) {
      template.pages.forEach(page => {
        if (page.name) parts.push(page.name);
        
        // Extract text content from elements
        if (page.elements && Array.isArray(page.elements)) {
          page.elements.forEach(element => {
            if (element.type === 'text' && element.content) {
              parts.push(element.content);
            }
            if (element.alt) {
              parts.push(element.alt);
            }
          });
        }

        // Add background information
        if (page.background && page.background.type) {
          parts.push(`background-${page.background.type}`);
        }
      });
    }

    // Add visual style information
    const visualStyles = this.extractVisualStyles(template);
    parts.push(...visualStyles);

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // Extract visual style information from template elements
  extractVisualStyles(template) {
    const styles = [];
    
    if (template.pages && Array.isArray(template.pages)) {
      template.pages.forEach(page => {
        if (page.elements && Array.isArray(page.elements)) {
          page.elements.forEach(element => {
            // Text styles
            if (element.type === 'text') {
              if (element.fontFamily) styles.push(element.fontFamily);
              if (element.isBold) styles.push('bold');
              if (element.isItalic) styles.push('italic');
              if (element.textAlign) styles.push(`align-${element.textAlign}`);
            }
            
            // Color information
            if (element.color) styles.push(`color-${element.color.replace('#', '')}`);
            if (element.backgroundColor) styles.push(`background-${element.backgroundColor.replace('#', '')}`);
            if (element.borderColor) styles.push(`border-${element.borderColor.replace('#', '')}`);
            
            // Shape information
            if (element.type === 'shape' && element.shapeType) {
              styles.push(element.shapeType);
            }
          });
        }
      });
    }

    return styles;
  }

  // Add template to vector store
  async addTemplate(template) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, skipping vectorization');
        return;
      }

      const searchableText = this.createSearchableText(template);
      const embedding = await this.generateEmbedding(searchableText);

      // Count elements for complexity metric
      let elementCount = 0;
      let textElementCount = 0;
      let imageElementCount = 0;
      
      if (template.pages && Array.isArray(template.pages)) {
        template.pages.forEach(page => {
          if (page.elements && Array.isArray(page.elements)) {
            elementCount += page.elements.length;
            page.elements.forEach(element => {
              if (element.type === 'text') textElementCount++;
              if (element.type === 'image') imageElementCount++;
            });
          }
        });
      }

      const vector = {
        id: template._id.toString(),
        values: embedding,
        metadata: {
          templateId: template._id.toString(),
          userId: template.userId,
          title: template.title,
          description: template.description || '',
          type: template.type,
          category: template.category || 'uncategorized',
          tags: template.tags || [],
          starred: template.starred || false,
          featured: template.featured || false,
          popular: template.popular || false,
          author: template.author || template.userId,
          createdAt: template.createdAt ? template.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: template.updatedAt ? template.updatedAt.toISOString() : new Date().toISOString(),
          searchableText: searchableText,
          
          // Canvas information
          canvasWidth: template.canvasSize?.width || 0,
          canvasHeight: template.canvasSize?.height || 0,
          canvasName: template.canvasSize?.name || '',
          
          // Template complexity metrics
          pageCount: template.pages?.length || 0,
          elementCount: elementCount,
          textElementCount: textElementCount,
          imageElementCount: imageElementCount,
          
          // Visual characteristics
          hasImages: imageElementCount > 0,
          hasText: textElementCount > 0,
          complexity: elementCount > 10 ? 'high' : elementCount > 5 ? 'medium' : 'low'
        }
      };

      await this.index.upsert([vector]);
      console.log(`Template ${template._id} (${template.title}) added to vector store`);
    } catch (error) {
      console.error('Error adding template to vector store:', error);
      // Don't throw error - allow normal template operations to continue
    }
  }

  // Update template in vector store
  async updateTemplate(template) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, skipping vectorization update');
        return;
      }

      // Remove old vector and add new one
      await this.removeTemplate(template._id.toString());
      await this.addTemplate(template);
    } catch (error) {
      console.error('Error updating template in vector store:', error);
    }
  }

  // Remove template from vector store
  async removeTemplate(templateId) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, skipping vector removal');
        return;
      }

      await this.index.deleteOne(templateId.toString());
      console.log(`Template ${templateId} removed from vector store`);
    } catch (error) {
      console.error('Error removing template from vector store:', error);
    }
  }

  // Search templates using vector similarity
  async searchTemplates(query, options = {}) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, returning empty results');
        return [];
      }

      const {
        limit = 20,
        threshold = 0.7,
        type = null,
        category = null,
        featured = null,
        popular = null,
        canvasSize = null,
        userId = null // For user-specific search if needed
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter for template search
      const filter = {};

      if (type) filter.type = { $eq: type };
      if (category) filter.category = { $eq: category };
      if (featured !== null) filter.featured = { $eq: featured };
      if (popular !== null) filter.popular = { $eq: popular };
      if (userId) filter.userId = { $eq: userId };
      
      // Canvas size filtering
      if (canvasSize) {
        if (canvasSize.width) filter.canvasWidth = { $eq: canvasSize.width };
        if (canvasSize.height) filter.canvasHeight = { $eq: canvasSize.height };
      }

      // Perform vector search
      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK: limit,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        includeMetadata: true
      });

      // Filter results by similarity threshold
      const results = searchResponse.matches
        .filter(match => match.score >= threshold)
        .map(match => ({
          templateId: match.metadata.templateId,
          score: match.score,
          metadata: match.metadata
        }));

      console.log(`Template vector search for "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Error searching templates in vector store:', error);
      return [];
    }
  }

  // Get similar templates to a given template
  async getSimilarTemplates(templateId, limit = 10, options = {}) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, returning empty results');
        return [];
      }

      // Fetch the template vector
      const fetchResponse = await this.index.fetch([templateId.toString()]);
      const templateVector = fetchResponse.vectors[templateId.toString()];

      if (!templateVector) {
        console.log(`Template ${templateId} not found in vector store`);
        return [];
      }

      // Build filter
      const filter = {
        templateId: { $ne: templateId.toString() } // Exclude the template itself
      };

      if (options.type) filter.type = { $eq: options.type };
      if (options.category) filter.category = { $eq: options.category };

      // Search for similar vectors
      const searchResponse = await this.index.query({
        vector: templateVector.values,
        topK: limit,
        filter: filter,
        includeMetadata: true
      });

      const results = searchResponse.matches.map(match => ({
        templateId: match.metadata.templateId,
        score: match.score,
        metadata: match.metadata
      }));

      return results;
    } catch (error) {
      console.error('Error finding similar templates:', error);
      return [];
    }
  }

  // Batch add multiple templates
  async batchAddTemplates(templates) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, skipping batch vectorization');
        return;
      }

      const vectors = [];
      
      for (const template of templates) {
        try {
          const searchableText = this.createSearchableText(template);
          const embedding = await this.generateEmbedding(searchableText);

          // Count elements for complexity metric
          let elementCount = 0;
          if (template.pages && Array.isArray(template.pages)) {
            template.pages.forEach(page => {
              if (page.elements && Array.isArray(page.elements)) {
                elementCount += page.elements.length;
              }
            });
          }

          vectors.push({
            id: template._id.toString(),
            values: embedding,
            metadata: {
              templateId: template._id.toString(),
              userId: template.userId,
              title: template.title,
              description: template.description || '',
              type: template.type,
              category: template.category || 'uncategorized',
              tags: template.tags || [],
              createdAt: template.createdAt ? template.createdAt.toISOString() : new Date().toISOString(),
              searchableText: searchableText,
              elementCount: elementCount
            }
          });
        } catch (error) {
          console.error(`Error processing template ${template._id} for vectorization:`, error);
          // Continue with other templates
        }
      }

      if (vectors.length > 0) {
        await this.index.upsert(vectors);
        console.log(`Batch added ${vectors.length} templates to vector store`);
      }
    } catch (error) {
      console.error('Error batch adding templates to vector store:', error);
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
      console.error('Error getting template vector store stats:', error);
      return { available: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const templateVectorService = new TemplateVectorService();

module.exports = templateVectorService;
