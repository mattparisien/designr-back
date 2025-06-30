import mongoose from 'mongoose';

// Models - using * as import for better compatibility
import * as ProjectModule from '../models/Project';
import * as TemplateModule from '../models/Template';
import * as LayoutModule from '../models/Page'; // Page.ts exports Layout model

// Services / helpers
import { processProjectThumbnail } from '../utils/thumbnailProcessor';
import templateVectorService from '../services/templateVectorService';
import { getPresetsList } from '../config/projectPresets';
const imageAnalysisService = require('../services/imageAnalysisService');
const Asset = require('../models/Asset');

// Extract the default exports
const Project = (ProjectModule as any).default || ProjectModule;
const Template = (TemplateModule as any).default || TemplateModule;
const Layout = (LayoutModule as any).default || LayoutModule;

/**
 * Utility helpers
 * ------------------------------------------------------------------ */
const isObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

/**
 * Build a Mongo filter object from the incoming query string for projects.
 * Only fields that exist on the new Project model are supported.
 */
function buildProjectFilter(query: any) {
  const {
    ownerId,
    starred,
    shared,
    type,
    tags
  } = query;

  const filter: any = {};
  
  // Handle ownerId conversion to ObjectId
  if (ownerId) {
    if (typeof ownerId === 'string' && isObjectId(ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(ownerId);
    } else if (typeof ownerId === 'string') {
      // For invalid ObjectId strings, we'll create a dummy ObjectId that won't match anything
      // This prevents the query from failing but returns no results
      filter.ownerId = new mongoose.Types.ObjectId();
      console.warn(`Warning: Invalid ownerId in filter: ${ownerId}`);
    } else {
      filter.ownerId = ownerId; // Already an ObjectId
    }
  }
  
  if (starred !== undefined) filter.starred = starred === 'true';
  if (shared !== undefined) filter.sharedWith = { $size: 0 };
  if (type) filter.type = type;
  if (tags) {
    const arr = Array.isArray(tags) ? tags : [tags];
    filter.tags = { $in: arr };
  }

  return filter;
}

/**
 * PROJECT ROUTES
 * ------------------------------------------------------------------ */
export const getProjects = async (req: any, res: any) => {
  try {
    const filter = buildProjectFilter(req.query);

    const projects = await Project.find(filter)
      .select('title type ownerId thumbnail tags starred sharedWith updatedAt')
      .sort({ updatedAt: -1 });

    res.status(200).json(projects);
  } catch (err: any) {
    console.error('getProjects error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getPaginatedProjects = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = buildProjectFilter(req.query);

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select('title type ownerId thumbnail tags starred updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Project.countDocuments(filter)
    ]);

    res.status(200).json({
      projects,
      totalProjects: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum
    });
  } catch (err: any) {
    console.error('getPaginatedProjects error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getProjectById = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const query = isObjectId(id) ? { _id: id } : { slug: id };

    const project = await Project.findOne(query).populate({
      path: 'layoutId',
      select: '-__v'
    });

    console.log('the project', project);

    

    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json(project);
  } catch (err: any) {
    console.error('getProjectById error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * Create a new project.
 * The request body is expected to contain:
 *   { title, ownerId, type, tags?, layout?, presetId? }
 */
export const createProject = async (req: any, res: any) => {
  try {
    const { layout: layoutPayload, presetId, ...meta } = req.body;

    let finalLayoutPayload = layoutPayload;

    // Handle preset-based project creation
    if (presetId && !layoutPayload) {
      console.log('Creating project from preset:', presetId);
      
      try {
        const { getPresetByKey } = await import('../config/projectPresets');
        const [category, key] = presetId.split(':');
        const preset = getPresetByKey(category, key);
        
        if (!preset) {
          return res.status(400).json({ message: `Preset ${presetId} not found` });
        }
        
        // Create default layout with preset data
        finalLayoutPayload = {
          pages: [{
            id: `page-${Date.now()}`,
            name: 'Page 1',
            canvas: {
              width: preset.canvasSize.width,
              height: preset.canvasSize.height
            },
            background: { type: 'color', value: '#ffffff' },
            elements: []
          }]
        };
        
        // Apply preset data to meta
        if (!meta.title) meta.title = `${preset.name} Project`;
        if (!meta.type) meta.type = preset.type;
        if (!meta.tags) meta.tags = preset.tags;
        
      } catch (error) {
        console.error('Error applying preset:', error);
        return res.status(400).json({ message: 'Failed to apply preset data' });
      }
    }

    if (!finalLayoutPayload) {
      console.log('layoutPayload is missing and no preset provided');
      return res.status(400).json({ message: 'layout or presetId is required' });
    }
    console.log('finalLayoutPayload', finalLayoutPayload);

    // 1️⃣  Persist layout first
    const layoutDoc = await Layout.create(finalLayoutPayload);

    if (!layoutDoc) {
      return res.status(500).json({ message: 'Failed to create layout' });
    }

    // 2️⃣  Prepare project payload
    const thumbnailProcessed = await processProjectThumbnail(meta, meta.ownerId);

    if (!thumbnailProcessed) {
      return res.status(400).json({ message: 'Failed to process thumbnail' });
    }

    // 3️⃣  Convert ownerId to ObjectId if it's a valid format, otherwise create a dummy ObjectId
    let processedOwnerId = (thumbnailProcessed as any).ownerId;
    if (processedOwnerId && typeof processedOwnerId === 'string') {
      if (isObjectId(processedOwnerId)) {
        processedOwnerId = new mongoose.Types.ObjectId(processedOwnerId);
      } else {
        // For now, create a dummy ObjectId for development/testing
        // In production, this should be replaced with proper user authentication
        processedOwnerId = new mongoose.Types.ObjectId();
        console.warn(`Warning: Creating dummy ObjectId for invalid ownerId: ${(thumbnailProcessed as any).ownerId}`);
      }
    }

    // 3️⃣  Create the project with the processed data
    console.log('processedOwnerId', processedOwnerId);

    const project = await Project.create({
      ...thumbnailProcessed,
      ownerId: processedOwnerId,
      layoutId: layoutDoc._id
    });

    if (!project) {
      return res.status(500).json({ message: 'Failed to create project' });
    }

    // 4️⃣  Vectorize if it could serve as a template
    await vectorizeTemplate(project);

    console.log('Project created successfully:', project);

    res.status(201).json(project);
  } catch (err: any) {
    console.error('createProject error', err);
    return res.status(400).json({ message: 'Failed to create project', error: err.message });
  }
};

/**
 * Update project metadata and/or layout. If `layout` exists in the body, it
 * updates the referenced Layout document; otherwise only project meta changes.
 */
export const updateProject = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    // Find project & layout
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // 🔄 1. Handle layout update
    if (payload.layout) {
      await Layout.findByIdAndUpdate(project.layoutId, payload.layout, { new: true, runValidators: true });
    }

    // 🔄 2. Handle thumbnail & other meta updates
    const processedMeta = await processProjectThumbnail(payload, project.ownerId?.toString() || '');
    delete (processedMeta as any).layout; // ensure we don't overwrite ObjectId

    const updatedProject = await Project.findByIdAndUpdate(id, processedMeta, { new: true, runValidators: true });

    res.status(200).json(updatedProject);
  } catch (err: any) {
    console.error('updateProject error', err);
    res.status(400).json({ message: 'Failed to update project', error: err.message });
  }
};

export const deleteProject = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Delete layout first to avoid orphans
    await Layout.findByIdAndDelete(project.layoutId);
    await Project.findByIdAndDelete(id);

    res.status(200).json({ message: 'Project deleted' });
  } catch (err: any) {
    console.error('deleteProject error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const cloneProject = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ message: 'ownerId required' });

    const source = await Project.findById(id).populate('layoutId');
    if (!source) return res.status(404).json({ message: 'Project not found' });

    // Deep‑clone layout
    const layoutData = (source.layoutId as any)?.toObject ? (source.layoutId as any).toObject() : source.layoutId;
    const clonedLayout = await Layout.create(JSON.parse(JSON.stringify(layoutData)));

    // Convert ownerId to ObjectId if needed
    let processedOwnerId = ownerId;
    if (typeof processedOwnerId === 'string') {
      if (isObjectId(processedOwnerId)) {
        processedOwnerId = new mongoose.Types.ObjectId(processedOwnerId);
      } else {
        // For now, create a dummy ObjectId for development/testing
        processedOwnerId = new mongoose.Types.ObjectId();
        console.warn(`Warning: Creating dummy ObjectId for invalid ownerId: ${ownerId}`);
      }
    }

    const clone = await Project.create({
      title: `${source.title} (Copy)`,
      ownerId: processedOwnerId,
      type: source.type,
      tags: source.tags,
      layoutId: clonedLayout._id,
      thumbnail: source.thumbnail
    });

    res.status(201).json(clone);
  } catch (err: any) {
    console.error('cloneProject error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const toggleTemplate = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { isTemplate } = req.body;
    
    if (isTemplate === undefined) {
      return res.status(400).json({ message: 'isTemplate field is required' });
    }
    
    const project = await Project.findByIdAndUpdate(
      id, 
      { isTemplate }, 
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json(project);
  } catch (err: any) {
    console.error('Error updating project template status:', err);
    res.status(400).json({ message: 'Failed to update project', error: err.message });
  }
};

export const getProjectPresets = async (req: any, res: any) => {
  try {
    const presets = getPresetsList();
    res.status(200).json(presets);
  } catch (err: any) {
    console.error('getTemplatePresets error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}


/**
 * TEMPLATE ROUTES
 * ------------------------------------------------------------------ */
function buildTemplateFilter(query: any) {
  const { type, category, featured, popular } = query;
  const filter: any = { status: 'active' };
  if (type) filter.type = type;
  if (category) filter.categories = category;
  if (featured !== undefined) filter.featured = featured === 'true';
  if (popular !== undefined) filter.popular = popular === 'true';
  return filter;
}

export const getTemplates = async (req: any, res: any) => {
  try {
    const filter = buildTemplateFilter(req.query);

    const templates = await Template.find(filter)
      .select('title slug type thumbnailUrl categories popularity updatedAt')
      .sort({ popularity: -1, updatedAt: -1 });

    res.status(200).json(templates);
  } catch (err: any) {
    console.error('getTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const searchTemplates = async (req: any, res: any) => {
  try {
    const { query, limit = 20, threshold = 0.7, categories, aspectRatio, type } = req.query;
    if (!query) return res.status(400).json({ message: 'query is required' });

    const options = { 
      limit: +limit, 
      threshold: +threshold,
      categories: categories ? (Array.isArray(categories) ? categories : [categories]) : null,
      aspectRatio: aspectRatio || null,
      type: type || null
    };

    // Perform vector search
    const vectorHits = await templateVectorService.searchTemplates(query, options);

    if (vectorHits.length === 0) {
      return res.status(200).json({ 
        results: [], 
        total: 0, 
        searchType: 'vector',
        message: 'No templates found matching your search criteria'
      });
    }

    // Separate Template IDs from Project IDs based on metadata
    const templateIds: string[] = [];
    const projectIds: string[] = [];
    
    vectorHits.forEach((hit: any) => {
      if (hit.metadata && hit.metadata.type === 'template') {
        templateIds.push(hit.templateId.toString());
      } else if (hit.metadata && hit.metadata.type === 'project-template') {
        projectIds.push(hit.templateId.toString());
      }
    });

    // Fetch both Template and Project documents
    const [templates, projects] = await Promise.all([
      templateIds.length > 0 ? Template.find({ _id: { $in: templateIds } }).populate('layoutId') : [],
      projectIds.length > 0 ? Project.find({ _id: { $in: projectIds } }).populate('layoutId') : []
    ]);

    // Combine and enrich results
    const results = vectorHits.map((hit: any) => {
      let doc;
      if (hit.metadata && hit.metadata.type === 'template') {
        doc = templates.find((t: any) => t._id.toString() === hit.templateId);
      } else {
        doc = projects.find((p: any) => p._id.toString() === hit.templateId);
      }
      
      return doc ? { 
        ...doc.toObject(), 
        vectorScore: hit.score,
        searchRelevance: hit.score,
        sourceType: hit.metadata?.type || 'unknown' // 'template' or 'project-template'
      } : null;
    }).filter(Boolean);

    res.status(200).json({ 
      results, 
      total: results.length, 
      searchType: 'vector',
      query: query 
    });
  } catch (err: any) {
    console.error('searchTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getSimilarTemplates = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { limit = 10, categories, aspectRatio } = req.query;

    // Try to find the base template in both Template and Project collections
    const [templateDoc, projectDoc] = await Promise.all([
      Template.findById(id),
      Project.findById(id)
    ]);

    const baseDoc = templateDoc || projectDoc;
    if (!baseDoc) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const options = {
      categories: categories ? (Array.isArray(categories) ? categories : [categories]) : null,
      aspectRatio: aspectRatio || null
    };

    // Find similar templates using vector similarity
    const hits = await templateVectorService.getSimilarTemplates(id, +limit, options);
    
    if (hits.length === 0) {
      return res.status(200).json({ 
        baseTemplate: { id: baseDoc._id, title: baseDoc.title },
        results: [],
        total: 0,
        searchType: 'similarity',
        message: 'No similar templates found'
      });
    }

    // Separate Template IDs from Project IDs
    const templateIds: string[] = [];
    const projectIds: string[] = [];
    
    hits.forEach((hit: any) => {
      if (hit.metadata && hit.metadata.type === 'template') {
        templateIds.push(hit.templateId.toString());
      } else if (hit.metadata && hit.metadata.type === 'project-template') {
        projectIds.push(hit.templateId.toString());
      }
    });

    // Fetch documents from both collections
    const [templates, projects] = await Promise.all([
      templateIds.length > 0 ? Template.find({ _id: { $in: templateIds } }).populate('layoutId') : [],
      projectIds.length > 0 ? Project.find({ _id: { $in: projectIds } }).populate('layoutId') : []
    ]);

    // Combine and enrich results
    const results = hits.map((hit: any) => {
      let doc;
      if (hit.metadata && hit.metadata.type === 'template') {
        doc = templates.find((t: any) => t._id.toString() === hit.templateId);
      } else {
        doc = projects.find((p: any) => p._id.toString() === hit.templateId);
      }
      
      return doc ? { 
        ...doc.toObject(), 
        similarityScore: hit.score,
        searchRelevance: hit.score,
        sourceType: hit.metadata?.type || 'unknown'
      } : null;
    }).filter(Boolean);

    res.status(200).json({ 
      baseTemplate: { id: baseDoc._id, title: baseDoc.title }, 
      results,
      total: results.length,
      searchType: 'similarity'
    });
  } catch (err: any) {
    console.error('getSimilarTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const hybridSearchTemplates = async (req: any, res: any) => {
  try {
    const {
      query,
      limit = 20,
      vectorWeight = 0.7,
      textWeight = 0.3
    } = req.query;

    if (!query) return res.status(400).json({ message: 'query is required' });

    const searchLimit = Math.ceil(+limit * 1.5);

    /* Vector search */
    const vectorHits = await templateVectorService.searchTemplates(query, {
      ...buildTemplateFilter(req.query),
      limit: searchLimit,
      threshold: 0.5
    });

    /* Text search */
    const textHits = await Template.find({
      ...buildTemplateFilter(req.query),
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { categories: { $in: [new RegExp(query, 'i')] } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    }).limit(searchLimit);

    /* Combine */
    const scores = new Map();
    vectorHits.forEach((h: any) => {
      scores.set(h.templateId, { vectorScore: h.score * +vectorWeight, textScore: 0 });
    });
    textHits.forEach((doc: any, idx: number) => {
      const textScore = (1 - idx / textHits.length) * +textWeight;
      const id = doc._id.toString();
      if (!scores.has(id)) scores.set(id, { vectorScore: 0, textScore });
      else scores.get(id).textScore = textScore;
    });

    const combined = Array.from(scores.entries()).map(([id, s]: [string, any]) => ({
      templateId: id,
      totalScore: s.vectorScore + s.textScore,
      ...s
    })).sort((a, b) => b.totalScore - a.totalScore).slice(0, +limit);

    const docs = await Template.find({ _id: { $in: combined.map((c) => c.templateId) } });

    const results = combined.map((c) => {
      const doc = docs.find((d: any) => d._id.toString() === c.templateId);
      return doc ? { ...doc.toObject(), ...c } : null;
    }).filter(Boolean);

    res.status(200).json({ results, searchType: 'hybrid', total: results.length });
  } catch (err: any) {
    console.error('hybridSearchTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * Create a new template
 */
export const createTemplate = async (req: any, res: any) => {
  try {
    const templateData = req.body;

    // Create the template
    const template = await Template.create(templateData);

    // Automatically vectorize the template
    await vectorizeTemplate(template, true);

    res.status(201).json(template);
  } catch (err: any) {
    console.error('createTemplate error', err);
    res.status(400).json({ message: 'Failed to create template', error: err.message });
  }
};

/**
 * Update a template
 */
export const updateTemplate = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await Template.findByIdAndUpdate(id, updates, { 
      new: true, 
      runValidators: true 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Re-vectorize the updated template
    await templateVectorService.updateTemplate(template);

    res.status(200).json(template);
  } catch (err: any) {
    console.error('updateTemplate error', err);
    res.status(400).json({ message: 'Failed to update template', error: err.message });
  }
};

/**
 * Delete a template
 */
export const deleteTemplate = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const template = await Template.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Remove from vector store
    await templateVectorService.removeTemplate(id);

    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (err: any) {
    console.error('deleteTemplate error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Helper function to check if a project should be vectorized as a template
function shouldVectorizeAsTemplate(project: any): boolean {
  // For now, we'll vectorize all projects that could serve as templates
  // This could be enhanced with more sophisticated logic later
  return project.layoutId && (project.starred || project.type !== 'custom');
}

// Helper function to vectorize template/project
async function vectorizeTemplate(doc: any, isTemplate: boolean = false) {
  try {
    if (isTemplate || shouldVectorizeAsTemplate(doc)) {
      await templateVectorService.addTemplate(doc);
      console.log(`${isTemplate ? 'Template' : 'Project'} ${doc._id} vectorized successfully`);
    }
  } catch (error) {
    console.error(`Error vectorizing ${isTemplate ? 'template' : 'project'}:`, error);
  }
}

/**
 * Create a project from image analysis
 * Takes an asset ID, runs image analysis, and creates a project with the analyzed layout
 */
export const createProjectFromImage = async (req: any, res: any) => {
  try {
    const { assetId, title, ownerId, type = 'custom', tags = [] } = req.body;

    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    // 1️⃣ Get the asset
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // 2️⃣ Verify it's an image
    if (asset.type !== 'image') {
      return res.status(400).json({ message: 'Asset must be an image' });
    }

    // 3️⃣ Get image URL for analysis
    const imageUrl = asset.cloudinaryUrl || asset.url;
    if (!imageUrl) {
      return res.status(400).json({ message: 'Asset has no accessible URL for analysis' });
    }

    console.log('Starting image analysis for project creation:', asset.name);

    // 4️⃣ Run image analysis
    const analysis = await imageAnalysisService.analyzeImage(imageUrl);
    
    if (!analysis || !analysis.pages || !analysis.pages.length) {
      return res.status(500).json({ message: 'Failed to analyze image or no content detected' });
    }

    // 5️⃣ Prepare layout from analysis
    const analyzedPage = analysis.pages[0]; // Take the first (and likely only) page
    
    const layoutPayload = {
      pages: [{
        name: analyzedPage.name || 'Analyzed Page',
        canvas: {
          width: analyzedPage.canvas?.width || 800,
          height: analyzedPage.canvas?.height || 600
        },
        background: analyzedPage.background || { type: 'color', value: '#ffffff' },
        elements: analyzedPage.elements || []
      }]
    };

    console.log('Created layout from analysis:', JSON.stringify(layoutPayload, null, 2));

    // 6️⃣ Create layout document
    const layoutDoc = await Layout.create(layoutPayload);
    if (!layoutDoc) {
      return res.status(500).json({ message: 'Failed to create layout from analysis' });
    }

    // 7️⃣ Prepare project metadata
    const projectTitle = title || `Project from ${asset.name}`;
    const projectMeta = {
      title: projectTitle,
      description: `Project created from image analysis of ${asset.name}`,
      type,
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      ownerId
    };

    // 8️⃣ Process thumbnail (reuse existing thumbnail processing)
    const thumbnailProcessed = await processProjectThumbnail(projectMeta, ownerId);
    if (!thumbnailProcessed) {
      return res.status(400).json({ message: 'Failed to process thumbnail' });
    }

    // 9️⃣ Handle ownerId conversion
    let processedOwnerId = (thumbnailProcessed as any).ownerId;
    if (processedOwnerId && typeof processedOwnerId === 'string') {
      if (isObjectId(processedOwnerId)) {
        processedOwnerId = new mongoose.Types.ObjectId(processedOwnerId);
      } else {
        processedOwnerId = new mongoose.Types.ObjectId();
        console.warn(`Warning: Creating dummy ObjectId for invalid ownerId: ${(thumbnailProcessed as any).ownerId}`);
      }
    }

    // 🔟 Create the project
    const project = await Project.create({
      ...thumbnailProcessed,
      ownerId: processedOwnerId,
      layoutId: layoutDoc._id,
      sourceAssetId: assetId // Track which asset this was created from
    });

    if (!project) {
      return res.status(500).json({ message: 'Failed to create project' });
    }

    // 1️⃣1️⃣ Vectorize the project for future template matching
    await vectorizeTemplate(project);

    console.log('Project created successfully from image analysis:', project.title);

    res.status(201).json({
      project,
      analysisData: analyzedPage,
      message: 'Project created successfully from image analysis'
    });

  } catch (err: any) {
    console.error('createProjectFromImage error', err);
    return res.status(500).json({ 
      message: 'Failed to create project from image analysis', 
      error: err.message 
    });
  }
};


// Default export for CommonJS compatibility
export default {
  getProjects,
  getPaginatedProjects,
  getProjectPresets,
  getProjectById,
  createProject,
  createProjectFromImage,
  updateProject,
  deleteProject,
  cloneProject,
  getTemplates,
  searchTemplates,
  getSimilarTemplates,
  hybridSearchTemplates,
  toggleTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
