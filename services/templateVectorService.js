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

  // Create searchable text from template metadata
  createSearchableText(template) {
    const parts = [
      template.title,
      template.description,
      template.type,
      ...(template.categories || []),
      ...(template.tags || [])
    ];

    // Handle aspectRatio for templates
    if (template.aspectRatio) {
      parts.push(template.aspectRatio);
      // Add descriptive terms for aspect ratios
      switch (template.aspectRatio) {
        case '1:1': parts.push('square', 'instagram post', 'social media'); break;
        case '4:5': parts.push('portrait', 'instagram story', 'vertical'); break;
        case '9:16': parts.push('story', 'vertical video', 'mobile'); break;
        case '16:9': parts.push('landscape', 'presentation', 'widescreen'); break;
      }
    }

    // For Project-based templates (if this is called on a Project with layoutId)
    if (template.ownerId && !template.categories) {
      // This is likely a Project being used as a template
      parts.push('user-created', 'custom-template');
      if (template.type) parts.push(template.type);
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // Extract layout information for enhanced search
  async extractLayoutInfo(layoutId) {
    try {
      // Import Layout model dynamically to avoid circular dependencies
      const Layout = require('../models/Page.ts').default;
      const layout = await Layout.findById(layoutId);
      
      if (!layout) return {};
      
      const layoutInfo = {
        elementCount: 0,
        textElementCount: 0,
        imageElementCount: 0,
        shapeElementCount: 0,
        textContent: [],
        hasBackground: false,
        canvasSize: null
      };

      if (layout.pages && Array.isArray(layout.pages)) {
        layout.pages.forEach(page => {
          // Extract canvas size
          if (page.canvas && !layoutInfo.canvasSize) {
            layoutInfo.canvasSize = {
              width: page.canvas.width,
              height: page.canvas.height
            };
          }

          // Check background
          if (page.background && page.background.type !== 'color') {
            layoutInfo.hasBackground = true;
          }

          // Process elements
          if (page.elements && Array.isArray(page.elements)) {
            page.elements.forEach(element => {
              layoutInfo.elementCount++;
              
              switch (element.kind) {
                case 'text':
                  layoutInfo.textElementCount++;
                  if (element.content) {
                    layoutInfo.textContent.push(element.content);
                  }
                  break;
                case 'image':
                  layoutInfo.imageElementCount++;
                  if (element.alt) {
                    layoutInfo.textContent.push(element.alt);
                  }
                  break;
                case 'shape':
                  layoutInfo.shapeElementCount++;
                  break;
              }
            });
          }
        });
      }

      return layoutInfo;
    } catch (error) {
      console.error('Error extracting layout info:', error);
      return {};
    }
  }

  // Add template to vector store
  async addTemplate(template) {
    try {
      if (!this.initialized || !this.index) {
        console.log('Template vector store not available, skipping vectorization');
        return;
      }

      // Extract layout information if layoutId exists
      const layoutInfo = template.layoutId ? await this.extractLayoutInfo(template.layoutId) : {};
      
      // Create enhanced searchable text
      const baseSearchableText = this.createSearchableText(template);
      const layoutSearchableText = layoutInfo.textContent ? layoutInfo.textContent.join(' ') : '';
      const searchableText = `${baseSearchableText} ${layoutSearchableText}`.trim();

      const embedding = await this.generateEmbedding(searchableText);

      // Determine if this is a Template model or Project model
      const isTemplateModel = template.categories !== undefined || template.aspectRatio !== undefined;
      const isProjectModel = template.ownerId !== undefined;

      const vector = {
        id: template._id.toString(),
        values: embedding,
        metadata: {
          templateId: template._id.toString(),
          title: template.title,
          description: template.description || '',
          searchableText: searchableText,
          
          // Template-specific fields
          ...(isTemplateModel && {
            type: 'template',
            slug: template.slug,
            aspectRatio: template.aspectRatio,
            categories: template.categories || [],
            tags: template.tags || [],
            popularity: template.popularity || 0,
            status: template.status || 'active',
            version: template.version || 1
          }),
          
          // Project-specific fields (when used as template)
          ...(isProjectModel && {
            type: 'project-template',
            ownerId: template.ownerId?.toString(),
            projectType: template.type,
            starred: template.starred || false,
            sharedWith: template.sharedWith?.map(id => id.toString()) || [],
            sourceTemplateId: template.sourceTemplateId?.toString()
          }),
          
          // Layout information
          ...(layoutInfo.canvasSize && {
            canvasWidth: layoutInfo.canvasSize.width,
            canvasHeight: layoutInfo.canvasSize.height,
            aspectRatioCalculated: (layoutInfo.canvasSize.width / layoutInfo.canvasSize.height).toFixed(2)
          }),
          
          // Design complexity metrics
          elementCount: layoutInfo.elementCount || 0,
          textElementCount: layoutInfo.textElementCount || 0,
          imageElementCount: layoutInfo.imageElementCount || 0,
          shapeElementCount: layoutInfo.shapeElementCount || 0,
          
          // Design characteristics
          hasImages: (layoutInfo.imageElementCount || 0) > 0,
          hasText: (layoutInfo.textElementCount || 0) > 0,
          hasBackground: layoutInfo.hasBackground || false,
          complexity: this.calculateComplexity(layoutInfo.elementCount || 0),
          
          // Timestamps
          createdAt: template.createdAt ? template.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: template.updatedAt ? template.updatedAt.toISOString() : new Date().toISOString()
        }
      };

      await this.index.upsert([vector]);
      console.log(`Template ${template._id} (${template.title}) added to vector store`);
    } catch (error) {
      console.error('Error adding template to vector store:', error);
      // Don't throw error - allow normal template operations to continue
    }
  }

  // Calculate design complexity
  calculateComplexity(elementCount) {
    if (elementCount > 15) return 'high';
    if (elementCount > 7) return 'medium';
    return 'low';
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
        categories = null,
        aspectRatio = null,
        status = null,
        ownerId = null, // For project-based templates
        complexity = null,
        hasImages = null,
        hasText = null
      } = options;

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter for template search
      const filter = {};

      // Template model filters
      if (categories) {
        if (Array.isArray(categories)) {
          filter.categories = { $in: categories };
        } else {
          filter.categories = { $in: [categories] };
        }
      }
      if (aspectRatio) filter.aspectRatio = { $eq: aspectRatio };
      if (status) filter.status = { $eq: status };
      
      // Project model filters
      if (type) filter.projectType = { $eq: type };
      if (ownerId) filter.ownerId = { $eq: ownerId };
      
      // Design characteristic filters
      if (complexity) filter.complexity = { $eq: complexity };
      if (hasImages !== null) filter.hasImages = { $eq: hasImages };
      if (hasText !== null) filter.hasText = { $eq: hasText };

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
