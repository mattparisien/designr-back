const Asset = require('../models/Asset');
const vectorStoreService = require('../services/vectorStore');
const imageAnalysisService = require('./imageAnalysisService');
const imageVectorService = require('./imageVectorService');
const pdfProcessingService = require('./pdfProcessingService');
const documentChunkingService = require('./documentChunkingService');
const csvProcessingService = require('./csvProcessingService');
const csvChunkingService = require('./csvChunkingService');

class VectorJobProcessor {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
    this.batchSize = 10;
    this.processingInterval = 5000; // 5 seconds
  }

  // Add job to queue
  enqueue(jobType, assetId, priority = 'normal') {
    const job = {
      id: `${jobType}-${assetId}-${Date.now()}`,
      type: jobType,
      assetId,
      priority,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    this.queue.push(job);
    console.log(`Added vector job: ${job.id}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  // Start background processing
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('Starting vector job processor');
    
    this.processLoop();
  }

  // Stop background processing
  stopProcessing() {
    this.isProcessing = false;
    console.log('Stopping vector job processor');
  }

  // Main processing loop
  async processLoop() {
    while (this.isProcessing) {
      try {
        if (this.queue.length > 0) {
          await this.processBatch();
        }
        
        // Wait before next processing cycle
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      } catch (error) {
        console.error('Error in vector job processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      }
    }
  }

  // Process a batch of jobs
  async processBatch() {
    // Sort by priority (high priority first)
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const batch = this.queue.splice(0, this.batchSize);
    
    for (const job of batch) {
      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        // Retry failed jobs
        job.attempts++;
        if (job.attempts < job.maxAttempts) {
          job.priority = 'low'; // Lower priority for retries
          this.queue.push(job);
          console.log(`Retrying job ${job.id} (attempt ${job.attempts})`);
        } else {
          console.error(`Job ${job.id} failed after ${job.maxAttempts} attempts`);
        }
      }
    }
  }

  // Process a specific number of jobs (for testing)
  async processJobs(maxJobs = 1) {
    const results = {
      processed: 0,
      failed: 0,
      failures: []
    };

    const jobsToProcess = Math.min(maxJobs, this.queue.length);
    
    for (let i = 0; i < jobsToProcess; i++) {
      if (this.queue.length === 0) break;
      
      // Sort by priority and take the highest priority job
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      const job = this.queue.shift();
      
      try {
        await this.processJob(job);
        results.processed++;
      } catch (error) {
        results.failed++;
        results.failures.push({
          jobType: job.type,
          assetId: job.assetId,
          error: error.message
        });
      }
    }

    return results;
  }

  // Process individual job
  async processJob(job) {
    console.log(`Processing vector job: ${job.id}`);
    
    const asset = await Asset.findById(job.assetId);
    if (!asset) {
      console.log(`Asset ${job.assetId} not found, skipping job ${job.id}`);
      return;
    }

    switch (job.type) {
      case 'add':
        await this.addAssetToVector(asset);
        break;
      case 'update':
        await this.updateAssetInVector(asset);
        break;
      case 'remove':
        await this.removeAssetFromVector(job.assetId);
        break;
      case 'extractPDF':
        await this.processPDFExtraction(asset);
        break;
      case 'vectorizePDF':
        await this.processPDFVectorization(asset);
        break;
      case 'extractCSV':
        await this.processCSVExtraction(asset);
        break;
      case 'vectorizeCSV':
        await this.processCSVVectorization(asset);
        break;
      default:
        console.error(`Unknown job type: ${job.type}`);
    }
  }

  // Add asset to vector store
  async addAssetToVector(asset) {
    try {
      // Perform AI analysis for images if not already done
      if (asset.type === 'image' && asset.metadata?.aiAnalysisPending) {
        console.log(`Starting background AI analysis for image: ${asset.name}`);
        
        try {
          const analysis = await imageAnalysisService.analyzeImage(
            asset.cloudinaryUrl || asset.url
          );
          
          // Generate hybrid vector embedding (combines semantic + visual analysis)
          const hybridVector = await imageVectorService.generateHybridEmbedding(
            asset.cloudinaryUrl || asset.url,
            analysis
          );
          
          if (analysis) {
            // Update metadata with AI analysis and hybrid vector
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
              setting: analysis.setting || '',
              
              // Add hybrid vector data
              hybridVector: hybridVector?.embedding || null,
              visualDescription: hybridVector?.visualDescription || '',
              combinedDescription: hybridVector?.combinedDescription || '',
              vectorType: hybridVector?.type || 'text-only',
              
              aiAnalysisPending: false, // Mark as completed
              aiAnalysisCompleted: new Date()
            };

            // Update the asset with AI analysis
            await Asset.findByIdAndUpdate(asset._id, {
              metadata: updatedMetadata
            });

            // Update the local asset object for vectorization
            asset.metadata = updatedMetadata;

            console.log(`AI analysis completed for image ${asset.name}:`, {
              objects: analysis.objects?.length || 0,
              colors: analysis.colors?.length || 0,
              themes: analysis.themes?.length || 0,
              hasHybridVector: !!hybridVector?.embedding,
              vectorType: hybridVector?.type || 'text-only'
            });
          } else {
            console.warn(`AI analysis failed for image: ${asset.name}`);
            // Mark as completed even if failed to avoid retries
            await Asset.findByIdAndUpdate(asset._id, {
              'metadata.aiAnalysisPending': false,
              'metadata.aiAnalysisFailed': true,
              'metadata.aiAnalysisFailedAt': new Date()
            });
          }
        } catch (analysisError) {
          console.error(`Error during AI analysis for ${asset.name}:`, analysisError);
          // Mark as failed but continue with vectorization
          await Asset.findByIdAndUpdate(asset._id, {
            'metadata.aiAnalysisPending': false,
            'metadata.aiAnalysisFailed': true,
            'metadata.aiAnalysisFailedAt': new Date(),
            'metadata.aiAnalysisError': analysisError.message
          });
        }
      }

      // Proceed with vectorization
      await vectorStoreService.addAsset(asset);
      
      // Update asset to mark as vectorized
      await Asset.findByIdAndUpdate(asset._id, {
        vectorized: true,
        vectorLastUpdated: new Date()
      });
      
      console.log(`Asset ${asset._id} successfully vectorized`);
    } catch (error) {
      console.error(`Error vectorizing asset ${asset._id}:`, error);
      throw error;
    }
  }

  // Update asset in vector store
  async updateAssetInVector(asset) {
    try {
      // Perform AI analysis for images if needed (e.g., if analysis was previously failed or missing)
      if (asset.type === 'image' && 
          (asset.metadata?.aiAnalysisPending || asset.metadata?.aiAnalysisFailed)) {
        console.log(`Re-running AI analysis for updated image: ${asset.name}`);
        
        try {
          const analysis = await imageAnalysisService.analyzeImage(
            asset.cloudinaryUrl || asset.url
          );
          
          if (analysis) {
            // Update metadata with AI analysis
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
              setting: analysis.setting || '',
              aiAnalysisPending: false,
              aiAnalysisFailed: false,
              aiAnalysisCompleted: new Date()
            };

            // Update the asset with AI analysis
            await Asset.findByIdAndUpdate(asset._id, {
              metadata: updatedMetadata
            });

            // Update the local asset object for vectorization
            asset.metadata = updatedMetadata;

            console.log(`AI analysis updated for image ${asset.name}`);
          }
        } catch (analysisError) {
          console.error(`Error during AI analysis update for ${asset.name}:`, analysisError);
          // Continue with vectorization even if analysis fails
        }
      }

      await vectorStoreService.updateAsset(asset);
      
      // Update timestamp
      await Asset.findByIdAndUpdate(asset._id, {
        vectorized: true,
        vectorLastUpdated: new Date()
      });
      
      console.log(`Asset ${asset._id} successfully updated in vector store`);
    } catch (error) {
      console.error(`Error updating asset ${asset._id} in vector store:`, error);
      throw error;
    }
  }

  // Remove asset from vector store
  async removeAssetFromVector(assetId) {
    try {
      await vectorStoreService.removeAsset(assetId);
      console.log(`Asset ${assetId} successfully removed from vector store`);
    } catch (error) {
      console.error(`Error removing asset ${assetId} from vector store:`, error);
      throw error;
    }
  }

  // Get queue status
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.queue.length,
      jobs: this.queue.map(job => ({
        id: job.id,
        type: job.type,
        assetId: job.assetId,
        priority: job.priority,
        attempts: job.attempts,
        createdAt: job.createdAt
      }))
    };
  }

  // Process all unvectorized assets (for initial setup or recovery)
  async processAllUnvectorized() {
    try {
      console.log('Finding all unvectorized assets...');
      
      const unvectorizedAssets = await Asset.find({
        $or: [
          { vectorized: { $ne: true } },
          { vectorized: { $exists: false } }
        ]
      });

      console.log(`Found ${unvectorizedAssets.length} unvectorized assets`);

      for (const asset of unvectorizedAssets) {
        this.enqueue('add', asset._id, 'low');
      }

      console.log(`Queued ${unvectorizedAssets.length} assets for vectorization`);
    } catch (error) {
      console.error('Error processing all unvectorized assets:', error);
      throw error;
    }
  }

  // Batch re-vectorize assets (useful for schema changes)
  async reVectorizeAll() {
    try {
      console.log('Re-vectorizing all assets...');
      
      const allAssets = await Asset.find({});
      console.log(`Found ${allAssets.length} total assets`);

      for (const asset of allAssets) {
        this.enqueue('update', asset._id, 'low');
      }

      console.log(`Queued ${allAssets.length} assets for re-vectorization`);
    } catch (error) {
      console.error('Error re-vectorizing all assets:', error);
      throw error;
    }
  }

  // Process PDF content extraction
  async processPDFExtraction(asset) {
    try {
      console.log(`Starting PDF extraction for: ${asset.name}`);

      if (asset.type !== 'document' || !asset.mimeType.includes('pdf')) {
        console.log(`Asset ${asset.name} is not a PDF, skipping extraction`);
        return;
      }

      // Check if we have a file path to work with
      let filePath = null;
      
      // Try to get file from Cloudinary URL or local path
      if (asset.cloudinaryUrl) {
        // For Cloudinary files, we'll need to download temporarily
        filePath = await this.downloadTempFile(asset.cloudinaryUrl, asset.name);
      } else if (asset.url && asset.url.startsWith('/')) {
        // Local file path
        filePath = asset.url;
      }

      if (!filePath) {
        console.warn(`No accessible file path for PDF: ${asset.name}`);
        // Mark extraction as failed but don't throw
        await Asset.findByIdAndUpdate(asset._id, {
          'metadata.extractionFailed': true,
          'metadata.extractionError': 'No accessible file path'
        });
        return;
      }

      try {
        // Initialize PDF processing service if needed
        if (!pdfProcessingService.initialized) {
          await pdfProcessingService.initialize();
        }

        // Extract content from PDF
        const extractedContent = await pdfProcessingService.extractTextFromPDF(filePath);

        // Update asset with extracted content
        const updatedMetadata = {
          ...asset.metadata,
          extractedContent,
          pdfProcessingCompleted: new Date(),
          contentExtractionPending: false
        };

        await Asset.findByIdAndUpdate(asset._id, {
          metadata: updatedMetadata
        });

        console.log(`PDF extraction completed for ${asset.name}: ${extractedContent.wordCount} words extracted`);

        // Queue for vectorization
        this.enqueue('vectorizePDF', asset._id, 'normal');

      } catch (extractionError) {
        console.error(`PDF extraction failed for ${asset.name}:`, extractionError);
        
        // Mark extraction as failed
        await Asset.findByIdAndUpdate(asset._id, {
          'metadata.extractionFailed': true,
          'metadata.extractionError': extractionError.message,
          'metadata.contentExtractionPending': false
        });
      } finally {
        // Clean up temporary file if we downloaded one
        if (filePath && filePath.includes('temp-uploads')) {
          try {
            const fs = require('fs');
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError);
          }
        }
      }
    } catch (error) {
      console.error(`Error in PDF extraction for ${asset._id}:`, error);
      throw error;
    }
  }

  // Process PDF vectorization with chunking
  async processPDFVectorization(asset) {
    try {
      console.log(`Starting PDF vectorization for: ${asset.name}`);

      if (!asset.metadata?.extractedContent) {
        console.warn(`No extracted content found for PDF: ${asset.name}`);
        // Try to trigger extraction first
        this.enqueue('extractPDF', asset._id, 'high');
        return;
      }

      const extractedContent = asset.metadata.extractedContent;

      // Prepare document object for chunking
      const document = {
        assetId: asset._id.toString(),
        text: extractedContent.text,
        title: extractedContent.title || asset.name,
        author: extractedContent.author,
        subject: extractedContent.subject,
        sections: extractedContent.sections || [],
        wordCount: extractedContent.wordCount,
        pageCount: extractedContent.pageCount
      };

      // Create chunks using hybrid strategy
      const chunks = documentChunkingService.chunkDocument(document, {
        strategy: 'hybrid',
        chunkSize: 1000,
        overlap: 200,
        preserveSections: true
      });

      console.log(`Created ${chunks.length} chunks for PDF: ${asset.name}`);

      // Add chunks to vector store
      await vectorStoreService.addDocumentWithChunks(asset, chunks);

      // Update asset metadata with chunking info
      const chunkingMetadata = {
        totalChunks: chunks.length,
        chunkingStrategy: 'hybrid',
        avgChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length),
        vectorizationCompleted: new Date()
      };

      await Asset.findByIdAndUpdate(asset._id, {
        vectorized: true,
        vectorLastUpdated: new Date(),
        'metadata.extractedContent.totalChunks': chunkingMetadata.totalChunks,
        'metadata.extractedContent.chunkingStrategy': chunkingMetadata.chunkingStrategy,
        'metadata.extractedContent.avgChunkSize': chunkingMetadata.avgChunkSize
      });

      console.log(`PDF vectorization completed for ${asset.name}: ${chunks.length} chunks processed`);

    } catch (error) {
      console.error(`Error in PDF vectorization for ${asset._id}:`, error);
      
      // Mark vectorization as failed
      await Asset.findByIdAndUpdate(asset._id, {
        'metadata.vectorizationFailed': true,
        'metadata.vectorizationError': error.message
      });
      
      throw error;
    }
  }

  // Process CSV content extraction
  async processCSVExtraction(asset) {
    try {
      console.log(`Starting CSV extraction for: ${asset.name}`);

      // Check if asset is a CSV file by MIME type or file extension
      const isCSV = asset.type === 'document' && (
        asset.mimeType.includes('csv') || 
        asset.originalFilename?.toLowerCase().endsWith('.csv') ||
        asset.name?.toLowerCase().endsWith('.csv')
      );

      if (!isCSV) {
        console.log(`Asset ${asset.name} is not a CSV, skipping extraction (type: ${asset.type}, mimeType: ${asset.mimeType})`);
        return;
      }

      // Check if we have a file path to work with
      let filePath = null;
      
      // Try to get file from Cloudinary URL or local path
      if (asset.cloudinaryUrl) {
        // For Cloudinary files, we'll need to download temporarily
        filePath = await this.downloadTempFile(asset.cloudinaryUrl, asset.name);
      } else if (asset.url && asset.url.startsWith('/')) {
        // Local file path
        filePath = asset.url;
      }

      if (!filePath) {
        console.warn(`No accessible file path for CSV: ${asset.name}`);
        // Mark extraction as failed but don't throw
        await Asset.findByIdAndUpdate(asset._id, {
          'metadata.extractionFailed': true,
          'metadata.extractionError': 'No accessible file path'
        });
        return;
      }

      try {
        // Validate CSV file
        await csvProcessingService.validateCSV(filePath);

        // Extract content from CSV
        const extractedData = await csvProcessingService.extractCSVData(filePath);

        // Update asset with extracted content
        const updatedMetadata = {
          ...asset.metadata,
          extractedContent: extractedData,
          csvProcessingCompleted: new Date(),
          contentExtractionPending: false
        };

        await Asset.findByIdAndUpdate(asset._id, {
          metadata: updatedMetadata
        });

        console.log(`CSV extraction completed for ${asset.name}: ${extractedData.metadata.rowCount} rows, ${extractedData.metadata.columnCount} columns`);

        // Queue for vectorization
        this.enqueue('vectorizeCSV', asset._id, 'normal');

      } catch (extractionError) {
        console.error(`CSV extraction failed for ${asset.name}:`, extractionError);
        
        // Mark extraction as failed
        await Asset.findByIdAndUpdate(asset._id, {
          'metadata.extractionFailed': true,
          'metadata.extractionError': extractionError.message,
          'metadata.contentExtractionPending': false
        });
      } finally {
        // Clean up temporary file if we downloaded one
        if (filePath && filePath.includes('temp-uploads')) {
          try {
            const fs = require('fs');
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError);
          }
        }
      }
    } catch (error) {
      console.error(`Error in CSV extraction for ${asset._id}:`, error);
      throw error;
    }
  }

  // Process CSV vectorization with chunking
  async processCSVVectorization(asset) {
    try {
      console.log(`Starting CSV vectorization for: ${asset.name}`);

      if (!asset.metadata?.extractedContent) {
        console.warn(`No extracted content found for CSV: ${asset.name}`);
        // Try to trigger extraction first
        this.enqueue('extractCSV', asset._id, 'high');
        return;
      }

      const extractedData = asset.metadata.extractedContent;

      // Create chunks using CSV-specific chunking
      const chunks = await csvChunkingService.chunkCSVData(extractedData, asset._id.toString());

      console.log(`Created ${chunks.length} chunks for CSV: ${asset.name}`);

      // Add chunks to vector store
      await vectorStoreService.addDocumentWithChunks(asset, chunks);

      // Update asset metadata with chunking info
      const chunkingMetadata = {
        totalChunks: chunks.length,
        chunkingStrategy: 'csv_hybrid',
        avgChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
        vectorizationCompleted: new Date(),
        columnCount: extractedData.metadata.columnCount,
        rowCount: extractedData.metadata.rowCount
      };

      await Asset.findByIdAndUpdate(asset._id, {
        vectorized: true,
        vectorLastUpdated: new Date(),
        'metadata.extractedContent.totalChunks': chunkingMetadata.totalChunks,
        'metadata.extractedContent.chunkingStrategy': chunkingMetadata.chunkingStrategy,
        'metadata.extractedContent.avgChunkSize': chunkingMetadata.avgChunkSize
      });

      console.log(`CSV vectorization completed for ${asset.name}: ${chunks.length} chunks processed`);

    } catch (error) {
      console.error(`Error in CSV vectorization for ${asset._id}:`, error);
      
      // Mark vectorization as failed
      await Asset.findByIdAndUpdate(asset._id, {
        'metadata.vectorizationFailed': true,
        'metadata.vectorizationError': error.message
      });
      
      throw error;
    }
  }

  // Helper method to download temporary file from URL
  async downloadTempFile(url, filename) {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    return new Promise((resolve, reject) => {
      const tempDir = path.join(__dirname, '../temp-uploads');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${filename}`);
      const file = fs.createWriteStream(tempFilePath);

      const request = url.startsWith('https') ? https : http;

      request.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(tempFilePath);
        });

        file.on('error', (error) => {
          fs.unlink(tempFilePath, () => {}); // Clean up on error
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Create and export singleton instance
const vectorJobProcessor = new VectorJobProcessor();

module.exports = vectorJobProcessor;
