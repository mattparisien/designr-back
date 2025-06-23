import mongoose from 'mongoose';

// Models
import Project from '../models/Project';
import Template from '../models/Template';
import Layout from '../models/Page'; // Page.ts exports Layout model

// Services / helpers
import { processProjectThumbnail } from '../utils/thumbnailProcessor';
import templateVectorService from '../services/templateVectorService';

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
  if (ownerId) filter.ownerId = ownerId;
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
 *   { title, ownerId, type, tags?, layout }
 */
export const createProject = async (req: any, res: any) => {
  try {
    const { layout: layoutPayload, ...meta } = req.body;

    if (!layoutPayload) {
      return res.status(400).json({ message: 'layout is required' });
    }

    // 1️⃣  Persist layout first
    const layoutDoc = await Layout.create(layoutPayload);

    // 2️⃣  Prepare project payload
    const thumbnailProcessed = await processProjectThumbnail(meta, meta.ownerId);

    const project = await Project.create({
      ...thumbnailProcessed,
      layoutId: layoutDoc._id
    });

    res.status(201).json(project);
  } catch (err: any) {
    console.error('createProject error', err);
    res.status(400).json({ message: 'Failed to create project', error: err.message });
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

    const clone = await Project.create({
      title: `${source.title} (Copy)`,
      ownerId,
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
    const { query, limit = 20, threshold = 0.7 } = req.query;
    if (!query) return res.status(400).json({ message: 'query is required' });

    const options = { ...buildTemplateFilter(req.query), limit: +limit, threshold: +threshold };
    const vectorHits = await templateVectorService.searchTemplates(query, options);

    const ids = vectorHits.map((h: any) => h.templateId);
    const docs = await Template.find({ _id: { $in: ids } });

    const results = vectorHits.map((hit: any) => {
      const doc = docs.find((d: any) => d._id.toString() === hit.templateId);
      return doc ? { ...doc.toObject(), vectorScore: hit.score } : null;
    }).filter(Boolean);

    res.status(200).json({ results, total: results.length, searchType: 'vector' });
  } catch (err: any) {
    console.error('searchTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getSimilarTemplates = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const base = await Template.findById(id);
    if (!base) return res.status(404).json({ message: 'Template not found' });

    const hits = await templateVectorService.getSimilarTemplates(id, +limit, buildTemplateFilter(req.query));
    const ids = hits.map((h: any) => h.templateId);
    const docs = await Template.find({ _id: { $in: ids } });

    const results = hits.map((h: any) => {
      const doc = docs.find((d: any) => d._id.toString() === h.templateId);
      return doc ? { ...doc.toObject(), similarityScore: h.score } : null;
    }).filter(Boolean);

    res.status(200).json({ baseTemplate: { id: base._id, title: base.title }, results });
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

// Default export for CommonJS compatibility
export default {
  getProjects,
  getPaginatedProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  cloneProject,
  getTemplates,
  searchTemplates,
  getSimilarTemplates,
  hybridSearchTemplates
};
