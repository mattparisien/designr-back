#!/usr/bin/env node

/**
 * Vector Store Management Script
 * 
 * This script provides utilities for managing the vector store:
 * - Initialize vector store
 * - Vectorize all existing assets
 * - Check vectorization status
 * - Clear vector store
 */

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const vectorStoreService = require('../services/vectorStore');
const vectorJobProcessor = require('../services/vectorJobProcessor');
const Asset = require('../models/Asset');

const args = process.argv.slice(2);
const command = args[0];

async function initializeVectorStore() {
  console.log('Initializing vector store...');
  try {
    await vectorStoreService.initialize();
    console.log('✅ Vector store initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize vector store:', error.message);
    process.exit(1);
  }
}

async function vectorizeAllAssets(userId = 'default-user', force = false) {
  console.log(`Vectorizing all assets for user: ${userId}${force ? ' (forced re-vectorization)' : ''}...`);
  
  try {
    const result = await vectorJobProcessor.processAllUnvectorized();
    console.log('✅ Vectorization completed:');
    console.log(`   - Processed: ${result.processed} assets`);
    console.log(`   - Failed: ${result.failed} assets`);
    console.log(`   - Skipped: ${result.skipped} assets`);
  } catch (error) {
    console.error('❌ Vectorization failed:', error.message);
    process.exit(1);
  }
}

async function checkStatus(userId = 'default-user') {
  console.log(`Checking vectorization status for user: ${userId}...`);
  
  try {
    const totalAssets = await Asset.countDocuments({ userId });
    const vectorizedAssets = await Asset.countDocuments({ userId, vectorized: true });
    const pendingAssets = totalAssets - vectorizedAssets;
    
    console.log('📊 Vectorization Status:');
    console.log(`   - Total assets: ${totalAssets}`);
    console.log(`   - Vectorized: ${vectorizedAssets}`);
    console.log(`   - Pending: ${pendingAssets}`);
    console.log(`   - Progress: ${totalAssets > 0 ? ((vectorizedAssets / totalAssets) * 100).toFixed(2) : 0}%`);
    
    const queueStats = vectorJobProcessor.getStatus();
    console.log('🔄 Queue Status:');
    console.log(`   - Jobs in queue: ${queueStats.totalJobs}`);
    console.log(`   - Currently processing: ${queueStats.processing}`);
  } catch (error) {
    console.error('❌ Failed to check status:', error.message);
    process.exit(1);
  }
}

async function clearVectorStore(userId = 'default-user') {
  console.log(`Clearing vector store for user: ${userId}...`);
  
  try {
    // Reset vectorization status in database
    await Asset.updateMany(
      { userId },
      { 
        $set: { vectorized: false },
        $unset: { vectorLastUpdated: 1 }
      }
    );
    
    console.log('✅ Vector store cleared and asset status reset');
  } catch (error) {
    console.error('❌ Failed to clear vector store:', error.message);
    process.exit(1);
  }
}

async function searchAssets(query, userId = 'default-user', limit = 10) {
  console.log(`Searching for: "${query}" (user: ${userId})...`);
  
  try {
    const results = await vectorStoreService.searchAssets(query, userId, { limit });
    
    if (results.length === 0) {
      console.log('No results found');
      return;
    }
    
    console.log(`Found ${results.length} similar assets:`);
    for (const result of results) {
      const asset = await Asset.findById(result.assetId);
      if (asset) {
        console.log(`   - ${asset.name} (similarity: ${(result.similarity * 100).toFixed(2)}%)`);
      }
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  await connectDB();
  
  switch (command) {
    case 'init':
      await initializeVectorStore();
      break;
      
    case 'vectorize':
      const userId = args[1] || 'default-user';
      const force = args.includes('--force');
      await vectorizeAllAssets(userId, force);
      break;
      
    case 'status':
      const statusUserId = args[1] || 'default-user';
      await checkStatus(statusUserId);
      break;
      
    case 'clear':
      const clearUserId = args[1] || 'default-user';
      await clearVectorStore(clearUserId);
      break;
      
    case 'search':
      const searchQuery = args[1];
      const searchUserId = args[2] || 'default-user';
      const searchLimit = parseInt(args[3]) || 10;
      
      if (!searchQuery) {
        console.error('❌ Search query is required');
        console.log('Usage: npm run vector search "query" [userId] [limit]');
        process.exit(1);
      }
      
      await searchAssets(searchQuery, searchUserId, searchLimit);
      break;
      
    default:
      console.log('Vector Store Management Script');
      console.log('');
      console.log('Usage:');
      console.log('  npm run vector <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  init                         Initialize vector store');
      console.log('  vectorize [userId] [--force] Vectorize all assets for user');
      console.log('  status [userId]              Check vectorization status');
      console.log('  clear [userId]               Clear vector store for user');
      console.log('  search "query" [userId] [limit] Search assets by similarity');
      console.log('');
      console.log('Examples:');
      console.log('  npm run vector init');
      console.log('  npm run vector vectorize default-user');
      console.log('  npm run vector vectorize default-user --force');
      console.log('  npm run vector status');
      console.log('  npm run vector search "logo design" default-user 5');
      process.exit(0);
  }
  
  await mongoose.connection.close();
  console.log('✅ Done');
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
