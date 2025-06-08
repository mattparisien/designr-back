#!/usr/bin/env node
// filepath: /Users/mattparisien/Dropbox/Development/canva-clone/back/scripts/test-image-analysis.js

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Asset = require('../models/Asset');
const imageAnalysisService = require('../services/imageAnalysisService');
const vectorStoreService = require('../services/vectorStore');

async function testImageAnalysis() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await connectDB();
    
    console.log('🔧 Initializing services...');
    await imageAnalysisService.initialize();
    await vectorStoreService.initialize();
    
    // Find an image asset to test with
    const imageAsset = await Asset.findOne({ 
      type: 'image',
      $or: [
        { cloudinaryUrl: { $exists: true, $ne: null } },
        { url: { $exists: true, $ne: null } }
      ]
    });
    
    if (!imageAsset) {
      console.log('❌ No image assets found for testing');
      return;
    }
    
    console.log('📷 Found test image:', imageAsset.name);
    console.log('🔗 Image URL:', imageAsset.cloudinaryUrl || imageAsset.url);
    
    // Perform analysis
    console.log('🔍 Starting AI analysis...');
    const imageUrl = imageAsset.cloudinaryUrl || imageAsset.url;
    const analysis = await imageAnalysisService.analyzeImage(imageUrl);
    
    if (analysis) {
      console.log('✅ Analysis completed successfully!');
      console.log('📝 Results:');
      console.log('   Description:', analysis.description);
      console.log('   Objects detected:', analysis.objects?.length || 0, analysis.objects);
      console.log('   Colors identified:', analysis.colors?.length || 0, analysis.colors);
      console.log('   Themes:', analysis.themes?.length || 0, analysis.themes);
      console.log('   Mood:', analysis.mood);
      console.log('   Style:', analysis.style);
      console.log('   Categories:', analysis.categories);
      
      if (analysis.text) {
        console.log('   Text in image:', analysis.text);
      }
      
      // Test searchable text creation
      const searchableText = imageAnalysisService.createSearchableTextFromAnalysis(analysis);
      console.log('\n🔤 Searchable text length:', searchableText.length);
      console.log('🔤 Sample searchable text:', searchableText.substring(0, 200) + '...');
      
      // Update the asset with analysis results
      console.log('\n💾 Updating asset with analysis results...');
      const updatedMetadata = {
        ...imageAsset.metadata,
        aiAnalysis: analysis,
        aiDescription: analysis.description,
        detectedObjects: analysis.objects || [],
        dominantColors: analysis.colors || [],
        extractedText: analysis.text || '',
        visualThemes: analysis.themes || [],
        mood: analysis.mood || '',
        style: analysis.style || '',
        categories: analysis.categories || [],
        composition: analysis.composition || '',
        lighting: analysis.lighting || '',
        setting: analysis.setting || ''
      };
      
      await Asset.findByIdAndUpdate(imageAsset._id, {
        metadata: updatedMetadata,
        vectorized: false // Mark for re-vectorization
      });
      
      console.log('✅ Asset updated successfully');
      
      // Test enhanced vector search
      console.log('\n🔍 Testing enhanced searchable text generation...');
      const updatedAsset = await Asset.findById(imageAsset._id);
      const enhancedSearchableText = vectorStoreService.createSearchableText(updatedAsset);
      
      console.log('📝 Enhanced searchable text length:', enhancedSearchableText.length);
      console.log('📝 Enhanced searchable text preview:', enhancedSearchableText.substring(0, 300) + '...');
      
      // Test vector embedding generation
      console.log('\n🧮 Testing vector embedding generation...');
      const embedding = await vectorStoreService.generateEmbedding(enhancedSearchableText);
      console.log('✅ Generated embedding with', embedding.length, 'dimensions');
      
    } else {
      console.log('❌ Analysis failed or returned null');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    console.log('\n🔚 Closing database connection...');
    await mongoose.disconnect();
  }
}

async function testBatchAnalysis() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await connectDB();
    
    console.log('🔧 Initializing services...');
    await imageAnalysisService.initialize();
    
    // Find multiple image assets
    const imageAssets = await Asset.find({ 
      type: 'image',
      $or: [
        { cloudinaryUrl: { $exists: true, $ne: null } },
        { url: { $exists: true, $ne: null } }
      ],
      'metadata.aiAnalysis': { $exists: false }
    }).limit(3);
    
    if (imageAssets.length === 0) {
      console.log('❌ No unanalyzed image assets found for batch testing');
      return;
    }
    
    console.log(`📷 Found ${imageAssets.length} images for batch analysis`);
    
    for (let i = 0; i < imageAssets.length; i++) {
      const asset = imageAssets[i];
      console.log(`\n🔍 Analyzing ${i + 1}/${imageAssets.length}: ${asset.name}`);
      
      try {
        const imageUrl = asset.cloudinaryUrl || asset.url;
        const analysis = await imageAnalysisService.analyzeImage(imageUrl);
        
        if (analysis) {
          console.log('   ✅ Success! Objects:', analysis.objects?.length || 0, 'Colors:', analysis.colors?.length || 0);
          
          // Update asset
          const updatedMetadata = {
            ...asset.metadata,
            aiAnalysis: analysis,
            aiDescription: analysis.description,
            detectedObjects: analysis.objects || [],
            dominantColors: analysis.colors || [],
            extractedText: analysis.text || '',
            visualThemes: analysis.themes || [],
            mood: analysis.mood || '',
            style: analysis.style || '',
            categories: analysis.categories || [],
            composition: analysis.composition || '',
            lighting: analysis.lighting || '',
            setting: analysis.setting || ''
          };
          
          await Asset.findByIdAndUpdate(asset._id, {
            metadata: updatedMetadata,
            vectorized: false
          });
        } else {
          console.log('   ❌ Analysis failed');
        }
      } catch (error) {
        console.log('   ❌ Error:', error.message);
      }
      
      // Add delay to avoid overwhelming the API
      if (i < imageAssets.length - 1) {
        console.log('   ⏳ Waiting before next analysis...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
  } catch (error) {
    console.error('❌ Error during batch testing:', error);
  } finally {
    console.log('\n🔚 Closing database connection...');
    await mongoose.disconnect();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'single':
      console.log('🧪 Testing single image analysis...\n');
      await testImageAnalysis();
      break;
    case 'batch':
      console.log('🧪 Testing batch image analysis...\n');
      await testBatchAnalysis();
      break;
    default:
      console.log('Usage: node test-image-analysis.js [single|batch]');
      console.log('  single - Test analysis on one image');
      console.log('  batch  - Test batch analysis on multiple images');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
