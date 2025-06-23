#!/usr/bin/env node

/**
 * Template Vector Migration Script
 * 
 * This script migrates existing templates to the vector store for search capabilities.
 * It can be run to:
 * 1. Initialize vector store with existing templates
 * 2. Re-index templates after schema changes
 * 3. Batch process templates for vector embedding
 */

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Project = require('../models/Project');
const templateVectorService = require('../services/templateVectorService');

class TemplateMigrator {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.batchSize = 10; // Process in batches to avoid overwhelming the API
  }

  async initialize() {
    try {
      await connectDB();
      console.log('Connected to MongoDB');
      
      await templateVectorService.initialize();
      console.log('Template vector service initialized');
      
      return true;
    } catch (error) {
      console.error('Initialization failed:', error);
      return false;
    }
  }

  async migrateAllTemplates() {
    try {
      console.log('Starting template migration to vector store...\n');
      
      // Get all templates
      const templates = await Project.find({ isTemplate: true });
      console.log(`Found ${templates.length} templates to migrate`);
      
      if (templates.length === 0) {
        console.log('No templates found to migrate');
        return;
      }

      // Process in batches
      for (let i = 0; i < templates.length; i += this.batchSize) {
        const batch = templates.slice(i, i + this.batchSize);
        console.log(`\nProcessing batch ${Math.floor(i / this.batchSize) + 1} of ${Math.ceil(templates.length / this.batchSize)}`);
        
        await this.processBatch(batch);
        
        // Add delay between batches to avoid rate limiting
        if (i + this.batchSize < templates.length) {
          console.log('Waiting 2 seconds before next batch...');
          await this.delay(2000);
        }
      }

      console.log(`\n✅ Migration completed!`);
      console.log(`📊 Statistics:`);
      console.log(`   - Templates processed: ${this.processedCount}`);
      console.log(`   - Errors: ${this.errorCount}`);
      console.log(`   - Success rate: ${((this.processedCount / templates.length) * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  async processBatch(templates) {
    const promises = templates.map(template => this.processTemplate(template));
    await Promise.allSettled(promises);
  }

  async processTemplate(template) {
    try {
      console.log(`Processing: "${template.title}" (${template._id})`);
      
      await templateVectorService.addTemplate(template);
      
      this.processedCount++;
      console.log(`✅ Success: "${template.title}"`);
      
    } catch (error) {
      this.errorCount++;
      console.error(`❌ Error processing "${template.title}":`, error.message);
    }
  }

  async clearVectorStore() {
    try {
      console.log('Clearing template vector store...');
      
      const stats = await templateVectorService.getStats();
      if (stats.available && stats.totalVectors > 0) {
        console.log(`Found ${stats.totalVectors} vectors in store`);
        
        // Get all templates to remove their vectors
        const templates = await Project.find({ isTemplate: true });
        
        for (const template of templates) {
          try {
            await templateVectorService.removeTemplate(template._id);
            console.log(`Removed vector for: ${template.title}`);
          } catch (error) {
            console.error(`Error removing vector for ${template.title}:`, error.message);
          }
        }
        
        console.log('Vector store cleared');
      } else {
        console.log('Vector store is empty or not available');
      }
      
    } catch (error) {
      console.error('Error clearing vector store:', error);
    }
  }

  async getVectorStoreStats() {
    try {
      const stats = await templateVectorService.getStats();
      
      console.log('📊 Template Vector Store Statistics:');
      console.log(`   - Available: ${stats.available}`);
      
      if (stats.available) {
        console.log(`   - Total vectors: ${stats.totalVectors || 0}`);
        console.log(`   - Dimension: ${stats.dimension || 'N/A'}`);
        console.log(`   - Index fullness: ${((stats.indexFullness || 0) * 100).toFixed(2)}%`);
      } else {
        console.log(`   - Error: ${stats.error || 'Unknown error'}`);
      }
      
      // Also get template count from database
      const templateCount = await Project.countDocuments({ isTemplate: true });
      console.log(`   - Templates in DB: ${templateCount}`);
      
      if (stats.available && templateCount > 0) {
        const vectorizedPercentage = ((stats.totalVectors || 0) / templateCount * 100).toFixed(1);
        console.log(`   - Vectorized: ${vectorizedPercentage}%`);
      }
      
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  }

  async testSearch(query = 'business presentation') {
    try {
      console.log(`🔍 Testing template search with query: "${query}"`);
      
      const results = await templateVectorService.searchTemplates(query, {
        limit: 5,
        threshold: 0.5
      });
      
      console.log(`Found ${results.length} results:`);
      
      results.forEach((result, index) => {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)} - Template: ${result.metadata.title}`);
        console.log(`   Type: ${result.metadata.type}, Category: ${result.metadata.category}`);
        console.log(`   Elements: ${result.metadata.elementCount || 0}, Pages: ${result.metadata.pageCount || 0}`);
      });
      
    } catch (error) {
      console.error('Search test failed:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

// Command line interface
async function main() {
  const migrator = new TemplateMigrator();
  
  const initialized = await migrator.initialize();
  if (!initialized) {
    console.error('Failed to initialize. Exiting...');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  try {
    switch (command) {
      case 'migrate':
        await migrator.migrateAllTemplates();
        break;
        
      case 'clear':
        await migrator.clearVectorStore();
        break;
        
      case 'stats':
        await migrator.getVectorStoreStats();
        break;
        
      case 'test':
        const query = args[1] || 'business presentation';
        await migrator.testSearch(query);
        break;
        
      case 'full-reset':
        console.log('Performing full reset...');
        await migrator.clearVectorStore();
        await migrator.delay(2000);
        await migrator.migrateAllTemplates();
        break;
        
      default:
        console.log('Usage: node template-vector-migrator.js [command] [args]');
        console.log('Commands:');
        console.log('  migrate      - Migrate all templates to vector store (default)');
        console.log('  clear        - Clear all vectors from store');
        console.log('  stats        - Show vector store statistics');
        console.log('  test [query] - Test search functionality');
        console.log('  full-reset   - Clear and re-migrate all templates');
        break;
    }
  } catch (error) {
    console.error('Command failed:', error);
  } finally {
    await migrator.cleanup();
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n\nScript interrupted. Cleaning up...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('unhandledRejection', async (error) => {
  console.error('Unhandled promise rejection:', error);
  await mongoose.connection.close();
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = TemplateMigrator;
