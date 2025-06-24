/* ------------------------------------------------------------------
 * Template‑related controller (TypeScript)
 * Works with the token‑driven Template model and lean Project/Layout models
 * ------------------------------------------------------------------ */

import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Template from '../models/Template';
import Project from '../models/Project';
import { LayoutDocument as Layout } from '../models/Page';

/* Helper ------------------------------------------------------------------ */
const isObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

function buildTemplateFilter(query: Record<string, any>) {
  const { category, type, featured, tags } = query;
  const filter: Record<string, any> = { status: 'active' };

  if (category) filter.categories = category;            // array contains value
  if (type) filter.aspectRatio = type;               // keep if you expose
  if (featured !== undefined) filter.featured = featured === 'true';
  if (tags) {
    const tagList = (Array.isArray(tags) ? tags : (tags as string).split(',')).map(t => t.trim());
    filter.tags = { $in: tagList };
  }
  return filter;
}

/* ------------------------------------------------------------------ */
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const filter = buildTemplateFilter(req.query);
    const templates = await Template.find(filter)
      .select('title slug aspectRatio thumbnailUrl categories tags popularity updatedAt')
      .sort({ popularity: -1, updatedAt: -1 });

    res.status(200).json(templates);
  } catch (err: any) {
    console.error('getTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tmpl = await Template.findById(id).populate('layoutId');

    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    res.status(200).json(tmpl);
  } catch (err: any) {
    console.error('getTemplateById error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // If no layoutId is provided, create a basic layout
    if (!payload.layoutId) {
      // Create a basic layout with default canvas and empty elements
      const basicLayout = await Layout.create({
        pages: [{
          name: "Page 1",
          canvas: { width: 800, height: 600 },
          background: {
            type: "color",
            value: "#ffffff"
          },
          elements: []
        }]
      });
      
      payload.layoutId = basicLayout._id;
    }

    // Generate default values for required fields if not provided
    if (!payload.slug) {
      payload.slug = `template-${Date.now()}`;
    }
    
    if (!payload.aspectRatio) {
      payload.aspectRatio = '4:5'; // Default aspect ratio
    }
    
    if (!payload.embedding) {
      payload.embedding = new Array(768).fill(0); // Default empty embedding
    }

    const saved = await Template.create(payload);
    res.status(201).json(saved);
  } catch (err: any) {
    console.error('createTemplate error', err);
    res.status(400).json({ message: 'Failed to create template', error: err.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const tmpl = await Template.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });

    res.status(200).json(tmpl);
  } catch (err: any) {
    console.error('updateTemplate error', err);
    res.status(400).json({ message: 'Failed to update template', error: err.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Template.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Template not found' });

    // optional: also delete its layout
    await Layout.findByIdAndDelete(deleted.layoutId);

    res.status(200).json({ message: 'Template deleted' });
  } catch (err: any) {
    console.error('deleteTemplate error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ------------------------------------------------------------------
 * Clone a template into a Project
 * ------------------------------------------------------------------ */
export const useTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;            // template id
    const { ownerId } = req.body;         // new project owner

    if (!ownerId) return res.status(400).json({ message: 'ownerId is required' });

    const tmpl = await Template.findById(id).populate('layoutId');
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });

    /* --------------------------------------------------
 * Clone the layout safely
 * -------------------------------------------------- */
    // layoutId can be either an ObjectId or a populated document. Cast to `any`

    const layoutSource: any = tmpl.layoutId;

    let plainLayout: any;
    if (layoutSource && typeof layoutSource.toObject === 'function') {
      plainLayout = layoutSource.toObject();
    } else {
      const fetched = await Layout.findById(layoutSource);
      if (!fetched) return res.status(500).json({ message: 'Associated layout not found' });
      plainLayout = fetched.toObject();
    }
    delete plainLayout._id; // ensure new _id is generateds
    const clonedLayout = await Layout.create(JSON.parse(JSON.stringify(plainLayout)));

    const project = await Project.create({
      title: `${tmpl.title} (Copy)`,
      ownerId,
      tags: tmpl.tags,
      type: tmpl.aspectRatio,
      layoutId: clonedLayout._id,
      sourceTemplateId: tmpl._id
    });

    res.status(201).json(project);
  } catch (err: any) {
    console.error('useTemplate error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ------------------------------------------------------------------
 * Create a Template from an existing Project
 * ------------------------------------------------------------------ */
export const createTemplateFromProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { slug, categories = [], tags = [] } = req.body;

    const proj = await Project.findById(projectId);
    if (!proj) return res.status(404).json({ message: 'Project not found' });

    // Slug must be unique
    if (!slug) return res.status(400).json({ message: 'slug is required' });

    const template = await Template.create({
      title: proj.title,
      slug,
      aspectRatio: proj.type,
      categories,
      tags,
      layoutId: proj.layoutId,
      embedding: [],        // supply via background job
      tokens: {},           // build if possible
      status: 'draft'
    });

    res.status(201).json(template);
  } catch (err: any) {
    console.error('createTemplateFromProject error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ------------------------------------------------------------------
 * Featured / Popular convenience endpoints
 * ------------------------------------------------------------------ */
export const getFeaturedTemplates = async (_req: Request, res: Response) => {
  try {
    const docs = await Template.find({ featured: true })
      .select('title slug thumbnailUrl categories popularity updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);
    res.status(200).json(docs);
  } catch (err: any) {
    console.error('getFeaturedTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getPopularTemplates = async (_req: Request, res: Response) => {
  try {
    const docs = await Template.find()
      .select('title slug thumbnailUrl categories popularity updatedAt')
      .sort({ popularity: -1 })
      .limit(10);
    res.status(200).json(docs);
  } catch (err: any) {
    console.error('getPopularTemplates error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getTemplatesByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const docs = await Template.find({ categories: category })
      .select('title slug thumbnailUrl categories popularity updatedAt')
      .sort({ updatedAt: -1 });

    res.status(200).json(docs);
  } catch (err: any) {
    console.error('getTemplatesByCategory error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
