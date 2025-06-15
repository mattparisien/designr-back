import { Request, Response } from 'express';

// Import JavaScript modules using require
const asyncHandler = require('express-async-handler');
const Template = require('../models/Template');
const Project = require('../models/Project');

// Import shared types
import type {
  CreateTemplateFromProjectPayload,
  CreateTemplatePayload,
  DeleteTemplateResponse,
  TemplateId,
  UpdateTemplatePayload,
  UseTemplatePayload,
  UseTemplateResponse
} from '@canva-clone/shared-types';

// Get all templates with optional filtering
export const getTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category, type, featured, popular, tags } = req.query;

  // Build filter object based on query params
  const filter: any = {};
  if (category) filter.category = category;
  if (type) filter.type = type;
  if (featured) filter.featured = featured === 'true';
  if (popular) filter.popular = popular === 'true';
  if (tags) {
    const tagList = (tags as string).split(',').map(tag => tag.trim());
    filter.tags = { $in: tagList };
  }

  const templates = await Template.find(filter)
    .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
    .sort({ updatedAt: -1 });

  res.status(200).json(templates);
});

// Get template by ID
export const getTemplateById = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  const template = await Template.findById(id);

  if (!template) {
    res.status(404).json({ message: 'Template not found' });
    return;
  }

  res.status(200).json(template);
});

// Create new template
export const createTemplate = asyncHandler(async (req: Request<{}, {}, CreateTemplatePayload>, res: Response): Promise<void> => {
  const templateData = req.body;

  // Validate required fields
  if (!templateData.author) {
    res.status(400).json({ message: 'Author is required' });
    return;
  }

  if (!templateData.category) {
    res.status(400).json({ message: 'Category is required' });
    return;
  }

  const newTemplate = new Template(templateData);
  const savedTemplate = await newTemplate.save();

  res.status(201).json(savedTemplate);
});

// Update template
export const updateTemplate = asyncHandler(async (req: Request<{ id: string }, {}, UpdateTemplatePayload>, res: Response): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;

  const template = await Template.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!template) {
    res.status(404).json({ message: 'Template not found' });
    return;
  }

  res.status(200).json(template);
});

// Delete template
export const deleteTemplate = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  const template = await Template.findByIdAndDelete(id);

  if (!template) {
    res.status(404).json({ message: 'Template not found' });
    return;
  }

  const response: DeleteTemplateResponse = {
    success: true,
    id: id as TemplateId,
    deleted: true
  };

  res.status(200).json(response);
});

// Create a project from a template
export const useTemplate = asyncHandler(async (req: Request<{ id: string }, {}, UseTemplatePayload>, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId, projectTitle } = req.body;

  if (!userId) {
    res.status(400).json({ message: 'User ID is required' });
    return;
  }

  // Find the template
  const template = await Template.findById(id);
  if (!template) {
    res.status(404).json({ message: 'Template not found' });
    return;
  }

  // Create a new project based on the template
  const projectData = {
    title: projectTitle || `${template.title} (from template)`,
    description: template.description,
    type: template.type,
    userId: userId,
    dimensions: template.dimensions,
    pages: template.pages,
    category: template.category,
    tags: template.tags,
    starred: false,
    shared: false,
    metadata: {
      templateId: template._id,
      createdFromTemplate: true
    }
  };

  // Create and save the new project
  const newProject = new Project(projectData);
  const savedProject = await newProject.save();

  const response: UseTemplateResponse = {
    success: true,
    project: savedProject,
    templateId: id as TemplateId
  };

  res.status(201).json(response);
});

// Convert existing project to template
export const createTemplateFromProject = asyncHandler(async (req: Request<{ projectId: string }, {}, CreateTemplateFromProjectPayload>, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { category, author, title, description, tags } = req.body;

  if (!category) {
    res.status(400).json({ message: 'Category is required' });
    return;
  }

  if (!author) {
    res.status(400).json({ message: 'Author is required' });
    return;
  }

  // Find the project
  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }

  // Create a new template based on the project
  const templateData = {
    title: title || project.title,
    description: description || project.description,
    type: project.type,
    category: category,
    author: author,
    dimensions: project.dimensions,
    pages: project.pages,
    thumbnail: project.thumbnail,
    tags: tags || project.tags || []
  };

  // Create and save the new template
  const newTemplate = new Template(templateData);
  const savedTemplate = await newTemplate.save();

  res.status(201).json(savedTemplate);
});

// Get featured templates
export const getFeaturedTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const templates = await Template.find({ featured: true })
    .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(10);

  res.status(200).json(templates);
});

// Get popular templates
export const getPopularTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const templates = await Template.find({ popular: true })
    .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(10);

  res.status(200).json(templates);
});

// Get templates by category
export const getTemplatesByCategory = asyncHandler(async (req: Request<{ category: string }>, res: Response): Promise<void> => {
  const { category } = req.params;

  const templates = await Template.find({ category })
    .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
    .sort({ updatedAt: -1 });

  res.status(200).json(templates);
});
