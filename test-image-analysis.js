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
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const DEFAULT_USER_ID = 'default-user';

async function uploadImageAsset(filePath) {
    try {
        console.log(`📤 Uploading image as asset: ${path.basename(filePath)}`);

        // Create unique name with timestamp to avoid conflicts
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uniqueName = `Test Image - ${path.basename(filePath)} - ${timestamp}`;

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('userId', DEFAULT_USER_ID);
        form.append('name', uniqueName);

        const response = await axios.post(`${API_BASE_URL}/api/assets/upload`, form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        console.log(`✅ Asset uploaded successfully: ${response.data._id}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 409) {
            const conflictData = error.response.data;
            if (conflictData.conflict === 'content' && conflictData.existingAsset) {
                console.log(`♻️  File content already exists, reusing existing asset: ${conflictData.existingAsset.id}`);
                console.log(`📎 Existing asset name: ${conflictData.existingAsset.name}`);
                // Normalize the asset object to use _id consistently
                const normalizedAsset = {
                    ...conflictData.existingAsset,
                    _id: conflictData.existingAsset.id || conflictData.existingAsset._id
                };
                return normalizedAsset;
            } else {
                console.log('⚠️  409 Conflict Details:', conflictData);
            }
        } else {
            console.error('❌ Failed to upload asset:', error.response?.data || error.message);
        }
        throw error;
    }
}

async function createProjectFromImage(assetId, title) {
    try {
        console.log(`🚀 Creating project from image analysis for asset: ${assetId}`);

        // Create unique title with timestamp if none provided
        const uniqueTitle = title || `Project from Image Analysis - ${new Date().toISOString()}`;

        const response = await axios.post(`${API_BASE_URL}/api/projects/from-image`, {
            assetId,
            title: uniqueTitle,
            ownerId: DEFAULT_USER_ID,
            type: 'custom',
            tags: ['image-analysis', 'ai-generated']
        });

        return response.data;
    } catch (error) {
        console.error('❌ Failed to create project from image:', error.response?.data || error.message);
        if (error.response?.status === 409) {
            console.error('409 Conflict - This might indicate a duplicate asset or project name issue');
        }
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

        return projectResult;
    } catch (error) {
        console.error('❌ Route test failed:', error.message);
        throw error;
    }
}

async function main() {
    // --- 1. Grab CLI args ------------------------------------------------------
    const filePath = process.argv[2];
    const testMode = process.argv[3] || 'full'; // 'analysis', 'json', or 'full'

    if (!filePath) {
        console.error('\nUsage: node test-image-analysis.js <image-path> [mode]\n');
        console.error('Parameters:');
        console.error('  <image-path>  Path to the image file to analyze');
        console.error('  [mode]        Test mode (optional):');
        console.error('                - "json"     : Only output JSON analysis (no logs)');
        console.error('                - "analysis" : Only run local image analysis (with logs)');
        console.error('                - "full"     : Run analysis + API integration (default)\n');
        console.error('Examples:');
        console.error('  node test-image-analysis.js ./assets/test-image.jpg json');
        console.error('  node test-image-analysis.js ./assets/test-image.jpg analysis');
        console.error('  node test-image-analysis.js ./assets/test-image.jpg full');
        console.error('  node test-image-analysis.js ./assets/test-image.jpg\n');
        process.exit(1);
    }

    testImageAnalysisRoute(filePath);
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
