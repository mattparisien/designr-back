#!/usr/bin/env node

// Simple focused test for canvas aspect ratio preservation
const fs = require('fs');

async function testAspectRatioPreservation() {
  console.log('🎯 Testing Canvas Aspect Ratio Preservation\n');

  // Test data - simple 1x1 pixel PNG
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  // Test cases with different aspect ratios
  const testCases = [
    { name: 'Instagram Story', width: 1080, height: 1920, expected: '9:16 portrait' },
    { name: 'YouTube Thumbnail', width: 1280, height: 720, expected: '16:9 landscape' },
    { name: 'Square Canvas', width: 800, height: 800, expected: '1:1 square' },
    { name: 'A4 Portrait', width: 2480, height: 3508, expected: 'A4 portrait' }
  ];

  for (const testCase of testCases) {
    console.log(`📏 Testing: ${testCase.name} (${testCase.width}x${testCase.height})`);

    try {
      // Make the API call using curl (more reliable than Node HTTP)
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const payload = JSON.stringify({
        imageData: testBase64,
        canvasWidth: testCase.width,
        canvasHeight: testCase.height,
        format: 'png',
        quality: 100,
        downloadMode: 'direct',
        fileName: `test_${testCase.name.toLowerCase().replace(/\s+/g, '_')}.png`
      });

      // Write payload to temp file to avoid shell escaping issues
      const tempFile = `./temp_payload_${Date.now()}.json`;
      fs.writeFileSync(tempFile, payload);

      const curlCommand = `curl -s -X POST http://localhost:3001/api/canvas/export \\
        -H "Content-Type: application/json" \\
        -d @${tempFile} \\
        -o "./test_${testCase.name.toLowerCase().replace(/\s+/g, '_')}.png" \\
        -w "%{http_code}"`;

      const { stdout } = await execAsync(curlCommand);
      const httpCode = stdout.trim();

      // Clean up temp file
      fs.unlinkSync(tempFile);

      if (httpCode === '200') {
        console.log('   ✅ Export successful');

        // Verify the exported file dimensions
        const fileName = `./test_${testCase.name.toLowerCase().replace(/\s+/g, '_')}.png`;
        if (fs.existsSync(fileName)) {
          const sharp = require('sharp');
          const metadata = await sharp(fileName).metadata();
          
          console.log(`   📐 Expected: ${testCase.width}x${testCase.height}`);
          console.log(`   📐 Actual: ${metadata.width}x${metadata.height}`);
          
          const dimensionsMatch = metadata.width === testCase.width && metadata.height === testCase.height;
          console.log(`   ${dimensionsMatch ? '✅' : '❌'} Dimensions ${dimensionsMatch ? 'MATCH' : 'MISMATCH'}`);
          
          const expectedRatio = testCase.width / testCase.height;
          const actualRatio = metadata.width / metadata.height;
          const ratioMatch = Math.abs(expectedRatio - actualRatio) < 0.001;
          console.log(`   ${ratioMatch ? '✅' : '❌'} Aspect ratio ${ratioMatch ? 'PRESERVED' : 'DISTORTED'}`);
          console.log(`   📊 Expected ratio: ${expectedRatio.toFixed(3)}, Actual: ${actualRatio.toFixed(3)}`);
          
          if (dimensionsMatch && ratioMatch) {
            console.log(`   🎉 ${testCase.name} export PERFECT!`);
          } else {
            console.log(`   ⚠️  ${testCase.name} export has issues`);
          }
        } else {
          console.log('   ❌ Export file not found');
        }
      } else {
        console.log(`   ❌ HTTP error: ${httpCode}`);
      }

    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    console.log('');
  }

  console.log('🏁 Aspect Ratio Test Summary:');
  console.log('   The canvas export should maintain EXACT dimensions');
  console.log('   - 1080x1920 should export as exactly 1080x1920 pixels');
  console.log('   - 1280x720 should export as exactly 1280x720 pixels');
  console.log('   - No scaling, stretching, or aspect ratio changes');
  
  console.log('\n💡 Frontend Integration:');
  console.log('   // Get your canvas element');
  console.log('   const canvas = document.getElementById("myCanvas");');
  console.log('   ');
  console.log('   // Export with EXACT canvas dimensions');
  console.log('   const exportData = {');
  console.log('     imageData: canvas.toDataURL("image/png"),');
  console.log('     canvasWidth: canvas.width,   // Use actual canvas.width');
  console.log('     canvasHeight: canvas.height, // Use actual canvas.height');
  console.log('     format: "png"');
  console.log('   };');
  console.log('   ');
  console.log('   // The exported image will be EXACTLY canvas.width x canvas.height');
}

// Run the test
testAspectRatioPreservation().catch(console.error);
