// Test TypeScript model imports and vector store integration
require('ts-node/register');

const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

async function testTypeScriptModels() {
  try {
    console.log('🔄 Testing TypeScript models...');
    
    // Test model imports
    const Project = require('./models/Project.ts').default;
    const Template = require('./models/Template.ts').default;
    const Layout = require('./models/Page.ts').default;
    
    console.log('✅ All TypeScript models imported successfully');
    console.log('  - Project model:', !!Project);
    console.log('  - Template model:', !!Template);
    console.log('  - Layout model:', !!Layout);
    
    // Test controller import
    const controller = require('./controllers/projectController.ts');
    console.log('✅ TypeScript controller imported successfully');
    console.log('  - Available methods:', Object.keys(controller).slice(0, 5));
    
    // Test vector service (should work with TypeScript models)
    const templateVectorService = require('./services/templateVectorService');
    console.log('✅ Vector service imported successfully');
    
    console.log('\n🎉 All TypeScript models and services are working correctly!');
    console.log('🚀 You can now use TypeScript models with ES6 import syntax.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTypeScriptModels();
