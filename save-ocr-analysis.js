#!/usr/bin/env node
// save-ocr-analysis.js
// -----------------------------------------------------------------------------
// Run OCR analysis on an image and save the results to a local JSON file
// -----------------------------------------------------------------------------

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ocrService = require('./services/ocrService');

/**
 * Process an image with OCR and save results to JSON file
 */
async function saveOCRAnalysis(imagePath, outputPath) {
  try {
    console.log(`🔍 Processing image with OCR: ${imagePath}`);
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Run OCR analysis
    const results = await ocrService.detectLines(imagePath);
    
    console.log(`✅ OCR completed. Found ${results.length} text lines.`);
    
    // Log results for debugging
    results.forEach((line, index) => {
      console.log(`  ${index + 1}. "${line.text}" at (${line.x}, ${line.y}) fontPx: ${line.fontPx}`);
    });

    // Create enhanced output with metadata
    const output = {
      metadata: {
        imagePath: path.basename(imagePath),
        fullImagePath: path.resolve(imagePath),
        timestamp: new Date().toISOString(),
        totalTextBlocks: results.length,
        totalCharacters: results.reduce((sum, line) => sum + line.text.length, 0),
        averageFontSize: results.length > 0 
          ? Math.round(results.reduce((sum, line) => sum + line.fontPx, 0) / results.length) 
          : 0,
        processingInfo: {
          ocrEngine: 'tesseract.js',
          outputFormat: 'hOCR',
          coordinateSystem: 'top-left origin (0,0)',
          units: 'pixels'
        }
      },
      ocrResults: results,
      statistics: {
        textBlocksByFontSize: {},
        textBlocksByPosition: {
          topHalf: results.filter(r => r.y < 500).length,
          bottomHalf: results.filter(r => r.y >= 500).length,
          leftHalf: results.filter(r => r.x < 500).length,
          rightHalf: results.filter(r => r.x >= 500).length
        },
        longestText: results.reduce((longest, current) => 
          current.text.length > longest.length ? current.text : longest, ''),
        shortestText: results.reduce((shortest, current) => 
          current.text.length < shortest.length ? current.text : shortest, results[0]?.text || '')
      }
    };

    // Calculate font size distribution
    results.forEach(result => {
      const fontSize = Math.round(result.fontPx / 5) * 5; // Group by 5px increments
      const key = `${fontSize}px`;
      output.statistics.textBlocksByFontSize[key] = 
        (output.statistics.textBlocksByFontSize[key] || 0) + 1;
    });

    // Write to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`📄 OCR analysis saved to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   • Text blocks found: ${results.length}`);
    console.log(`   • Total characters: ${output.metadata.totalCharacters}`);
    console.log(`   • Average font size: ${output.metadata.averageFontSize}px`);
    console.log(`   • File size: ${Math.round(fs.statSync(outputPath).size / 1024)}KB`);

    return output;
  } catch (error) {
    console.error('❌ OCR analysis failed:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const imagePath = process.argv[2] || './assets/screenshot.png';
  const outputDir = './ocr-outputs';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate output filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(imagePath, path.extname(imagePath));
  const outputPath = path.join(outputDir, `${baseName}-ocr-${timestamp}.json`);
  
  console.log('🔍 OCR Analysis & JSON Export');
  console.log('='.repeat(50));
  console.log(`📁 Input image: ${imagePath}`);
  console.log(`📄 Output file: ${outputPath}`);
  
  // Check if image exists
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image file not found: ${imagePath}`);
    console.log('\nUsage:');
    console.log('  node save-ocr-analysis.js [image-path]');
    console.log('\nExamples:');
    console.log('  node save-ocr-analysis.js ./assets/screenshot.png');
    console.log('  node save-ocr-analysis.js /path/to/your/image.jpg');
    process.exit(1);
  }

  try {
    const result = await saveOCRAnalysis(imagePath, outputPath);
    
    console.log('\n✅ OCR analysis completed successfully!');
    console.log(`\n📋 Quick preview of detected text:`);
    result.ocrResults.slice(0, 5).forEach((line, index) => {
      console.log(`   ${index + 1}. "${line.text.substring(0, 50)}${line.text.length > 50 ? '...' : ''}"`);
    });
    
    if (result.ocrResults.length > 5) {
      console.log(`   ... and ${result.ocrResults.length - 5} more text blocks`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { saveOCRAnalysis };
