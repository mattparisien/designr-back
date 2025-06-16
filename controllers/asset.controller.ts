// filepath: /Users/mattparisien/Dropbox/Development/canva-clone/apps/back/controllers/asset.controller.ts
// src/controllers/asset.controller.ts
/* ---------------------------------------------------------------------------
 * Asset CRUD controller — aligned with new shared API + model types
 * ---------------------------------------------------------------------------
 * ➊  Uses API‑layer DTOs (ListAssetsRequest, UploadAssetRequest, …)
 * ➋  Imports the *domain* Asset model (Mongo/Mongoose) only once.
 * ➌  All JSON output conforms to the API response DTOs in `@api/asset/*`.
 * ------------------------------------------------------------------------- */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import multer from 'multer';
import crypto from 'crypto';
import sharp from 'sharp';

import type {
    ListAssetsRequest,
    GetAssetByIdRequest,
    UploadAssetRequest,
    UpdateAssetRequest,
    MoveAssetRequest,
    DeleteAssetRequest,
    BulkDeleteAssetsRequest,
    SearchAssetsByVectorRequest,
    FindSimilarAssetsRequest,
    AnalyzeAssetRequest,
    BatchAnalyzeAssetsRequest,
    SearchDocumentChunksRequest,
    HybridSearchRequest,
    GetDocumentChunksRequest,
    ReVectorizeAssetsRequest,
    ProcessVectorJobsRequest,
    GetVectorStatsRequest,
    DeleteAllAssetsRequest,
    AssetType
} from '@canva-clone/shared-types/dist/api/asset/asset.requests';

import type {
    AssetListResponse,
    AssetResponse,
    UploadAssetResponse,
    UploadAssetConflictResponse,
    UpdateAssetResponse,
    DeleteAssetResponse,
    BulkDeleteAssetsResponse,
    MoveAssetResponse,
    SearchAssetsByVectorResponse,
    FindSimilarAssetsResponse,
    AnalyzeAssetResponse,
    BatchAnalyzeAssetsResponse,
    SearchDocumentChunksResponse,
    HybridSearchResponse,
    GetDocumentChunksResponse,
    GetVectorStatsResponse,
    ReVectorizeAssetsResponse,
    ProcessVectorJobsResponse,
    DeleteAllAssetsResponse,
    AssetErrorResponse
} from '@canva-clone/shared-types/dist/api/asset/asset.responses';

// Import modules using require to handle JS modules
const { storage, getGridFsBucket } = require('../config/db');
const cloudinary = require('../config/cloudinary');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');
const vectorStoreService = require('../services/vectorStore');
const vectorJobProcessor = require('../services/vectorJobProcessor');
const imageAnalysisService = require('../services/imageAnalysisService');
const Asset = require('../models/Asset');

const unlinkAsync = promisify(fs.unlink);

/* -------------------------------------------------------------------------
 * Helper — wrap async controller to forward errors to Express error handler
 * ------------------------------------------------------------------------- */
const asyncHandler = <T extends Request>(fn: (req: T, res: Response) => Promise<void>) =>
    (req: T, res: Response, next: (err?: any) => void) => fn(req, res).catch(next);

/* -------------------------------------------------------------------------
 * Extended Request interface to include userId from auth middleware
 * ------------------------------------------------------------------------- */
interface AuthenticatedRequest extends Request {
    userId?: string;
}

/* -------------------------------------------------------------------------
 * Utility functions
 * ------------------------------------------------------------------------- */

// Determine asset type from MIME type or file extension
const getAssetTypeFromMime = (mimeType: string, filename: string = ''): AssetType => {
  // First try to determine from MIME type
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.match(/pdf|word|excel|powerpoint|text|rtf|doc|xls|ppt|pages|numbers|keynote|csv/i)) return 'document';
  
  // If MIME type is generic (like application/octet-stream), check file extension
  if (mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream') {
    const ext = filename.toLowerCase();
    if (ext.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (ext.match(/\.(mp4|mov|avi|webm)$/)) return 'video';
    if (ext.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
    if (ext.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv)$/)) return 'document';
  }
  
  return 'other';
};

// Calculate file hash for duplicate detection
const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

/* -------------------------------------------------------------------------
 * GET /v1/assets — list with optional filters
 * ------------------------------------------------------------------------- */
export const getAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId, folderId, type } = req.query as ListAssetsRequest;
    
    // Use default user if no userId provided (since auth is disabled)
    const effectiveUserId = (userId as string) || req.userId || 'default-user';
    
    const filter: any = { userId: effectiveUserId };
    
    // Filter by folder
    if (folderId !== undefined) {
      if (folderId === 'null') {
        filter.folderId = null;
      } else {
        filter.folderId = folderId;
      }
    }
    
    // Filter by type
    if (type) {
      filter.type = type;
    }
    
    const assets = await Asset.find(filter).sort({ createdAt: -1 });
    
    const response: AssetListResponse = {
      success: true,
      data: assets.map((asset: any) => ({
        id: asset._id.toString(),
        name: asset.name,
        userId: asset.userId,
        folderId: asset.folderId,
        type: asset.type,
        url: asset.url,
        cloudinaryId: asset.cloudinaryId,
        gridFsId: asset.gridFsId,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        metadata: asset.metadata,
        tags: asset.tags || [],
        description: asset.description,
        isAnalyzed: asset.isAnalyzed || false,
        analysisData: asset.analysisData,
        vectorized: asset.vectorized || false,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      }))
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * GET /v1/assets/:id — get single asset by ID
 * ------------------------------------------------------------------------- */
export const getAssetById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const asset = await Asset.findById(id);
    
    if (!asset) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found'
        }
      };
      res.status(404).json(errorResponse);
      return;
    }
    
    const response: AssetResponse = {
      success: true,
      data: {
        id: asset._id.toString(),
        name: asset.name,
        userId: asset.userId,
        folderId: asset.folderId,
        type: asset.type,
        url: asset.url,
        cloudinaryId: asset.cloudinaryId,
        gridFsId: asset.gridFsId,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        metadata: asset.metadata,
        tags: asset.tags || [],
        description: asset.description,
        isAnalyzed: asset.isAnalyzed || false,
        analysisData: asset.analysisData,
        vectorized: asset.vectorized || false,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      }
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * POST /v1/assets/upload — upload a new asset
 * ------------------------------------------------------------------------- */
export const uploadAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // This function assumes multer has already processed the file
    if (!req.file) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file uploaded'
        }
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    const { userId, folderId, name, tags } = req.body as UploadAssetRequest;
    
    // Use a default userId if none provided (since auth is disabled)
    const effectiveUserId = userId || req.userId || 'default-user';
    
    // Parse the tags if they exist
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        console.warn('Could not parse tags as JSON:', e);
      }
    }
    
    // Determine asset type from MIME type
    const assetType = getAssetTypeFromMime(req.file.mimetype, req.file.originalname);
    
    console.log('Processing file upload:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      detectedType: assetType,
      userId: effectiveUserId
    });
    
    // Handle folderId correctly - if it's null, undefined, "null", or empty string, set it to null
    const folderIdValue = folderId && folderId !== "null" && folderId !== "" ? folderId : null;
    
    // Check for duplicate filename in the same folder for the same user
    const assetName = name || req.file.originalname;
    const existingAsset = await Asset.findOne({
      userId: effectiveUserId,
      folderId: folderIdValue,
      name: assetName
    });
    
    if (existingAsset) {
      // Clean up temp file
      await unlinkAsync(req.file.path);
      const conflictResponse: UploadAssetConflictResponse = {
        success: false,
        message: 'A file with this name already exists in this location',
        conflict: 'filename',
        existingAsset: {
          id: existingAsset._id.toString(),
          name: existingAsset.name,
          createdAt: existingAsset.createdAt.toISOString()
        }
      };
      res.status(409).json(conflictResponse);
      return;
    }
    
    // Calculate file hash for content-based duplicate detection
    const fileHash = await calculateFileHash(req.file.path);
    const existingHashAsset = await Asset.findOne({
      userId: effectiveUserId,
      'metadata.fileHash': fileHash
    });
    
    if (existingHashAsset) {
      // Clean up temp file
      await unlinkAsync(req.file.path);
      const conflictResponse: UploadAssetConflictResponse = {
        success: false,
        message: 'This file content already exists in your assets',
        conflict: 'content',
        existingAsset: {
          id: existingHashAsset._id.toString(),
          name: existingHashAsset.name,
          url: existingHashAsset.url,
          createdAt: existingHashAsset.createdAt.toISOString()
        }
      };
      res.status(409).json(conflictResponse);
      return;
    }
    
    try {
      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(req.file.path, {
        folder: `assets/${effectiveUserId}`,
        public_id: `${Date.now()}_${req.file.originalname}`,
        resource_type: 'auto'
      });
      
      // Create asset record
      const newAsset = new Asset({
        name: assetName,
        userId: effectiveUserId,
        folderId: folderIdValue,
        type: assetType,
        url: cloudinaryResult.secure_url,
        cloudinaryId: cloudinaryResult.public_id,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        metadata: {
          fileHash,
          originalPath: req.file.path
        },
        tags: parsedTags,
        isAnalyzed: false,
        vectorized: false
      });
      
      const savedAsset = await newAsset.save();
      
      // Clean up temp file
      await unlinkAsync(req.file.path);
      
      // Queue for vectorization
      try {
        vectorJobProcessor.enqueue('create', savedAsset._id, 'normal');
      } catch (vectorError) {
        console.warn('Failed to queue asset for vectorization:', vectorError);
      }
      
      const response: UploadAssetResponse = {
        success: true,
        data: {
          id: savedAsset._id.toString(),
          name: savedAsset.name,
          userId: savedAsset.userId,
          folderId: savedAsset.folderId,
          type: savedAsset.type,
          url: savedAsset.url,
          cloudinaryId: savedAsset.cloudinaryId,
          gridFsId: savedAsset.gridFsId,
          fileSize: savedAsset.fileSize,
          mimeType: savedAsset.mimeType,
          metadata: savedAsset.metadata,
          tags: savedAsset.tags || [],
          description: savedAsset.description,
          isAnalyzed: savedAsset.isAnalyzed || false,
          analysisData: savedAsset.analysisData,
          vectorized: savedAsset.vectorized || false,
          createdAt: savedAsset.createdAt.toISOString(),
          updatedAt: savedAsset.updatedAt.toISOString()
        }
      };
      
      res.status(201).json(response);
      
    } catch (error: any) {
      // Clean up temp file on error
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not clean up temp file:', cleanupError);
      }
      
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload asset',
          details: { error: error.message }
        }
      };
      res.status(400).json(errorResponse);
    }
});

/* -------------------------------------------------------------------------
 * PUT /v1/assets/:id — update asset metadata
 * ------------------------------------------------------------------------- */
export const updateAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body as UpdateAssetRequest;
    
    // Don't allow changing certain fields directly
    const restrictedFields = ['url', 'gridFsId', 'userId', 'fileSize', 'mimeType', 'type'];
    const sanitizedUpdates = { ...updates };
    restrictedFields.forEach(field => {
      delete (sanitizedUpdates as any)[field];
    });
    
    const asset = await Asset.findByIdAndUpdate(
      id,
      sanitizedUpdates,
      { new: true, runValidators: true }
    );
    
    if (!asset) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found'
        }
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Re-queue asset for vectorization if metadata was updated
    if (updates.name || updates.tags) {
      try {
        vectorJobProcessor.enqueue('update', asset._id, 'normal');
      } catch (vectorError) {
        console.warn('Failed to queue asset for re-vectorization:', vectorError);
      }
    }
    
    const response: UpdateAssetResponse = {
      success: true,
      data: {
        id: asset._id.toString(),
        name: asset.name,
        userId: asset.userId,
        folderId: asset.folderId,
        type: asset.type,
        url: asset.url,
        cloudinaryId: asset.cloudinaryId,
        gridFsId: asset.gridFsId,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        metadata: asset.metadata,
        tags: asset.tags || [],
        description: asset.description,
        isAnalyzed: asset.isAnalyzed || false,
        analysisData: asset.analysisData,
        vectorized: asset.vectorized || false,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      }
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * DELETE /v1/assets/:id — delete single asset
 * ------------------------------------------------------------------------- */
export const deleteAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const asset = await Asset.findById(id);
    if (!asset) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found'
        }
      };
      res.status(404).json(errorResponse);
      return;
    }
    
    // Delete from Cloudinary if applicable
    if (asset.cloudinaryId) {
      try {
        const resourceType = asset.type === 'image' ? 'image' : 
                            asset.type === 'video' ? 'video' : 'raw';
        await deleteFromCloudinary(asset.cloudinaryId, resourceType);
      } catch (cloudinaryError: any) {
        console.warn('Could not delete from Cloudinary:', cloudinaryError);
        // Continue anyway, as we still want to delete the database record
      }
    }
    
    // Delete from database
    await Asset.findByIdAndDelete(id);
    
    // Remove from vector store
    try {
      await vectorStoreService.deleteAsset(id);
    } catch (vectorError: any) {
      console.warn('Could not delete from vector store:', vectorError);
    }
    
    const response: DeleteAssetResponse = {
      success: true,
      id: id as any,
      message: 'Asset deleted successfully'
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * DELETE /v1/assets/bulk/delete — delete multiple assets
 * ------------------------------------------------------------------------- */
export const deleteMultipleAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { assetIds } = req.body as BulkDeleteAssetsRequest;
    
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Asset IDs array is required'
        }
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    const deletedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    
    for (const assetId of assetIds) {
      try {
        const asset = await Asset.findById(assetId);
        if (!asset) {
          errors.push({ id: assetId, error: 'Asset not found' });
          continue;
        }
        
        // Delete from Cloudinary if applicable
        if (asset.cloudinaryId) {
          try {
            const resourceType = asset.type === 'image' ? 'image' : 
                                asset.type === 'video' ? 'video' : 'raw';
            await deleteFromCloudinary(asset.cloudinaryId, resourceType);
          } catch (cloudinaryError: any) {
            console.warn('Could not delete from Cloudinary:', cloudinaryError);
          }
        }
        
        // Delete from database
        await Asset.findByIdAndDelete(assetId);
        
        // Remove from vector store
        try {
          await vectorStoreService.deleteAsset(assetId);
        } catch (vectorError: any) {
          console.warn('Could not delete from vector store:', vectorError);
        }
        
        deletedIds.push(assetId);
        
      } catch (error: any) {
        errors.push({ id: assetId, error: error.message });
      }
    }
    
    const response: BulkDeleteAssetsResponse = {
      success: true,
      deletedCount: deletedIds.length,
      deletedIds: deletedIds as any[],
      errors: errors.length > 0 ? errors.map(e => ({ ...e, id: e.id as any })) : undefined
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * PATCH /v1/assets/:id/move — move asset to different folder
 * ------------------------------------------------------------------------- */
export const moveAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { folderId } = req.body as MoveAssetRequest;
    
    // Handle folderId correctly - if it's null, undefined, "null", or empty string, set it to null
    const folderIdValue = folderId && folderId !== "null" && folderId !== "" ? folderId : null;
    
    const asset = await Asset.findByIdAndUpdate(
      id,
      { folderId: folderIdValue },
      { new: true }
    );
    
    if (!asset) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found'
        }
      };
      res.status(404).json(errorResponse);
      return;
    }
    
    const response: MoveAssetResponse = {
      success: true,
      data: {
        id: asset._id.toString(),
        name: asset.name,
        userId: asset.userId,
        folderId: asset.folderId,
        type: asset.type,
        url: asset.url,
        cloudinaryId: asset.cloudinaryId,
        gridFsId: asset.gridFsId,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        metadata: asset.metadata,
        tags: asset.tags || [],
        description: asset.description,
        isAnalyzed: asset.isAnalyzed || false,
        analysisData: asset.analysisData,
        vectorized: asset.vectorized || false,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      }
    };
    
    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * GET /v1/assets/search/vector — search assets by vector similarity
 * ------------------------------------------------------------------------- */
export const searchAssetsByVector = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { query, userId, limit, threshold } = req.query;
    
    if (!query) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Query parameter is required'
        }
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    // Use default user if no userId provided
    const effectiveUserId = (userId as string) || req.userId || 'default-user';
    const searchLimit = limit ? parseInt(limit as string) : 10;
    const searchThreshold = threshold ? parseFloat(threshold as string) : 0.7;
    
    try {
      const results = await vectorStoreService.searchAssets(
        query as string,
        effectiveUserId,
        searchLimit,
        searchThreshold
      );
      
      // Get full asset details for the results
      const assetIds = results.map((r: any) => r.id);
      const assets = await Asset.find({ 
        _id: { $in: assetIds },
        userId: effectiveUserId 
      });
      
      // Merge results with asset details
      const mergedResults = results.map((result: any) => {
        const asset = assets.find((a: any) => a._id.toString() === result.id);
        if (!asset) return null;
        
        return {
          asset: {
            id: asset._id.toString(),
            name: asset.name,
            userId: asset.userId,
            folderId: asset.folderId,
            type: asset.type,
            url: asset.url,
            cloudinaryId: asset.cloudinaryId,
            gridFsId: asset.gridFsId,
            fileSize: asset.fileSize,
            mimeType: asset.mimeType,
            metadata: asset.metadata,
            tags: asset.tags || [],
            description: asset.description,
            isAnalyzed: asset.isAnalyzed || false,
            analysisData: asset.analysisData,
            vectorized: asset.vectorized || false,
            createdAt: asset.createdAt.toISOString(),
            updatedAt: asset.updatedAt.toISOString()
          },
          score: result.score,
          similarity: result.similarity
        };
      }).filter(Boolean);
      
      const response: SearchAssetsByVectorResponse = {
        success: true,
        data: mergedResults,
        query: query as string,
        totalResults: mergedResults.length
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to search assets by vector',
          details: { error: error.message }
        }
      };
      res.status(500).json(errorResponse);
    }
});

/* -------------------------------------------------------------------------
 * GET /v1/assets/:id/similar — find similar assets
 * ------------------------------------------------------------------------- */
export const findSimilarAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, limit, threshold } = req.query;
    
    const asset = await Asset.findById(id);
    if (!asset) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found'
        }
      };
      res.status(404).json(errorResponse);
      return;
    }
    
    // Use default user if no userId provided
    const effectiveUserId = (userId as string) || req.userId || asset.userId;
    const searchLimit = limit ? parseInt(limit as string) : 10;
    const searchThreshold = threshold ? parseFloat(threshold as string) : 0.7;
    
    try {
      const results = await vectorStoreService.findSimilarAssets(
        id,
        effectiveUserId,
        searchLimit,
        searchThreshold
      );
      
      // Get full asset details for the results
      const assetIds = results.map((r: any) => r.id);
      const similarAssets = await Asset.find({
        _id: { $in: assetIds, $ne: id }, // Exclude the original asset
        userId: effectiveUserId
      });
      
      // Merge results with asset details
      const mergedResults = results.map((result: any) => {
        const similarAsset = similarAssets.find((a: any) => a._id.toString() === result.id);
        if (!similarAsset) return null;
        
        return {
          asset: {
            id: similarAsset._id.toString(),
            name: similarAsset.name,
            userId: similarAsset.userId,
            folderId: similarAsset.folderId,
            type: similarAsset.type,
            url: similarAsset.url,
            cloudinaryId: similarAsset.cloudinaryId,
            gridFsId: similarAsset.gridFsId,
            fileSize: similarAsset.fileSize,
            mimeType: similarAsset.mimeType,
            metadata: similarAsset.metadata,
            tags: similarAsset.tags || [],
            description: similarAsset.description,
            isAnalyzed: similarAsset.isAnalyzed || false,
            analysisData: similarAsset.analysisData,
            vectorized: similarAsset.vectorized || false,
            createdAt: similarAsset.createdAt.toISOString(),
            updatedAt: similarAsset.updatedAt.toISOString()
          },
          score: result.score,
          similarity: result.similarity
        };
      }).filter(Boolean);
      
      const response: FindSimilarAssetsResponse = {
        success: true,
        data: mergedResults,
        sourceAssetId: id as any,
        totalResults: mergedResults.length
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to find similar assets',
          details: { error: error.message }
        }
      };
      res.status(500).json(errorResponse);
    }
});

/* -------------------------------------------------------------------------
 * GET /v1/assets/vector/stats — get vector store statistics
 * ------------------------------------------------------------------------- */
export const getVectorStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.query as GetVectorStatsRequest;
    
    // Use default user if no userId provided
    const effectiveUserId = (userId as string) || req.userId || 'default-user';
    
    try {
      const vectorStats = await vectorStoreService.getStats(effectiveUserId);
      const totalAssets = await Asset.countDocuments({ userId: effectiveUserId });
      const vectorizedAssets = await Asset.countDocuments({ 
        userId: effectiveUserId, 
        vectorized: true 
      });
      
      const response: GetVectorStatsResponse = {
        success: true,
        data: {
          totalAssets,
          vectorizedAssets,
          pendingJobs: vectorStats.pendingJobs || 0,
          lastProcessedAt: vectorStats.lastProcessedAt
        }
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const errorResponse: AssetErrorResponse = {
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to get vector statistics',
          details: { error: error.message }
        }
      };
      res.status(500).json(errorResponse);
    }
});

/* -------------------------------------------------------------------------
 * Placeholder functions for remaining routes
 * These functions provide basic implementations to prevent compilation errors
 * ------------------------------------------------------------------------- */

export const searchDocumentChunks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Document chunk search not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const hybridSearch = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Hybrid search not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const getDocumentChunks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get document chunks not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const getDocumentSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get document summary not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const processVectorJobs = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Process vector jobs not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const reVectorizeAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Re-vectorize assets not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const analyzeAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Analyze asset not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const batchAnalyzeAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Batch analyze assets not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const serveAssetFile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Serve asset file not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});

export const deleteAllAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errorResponse: AssetErrorResponse = {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Delete all assets not implemented yet'
      }
    };
    res.status(501).json(errorResponse);
});
