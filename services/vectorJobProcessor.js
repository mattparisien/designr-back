const Asset = require('../models/Asset');
const vectorStoreService = require('../services/vectorStore');
const imageAnalysisService = require('./imageAnalysisService');
const imageVectorService = require('./imageVectorService');

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
}

// Create and export singleton instance
const vectorJobProcessor = new VectorJobProcessor();

module.exports = vectorJobProcessor;
