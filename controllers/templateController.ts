import { Request, Response } from 'express';

// Import JavaScript modules using require
const Template = require('../../models/Template');
const Project = require('../../models/Project');

// Import shared types
import type { 
  Page,
  CreatePageData,
  CanvasBackground
} from '@canva-clone/shared-types/dist/canvas/components/pages';
import type { Dimensions } from '@canva-clone/shared-types/dist/design/hierarchical';
import type { ProjectId, PageId } from '@canva-clone/shared-types/dist/core/identifiers';

// Type definitions for request bodies
interface CreateTemplateRequest {
  title?: string;
  description?: string;
  type?: 'presentation' | 'social' | 'print' | 'custom';
  category: string;
  author: string;
  dimensions?: Dimensions;
  pages?: Page[];
  thumbnail?: string;
  tags?: string[];
  featured?: boolean;
  popular?: boolean;
}

interface UpdateTemplateRequest {
  title?: string;
  description?: string;
  type?: 'presentation' | 'social' | 'print' | 'custom';
  category?: string;
  author?: string;
  dimensions?: Dimensions;
  pages?: Page[];
  thumbnail?: string;
  tags?: string[];
  featured?: boolean;
  popular?: boolean;
}

interface UseTemplateRequest {
  userId: string;
}

interface CreateTemplateFromProjectRequest {
  category: string;
  author: string;
}

// Get all templates with optional filtering
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get template by ID
export const getTemplateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    
    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }
    
    res.status(200).json(template);
  } catch (error: any) {
    console.error('Error fetching template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new template
export const createTemplate = async (req: Request<{}, {}, CreateTemplateRequest>, res: Response): Promise<void> => {
  try {
    const templateData = req.body;
    
    // Make sure author field is set
    if (!templateData.author) {
      res.status(400).json({ message: 'Author is required' });
      return;
    }
    
    // Make sure category is set
    if (!templateData.category) {
      res.status(400).json({ message: 'Category is required' });
      return;
    }
    
    const newTemplate = new Template(templateData);
    const savedTemplate = await newTemplate.save();
    
    res.status(201).json(savedTemplate);
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(400).json({ message: 'Failed to create template', error: error.message });
  }
};

// Update template
export const updateTemplate = async (req: Request<{ id: string }, {}, UpdateTemplateRequest>, res: Response): Promise<void> => {
  try {
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
  } catch (error: any) {
    console.error('Error updating template:', error);
    res.status(400).json({ message: 'Failed to update template', error: error.message });
  }
};

// Delete template
export const deleteTemplate = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await Template.findByIdAndDelete(id);
    
    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }
    
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a project from a template
export const useTemplate = async (req: Request<{ id: string }, {}, UseTemplateRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
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
      title: `${template.title} (from template)`,
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
    
    res.status(201).json(savedProject);
  } catch (error: any) {
    console.error('Error creating project from template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Convert existing project to template
export const createTemplateFromProject = async (req: Request<{ projectId: string }, {}, CreateTemplateFromProjectRequest>, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { category, author } = req.body;
    
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
      title: project.title,
      description: project.description,
      type: project.type,
      category: category,
      author: author,
      dimensions: project.dimensions,
      pages: project.pages,
      thumbnail: project.thumbnail,
      tags: project.tags || []
    };
    
    // Create and save the new template
    const newTemplate = new Template(templateData);
    const savedTemplate = await newTemplate.save();
    
    res.status(201).json(savedTemplate);
  } catch (error: any) {
    console.error('Error creating template from project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get featured templates
export const getFeaturedTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await Template.find({ featured: true })
      .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);
      
    res.status(200).json(templates);
  } catch (error: any) {
    console.error('Error fetching featured templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get popular templates
export const getPopularTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await Template.find({ popular: true })
      .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);
      
    res.status(200).json(templates);
  } catch (error: any) {
    console.error('Error fetching popular templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get templates by category
export const getTemplatesByCategory = async (req: Request<{ category: string }>, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    
    const templates = await Template.find({ category })
      .select('title type category thumbnail previewImages tags featured popular dimensions createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(templates);
  } catch (error: any) {
    console.error('Error fetching templates by category:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
