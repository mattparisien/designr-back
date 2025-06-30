// testAnalysis.js
// -----------------------------------------------------------------------------
// Quick CLI to test the modular imageAnalysisService with a local image file
// and the new project creation from image analysis route.
// -----------------------------------------------------------------------------

require('dotenv').config();            // optional: loads .env if you have one
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const imageAnalysis = require('./services/imageAnalysisService'); // adjust path as needed

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';
const DEFAULT_USER_ID = 'default-user';

async function uploadImageAsset(filePath) {
  try {
    console.log(`📤 Uploading image as asset: ${path.basename(filePath)}`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('userId', DEFAULT_USER_ID);
    form.append('name', `Test Image - ${path.basename(filePath)}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/assets/upload`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    
    console.log(`✅ Asset uploaded successfully: ${response.data._id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to upload asset:', error.response?.data || error.message);
    throw error;
  }
}

async function createProjectFromImage(assetId, title) {
  try {
    console.log(`🚀 Creating project from image analysis for asset: ${assetId}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/projects/from-image`, {
      assetId,
      title: title || `Project from Image Analysis - ${new Date().toISOString()}`,
      ownerId: DEFAULT_USER_ID,
      type: 'custom',
      tags: ['image-analysis', 'ai-generated']
    });
    
    console.log(`✅ Project created successfully: ${response.data.project._id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create project:', error.response?.data || error.message);
    throw error;
  }
}

async function testImageAnalysisRoute(filePath) {
  console.log('\n🧪 Testing Image Analysis Route Integration');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Upload the image as an asset
    const asset = await uploadImageAsset(filePath);
    
    // Step 2: Create project from image analysis
    const projectResult = await createProjectFromImage(asset._id, `Test Project - ${path.basename(filePath)}`);
    
    // Step 3: Display results
    console.log('\n📊 Project Creation Results:');
    console.log(`Project ID: ${projectResult.project._id}`);
    console.log(`Project Title: ${projectResult.project.title}`);
    console.log(`Layout ID: ${projectResult.project.layoutId}`);
    
    console.log('\n📐 Analysis Data Summary:');
    const analysisData = projectResult.analysisData;
    console.log(`Canvas Size: ${analysisData.canvas?.width}x${analysisData.canvas?.height}`);
    console.log(`Elements Found: ${analysisData.elements?.length || 0}`);
    console.log(`Background: ${JSON.stringify(analysisData.background)}`);
    
    if (analysisData.elements && analysisData.elements.length > 0) {
      console.log('\n📝 Detected Elements:');
      analysisData.elements.forEach((element, index) => {
        console.log(`  ${index + 1}. ${element.kind} - ${element.content || element.shapeType || 'N/A'}`);
        console.log(`     Position: (${element.x}, ${element.y}) Size: ${element.width}x${element.height}`);
      });
    }
    
    return projectResult;
  } catch (error) {
    console.error('❌ Route test failed:', error.message);
    throw error;
  }
}

async function main() {
  // --- 1. Grab CLI arg -------------------------------------------------------
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('\nUsage: node test-image-analysis.js ./assets/test-image.jpg\n');
    console.error('This will:');
    console.error('1. Analyze the image locally using imageAnalysisService');
    console.error('2. Upload the image as an asset');
    console.error('3. Create a project using the new /projects/from-image route\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Testing Image Analysis with: ${path.resolve(filePath)}\n`);

  try {
    // --- 2. Test local image analysis service --------------------------------
    console.log('📋 Step 1: Local Image Analysis');
    console.log('-'.repeat(30));
    
    await imageAnalysis.initialize();
    const analysis = await imageAnalysis.analyzeLocalImage(filePath);

    if (!analysis) {
      console.error('❌  Local analysis failed (see logs above).');
      process.exit(1);
    }

    // --- 3. Pretty-print local analysis results ------------------------------
    console.log('🎨 Local Analysis Results:\n');
    console.log(JSON.stringify(analysis, null, 2));

    console.log('\n📝 Searchable text:');
    console.log(imageAnalysis.createSearchableText ? imageAnalysis.createSearchableText(analysis) : 'N/A');

    console.log('\n🌈 Palette:', imageAnalysis.extractColorPalette ? imageAnalysis.extractColorPalette(analysis) : 'N/A');
    console.log('📐 Layout traits:', imageAnalysis.extractLayoutTraits ? imageAnalysis.extractLayoutTraits(analysis) : 'N/A');
    console.log('🔠 Text blocks:', imageAnalysis.extractTextBlocks ? imageAnalysis.extractTextBlocks(analysis) : 'N/A');

    // --- 4. Test the new API route -------------------------------------------
    console.log('\n' + '='.repeat(60));
    const projectResult = await testImageAnalysisRoute(filePath);

    // --- 5. Compare local vs API results -------------------------------------
    console.log('\n🔍 Comparison Summary:');
    console.log('-'.repeat(30));
    console.log(`Local analysis elements: ${analysis.pages?.[0]?.elements?.length || 0}`);
    console.log(`API analysis elements: ${projectResult.analysisData?.elements?.length || 0}`);
    
    console.log('\n✅ Test completed successfully!');
    console.log(`Project created with ID: ${projectResult.project._id}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
