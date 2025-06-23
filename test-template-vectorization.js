const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Project = require('../models/Project');
const templateVectorService = require('../services/templateVectorService');

async function testTemplateVectorization() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Initialize template vector service
    await templateVectorService.initialize();
    console.log('Template vector service initialized');
    
    // Check existing templates
    const templateCount = await Project.countDocuments({ isTemplate: true });
    console.log(`Found ${templateCount} existing templates in database`);
    
    // Create a test template if none exist
    let testTemplate;
    if (templateCount === 0) {
      console.log('No templates found. Creating a test template...');
      
      testTemplate = new Project({
        title: 'Modern Business Presentation',
        description: 'A sleek and professional presentation template for business use',
        type: 'presentation',
        category: 'business',
        tags: ['business', 'professional', 'modern', 'corporate'],
        isTemplate: true,
        featured: true,
        userId: 'test-user-id',
        canvasSize: {
          name: 'HD',
          width: 1920,
          height: 1080
        },
        pages: [{
          id: 'page-1',
          name: 'Title Slide',
          canvasSize: {
            name: 'HD',
            width: 1920,
            height: 1080
          },
          elements: [
            {
              id: 'title-text',
              type: 'text',
              x: 100,
              y: 200,
              width: 800,
              height: 100,
              content: 'Your Business Presentation Title',
              fontSize: 48,
              fontFamily: 'Arial',
              isBold: true,
              color: '#333333'
            },
            {
              id: 'subtitle-text',
              type: 'text',
              x: 100,
              y: 320,
              width: 600,
              height: 50,
              content: 'Professional subtitle goes here',
              fontSize: 24,
              fontFamily: 'Arial',
              color: '#666666'
            }
          ],
          background: {
            type: 'color',
            value: '#ffffff'
          }
        }]
      });
      
      await testTemplate.save();
      console.log(`Created test template: ${testTemplate._id}`);
    } else {
      // Get the first template for testing
      testTemplate = await Project.findOne({ isTemplate: true });
      console.log(`Using existing template: ${testTemplate.title} (${testTemplate._id})`);
    }
    
    // Test adding template to vector store
    console.log('\n--- Testing Template Vectorization ---');
    await templateVectorService.addTemplate(testTemplate);
    console.log('✅ Template added to vector store');
    
    // Test search functionality
    console.log('\n--- Testing Template Search ---');
    const searchResults = await templateVectorService.searchTemplates('business presentation', {
      limit: 5,
      threshold: 0.5
    });
    
    console.log(`Found ${searchResults.length} search results:`);
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)} - ${result.metadata.title}`);
      console.log(`   Type: ${result.metadata.type}, Category: ${result.metadata.category}`);
    });
    
    // Test similar templates (if we have more than one)
    if (templateCount > 1) {
      console.log('\n--- Testing Similar Templates ---');
      const similarResults = await templateVectorService.getSimilarTemplates(testTemplate._id, 3);
      
      console.log(`Found ${similarResults.length} similar templates:`);
      similarResults.forEach((result, index) => {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)} - ${result.metadata.title}`);
      });
    }
    
    // Test vector store stats
    console.log('\n--- Vector Store Statistics ---');
    const stats = await templateVectorService.getStats();
    console.log('Stats:', stats);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test
testTemplateVectorization();
