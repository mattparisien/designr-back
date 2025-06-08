// Simple test to verify services can be loaded
console.log('🔬 Testing service imports...');

try {
  const dotenv = require('dotenv');
  dotenv.config();
  console.log('✅ Environment loaded');
  
  const imageAnalysisService = require('../services/imageAnalysisService');
  console.log('✅ Image analysis service imported');
  
  const imageVectorService = require('../services/imageVectorService');
  console.log('✅ Image vector service imported');
  
  const vectorStoreService = require('../services/vectorStore');
  console.log('✅ Vector store service imported');
  
  console.log('🎉 All services can be imported successfully!');
  
  // Test service initialization without database
  console.log('\n🔧 Testing service methods...');
  
  // Test if methods exist
  console.log('Image Analysis Service methods:', Object.getOwnPropertyNames(imageAnalysisService));
  console.log('Image Vector Service methods:', Object.getOwnPropertyNames(imageVectorService));
  console.log('Vector Store Service methods:', Object.getOwnPropertyNames(vectorStoreService));
  
} catch (error) {
  console.error('❌ Service import failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n✅ Simple test completed');
