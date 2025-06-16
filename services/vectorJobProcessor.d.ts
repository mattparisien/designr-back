// Type definitions for vectorJobProcessor.js

export interface VectorJob {
  id: string;
  type: 'create' | 'update' | 'delete';
  assetId: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface VectorJobProcessor {
  isProcessing: boolean;
  queue: VectorJob[];
  batchSize: number;
  processingInterval: number;
  
  enqueue(jobType: 'create' | 'update' | 'delete', assetId: string, priority?: 'high' | 'normal' | 'low'): void;
  startProcessing(): void;
  stopProcessing(): void;
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    lastProcessedAt?: Date;
  };
}

declare const vectorJobProcessor: VectorJobProcessor;
export default vectorJobProcessor;
