#!/usr/bin/env node
// test-ocr-viewer.js
// -----------------------------------------------------------------------------
// OCR Test & Viewer - Processes an image with OCR and serves the hOCR markup
// in a visual HTML page for debugging and inspection.
// -----------------------------------------------------------------------------

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const ocrService = require('./services/ocrService');

// Configuration
const PORT = 3002;
const DEFAULT_IMAGE = './assets/screenshot.png';

// Store OCR results
let ocrResults = null;
let originalImagePath = null;

/**
 * Process an image with OCR and extract hOCR data
 */
async function processImageWithOCR(imagePath) {
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

    return results;
  } catch (error) {
    console.error('❌ OCR processing failed:', error.message);
    throw error;
  }
}

/**
 * Generate HTML page with OCR visualization
 */
function generateOCRVisualizationHTML(ocrResults, imagePath) {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const imageMimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  const imageDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OCR Results Viewer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 20px;
        }
        .image-section {
            text-align: center;
        }
        .image-container {
            position: relative;
            display: inline-block;
            border: 2px solid #e5e7eb;
            border-radius: 4px;
            background: #f8fafc;
        }
        .ocr-image {
            max-width: 100%;
            height: auto;
            display: block;
        }
        .ocr-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        }
        .text-overlay {
            position: absolute;
            border: 2px solid #ef4444;
            background: rgba(239, 68, 68, 0.1);
            pointer-events: all;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: monospace;
            font-size: 12px;
            color: #dc2626;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 2px;
            box-sizing: border-box;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .text-overlay:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: #dc2626;
            z-index: 20;
        }
        .text-overlay.active {
            background: rgba(34, 197, 94, 0.2);
            border-color: #16a34a;
            color: #15803d;
        }
        .canvas-controls {
            margin: 15px 0;
            text-align: center;
        }
        .toggle-btn {
            background: #059669;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 0 5px;
            font-size: 12px;
        }
        .toggle-btn:hover {
            background: #047857;
        }
        .toggle-btn.active {
            background: #dc2626;
        }
        .results-section {
            overflow-y: auto;
            max-height: 600px;
        }
        .stats {
            background: #f8fafc;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #10b981;
        }
        .text-block {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 10px;
            transition: all 0.2s;
            cursor: pointer;
        }
        .text-block:hover {
            background: #f9fafb;
            border-color: #2563eb;
        }
        .text-block.highlighted {
            background: #dcfce7;
            border-color: #16a34a;
            box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
        }
        .text-content {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
            word-break: break-word;
        }
        .text-meta {
            font-size: 12px;
            color: #6b7280;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 8px;
        }
        .meta-item {
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 3px;
        }
        .controls {
            text-align: center;
            padding: 20px;
            border-top: 1px solid #e5e7eb;
            background: #f8fafc;
        }
        .btn {
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 0 5px;
            font-size: 14px;
        }
        .btn:hover {
            background: #1d4ed8;
        }
        .btn-secondary {
            background: #6b7280;
        }
        .btn-secondary:hover {
            background: #4b5563;
        }
        @media (max-width: 768px) {
            .content {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 OCR Results Viewer</h1>
            <p>Image: ${path.basename(imagePath)}</p>
        </div>
        
        <div class="content">
            <div class="image-section">
                <h3>🎯 OCR Canvas Visualization</h3>
                <div class="canvas-controls">
                    <button class="toggle-btn" id="toggleOverlay" onclick="toggleOverlay()">🔍 Show OCR Overlay</button>
                    <button class="toggle-btn" onclick="toggleTextContent()">📝 Toggle Text Content</button>
                    <button class="toggle-btn" onclick="resetView()">🔄 Reset View</button>
                </div>
                <div class="image-container" id="imageContainer">
                    <img src="${imageDataUrl}" alt="OCR Source Image" class="ocr-image" id="sourceImage" onload="setupOverlay()">
                    <div class="ocr-overlay" id="ocrOverlay">
                        ${ocrResults.map((line, index) => `
                            <div class="text-overlay" 
                                 id="overlay-${index}"
                                 data-index="${index}"
                                 style="left: ${line.x}px; top: ${line.y}px; font-size: ${Math.max(10, Math.min(line.fontPx * 0.8, 16))}px;"
                                 onclick="highlightTextBlock(${index})"
                                 title="Click to highlight in results panel">
                                ${line.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="results-section">
                <div class="stats">
                    <h3>📊 OCR Statistics</h3>
                    <p><strong>Text Lines Found:</strong> ${ocrResults.length}</p>
                    <p><strong>Total Characters:</strong> ${ocrResults.reduce((sum, line) => sum + line.text.length, 0)}</p>
                    <p><strong>Average Font Size:</strong> ${ocrResults.length > 0 ? Math.round(ocrResults.reduce((sum, line) => sum + line.fontPx, 0) / ocrResults.length) : 0}px</p>
                </div>
                
                <h3>📝 Detected Text Blocks</h3>
                ${ocrResults.map((line, index) => `
                    <div class="text-block" data-index="${index}" id="block-${index}" onclick="highlightOverlay(${index})">
                        <div class="text-content">"${line.text}"</div>
                        <div class="text-meta">
                            <div class="meta-item">X: ${line.x}px</div>
                            <div class="meta-item">Y: ${line.y}px</div>
                            <div class="meta-item">Font: ${line.fontPx}px</div>
                            <div class="meta-item">Length: ${line.text.length}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="downloadResults()">📄 Download JSON</button>
            <button class="btn btn-secondary" onclick="refreshPage()">🔄 Refresh</button>
            <button class="btn btn-secondary" onclick="viewRawHOCR()">🔍 View Raw hOCR</button>
        </div>
    </div>

    <script>
        // OCR results data
        const ocrData = ${JSON.stringify(ocrResults, null, 2)};
        let overlayVisible = false;
        let showTextContent = true;
        let activeOverlayIndex = -1;
        let activeBlockIndex = -1;
        
        // Scale factor for overlay positioning
        let scaleFactor = 1;
        
        // Setup overlay scaling when image loads
        function setupOverlay() {
            const img = document.getElementById('sourceImage');
            const overlay = document.getElementById('ocrOverlay');
            
            // Calculate scale factor based on actual vs natural image size
            const rect = img.getBoundingClientRect();
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            
            scaleFactor = rect.width / naturalWidth;
            
            console.log('Image setup:', {
                displayed: { width: rect.width, height: rect.height },
                natural: { width: naturalWidth, height: naturalHeight },
                scale: scaleFactor
            });
            
            // Apply scaling to all overlay elements
            updateOverlayScaling();
        }
        
        // Update overlay element positions and sizes based on scale
        function updateOverlayScaling() {
            const overlays = document.querySelectorAll('.text-overlay');
            overlays.forEach((element, index) => {
                const data = ocrData[index];
                if (data) {
                    const scaledX = data.x * scaleFactor;
                    const scaledY = data.y * scaleFactor;
                    const scaledFontSize = Math.max(8, Math.min(data.fontPx * scaleFactor * 0.8, 20));
                    
                    element.style.left = scaledX + 'px';
                    element.style.top = scaledY + 'px';
                    element.style.fontSize = scaledFontSize + 'px';
                }
            });
        }
        
        // Toggle overlay visibility
        function toggleOverlay() {
            const overlay = document.getElementById('ocrOverlay');
            const btn = document.getElementById('toggleOverlay');
            
            overlayVisible = !overlayVisible;
            overlay.style.display = overlayVisible ? 'block' : 'none';
            btn.textContent = overlayVisible ? '🔍 Hide OCR Overlay' : '🔍 Show OCR Overlay';
            btn.classList.toggle('active', overlayVisible);
        }
        
        // Toggle text content visibility in overlay
        function toggleTextContent() {
            const overlays = document.querySelectorAll('.text-overlay');
            showTextContent = !showTextContent;
            
            overlays.forEach(overlay => {
                if (showTextContent) {
                    overlay.textContent = ocrData[overlay.dataset.index].text;
                } else {
                    overlay.textContent = '';
                }
            });
        }
        
        // Reset view
        function resetView() {
            clearAllHighlights();
            if (overlayVisible) {
                setupOverlay();
            }
        }
        
        // Highlight text block from overlay click
        function highlightTextBlock(index) {
            clearAllHighlights();
            
            const block = document.getElementById('block-' + index);
            const overlay = document.getElementById('overlay-' + index);
            
            if (block) {
                block.classList.add('highlighted');
                block.scrollIntoView({ behavior: 'smooth', block: 'center' });
                activeBlockIndex = index;
            }
            
            if (overlay) {
                overlay.classList.add('active');
                activeOverlayIndex = index;
            }
            
            console.log('Highlighted text block:', ocrData[index]);
        }
        
        // Highlight overlay from text block click
        function highlightOverlay(index) {
            clearAllHighlights();
            
            const block = document.getElementById('block-' + index);
            const overlay = document.getElementById('overlay-' + index);
            
            if (block) {
                block.classList.add('highlighted');
                activeBlockIndex = index;
            }
            
            if (overlay) {
                overlay.classList.add('active');
                activeOverlayIndex = index;
            }
            
            console.log('Highlighted overlay:', ocrData[index]);
        }
        
        // Clear all highlights
        function clearAllHighlights() {
            document.querySelectorAll('.text-block.highlighted').forEach(el => {
                el.classList.remove('highlighted');
            });
            document.querySelectorAll('.text-overlay.active').forEach(el => {
                el.classList.remove('active');
            });
            activeBlockIndex = -1;
            activeOverlayIndex = -1;
        }
        
        // Handle window resize to recalculate scaling
        window.addEventListener('resize', () => {
            if (overlayVisible) {
                setTimeout(setupOverlay, 100);
            }
        });
        
        // Initial setup
        document.addEventListener('DOMContentLoaded', () => {
            // Hide overlay initially
            const overlay = document.getElementById('ocrOverlay');
            overlay.style.display = 'none';
        });
        
        // Hover effects for text blocks
        document.querySelectorAll('.text-block').forEach(block => {
            block.addEventListener('mouseenter', function() {
                const index = this.dataset.index;
                const overlay = document.getElementById('overlay-' + index);
                if (overlay && overlayVisible) {
                    overlay.style.background = 'rgba(59, 130, 246, 0.3)';
                    overlay.style.borderColor = '#2563eb';
                }
            });
            
            block.addEventListener('mouseleave', function() {
                const index = this.dataset.index;
                const overlay = document.getElementById('overlay-' + index);
                if (overlay && overlayVisible && index != activeOverlayIndex) {
                    overlay.style.background = 'rgba(239, 68, 68, 0.1)';
                    overlay.style.borderColor = '#ef4444';
                }
            });
        });
        
        // Download JSON results
        function downloadResults() {
            const enhancedData = {
                metadata: {
                    imagePath: '${path.basename(imagePath).replace(/'/g, "\\'")}',
                    timestamp: new Date().toISOString(),
                    totalBlocks: ocrData.length,
                    totalCharacters: ocrData.reduce((sum, line) => sum + line.text.length, 0),
                    averageFontSize: ocrData.length > 0 ? Math.round(ocrData.reduce((sum, line) => sum + line.fontPx, 0) / ocrData.length) : 0
                },
                ocrResults: ocrData
            };
            
            const dataStr = JSON.stringify(enhancedData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ocr-results-enhanced.json';
            link.click();
            URL.revokeObjectURL(url);
        }
        
        // Refresh page
        function refreshPage() {
            window.location.reload();
        }
        
        // View raw hOCR (placeholder - would need hOCR data from server)
        function viewRawHOCR() {
            alert('Raw hOCR viewing would require additional server endpoint');
        }
        
        console.log('OCR Canvas Viewer initialized');
        console.log('OCR Results:', ocrData);
    </script>
</body>
</html>
  `;
}

/**
 * HTTP Server to serve the OCR visualization
 */
function createOCRServer() {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    try {
      if (pathname === '/' || pathname === '/view') {
        // Serve the OCR visualization page
        if (!ocrResults) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h2>🔍 OCR Viewer</h2>
                <p>No OCR results available. Process an image first.</p>
                <p>Visit: <a href="/process?image=${encodeURIComponent(DEFAULT_IMAGE)}">/process?image=path/to/image</a></p>
              </body>
            </html>
          `);
          return;
        }

        const html = generateOCRVisualizationHTML(ocrResults, originalImagePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);

      } else if (pathname === '/process') {
        // Process an image with OCR
        const imagePath = parsedUrl.query.image || DEFAULT_IMAGE;
        const fullImagePath = path.resolve(imagePath);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`
          <html>
            <body style="font-family: sans-serif; padding: 20px;">
              <h2>🔍 Processing OCR...</h2>
              <p>Image: ${imagePath}</p>
              <p>Please wait while we analyze the image...</p>
            </body>
          </html>
        `);

        try {
          ocrResults = await processImageWithOCR(fullImagePath);
          originalImagePath = fullImagePath;
          
          res.write(`
            <script>
              setTimeout(() => {
                window.location.href = '/view';
              }, 1000);
            </script>
            <p>✅ OCR completed! Redirecting to results...</p>
          `);
        } catch (error) {
          res.write(`
            <p style="color: red;">❌ Error: ${error.message}</p>
            <p><a href="/">← Back to home</a></p>
          `);
        }
        
        res.end();

      } else if (pathname === '/api/results') {
        // API endpoint for JSON results
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          results: ocrResults || [],
          imagePath: originalImagePath,
          timestamp: new Date().toISOString()
        }, null, 2));

      } else {
        // 404
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>404 - Not Found</h2>
              <p><a href="/">← Back to OCR Viewer</a></p>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>500 - Server Error</h2>
            <p>${error.message}</p>
            <p><a href="/">← Back to OCR Viewer</a></p>
          </body>
        </html>
      `);
    }
  });

  return server;
}

/**
 * Main function
 */
async function main() {
  const imagePath = process.argv[2] || DEFAULT_IMAGE;
  
  console.log('🔍 OCR Viewer & Test Server');
  console.log('='.repeat(50));
  console.log(`📁 Default image: ${imagePath}`);
  
  // Check if image exists
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image file not found: ${imagePath}`);
    console.log('\nUsage:');
    console.log('  node test-ocr-viewer.js [image-path]');
    console.log('\nExamples:');
    console.log('  node test-ocr-viewer.js ./assets/screenshot.png');
    console.log('  node test-ocr-viewer.js /path/to/your/image.jpg');
    process.exit(1);
  }

  // Start the server
  const server = createOCRServer();
  
  server.listen(PORT, () => {
    console.log(`\n🚀 OCR Viewer server running on http://localhost:${PORT}`);
    console.log('\n📖 Available endpoints:');
    console.log(`   • http://localhost:${PORT}/                    - Home page`);
    console.log(`   • http://localhost:${PORT}/process?image=path  - Process an image`);
    console.log(`   • http://localhost:${PORT}/view               - View results`);
    console.log(`   • http://localhost:${PORT}/api/results        - JSON API`);
    console.log('\n💡 Quick start:');
    console.log(`   Visit: http://localhost:${PORT}/process?image=${encodeURIComponent(imagePath)}`);
    console.log('\n🛑 Press Ctrl+C to stop the server');
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down OCR viewer server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  processImageWithOCR,
  generateOCRVisualizationHTML,
  createOCRServer
};
