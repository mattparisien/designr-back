import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

// Import JavaScript modules using require
const Project = require('../../models/Project');
const cloudinary = require('../../config/cloudinary');
const { uploadToCloudinary } = require('../../utils/cloudinaryUploader');
const { generateCanvasPreviewThumbnail } = require('../../utils/thumbnailGenerator');

// Import shared types
import type { 
  Page,
  CreatePageData,
  CanvasBackground
} from '@canva-clone/shared-types/dist/canvas/components/pages';
import type { Dimensions } from '@canva-clone/shared-types/dist/design/hierarchical';
import type { ProjectId, PageId } from '@canva-clone/shared-types/dist/core/identifiers';

const unlinkAsync = promisify(fs.unlink);

// Type definitions for request bodies
interface CreateProjectRequest {
  title?: string;
  description?: string;
  type?: 'presentation' | 'social' | 'print' | 'custom';
  userId: string;
  category?: string;
  templateId?: string;
  dimensions?: Dimensions;
}

interface UpdateProjectRequest {
  title?: string;
  description?: string;
  pages?: Page[];
  thumbnail?: string;
  starred?: boolean;
  shared?: boolean;
  updatedAt?: string;
}

interface CloneProjectRequest {
  userId: string;
}

interface ToggleTemplateRequest {
  isTemplate: boolean;
}

// Project data interface for the database
interface ProjectData {
  title: string;
  description: string;
  type: string;
  userId: string;
  category?: string;
  starred: boolean;
  shared: boolean;
  isTemplate: boolean;
  dimensions: Dimensions;
  thumbnail?: string | null;
  pages: Array<{
    id: string;
    name: string;
    dimensions: Dimensions;
    elements: any[];
    background: CanvasBackground;
  }>;
  metadata?: {
    templateId?: string;
    createdFromTemplate?: boolean;
  };
}

// Get all projects (with optional filtering)
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, starred, category, type, isTemplate } = req.query;
    
    // Build filter object based on query params
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';
    
    const projects = await Project.find(filter)
      .select('title type userId thumbnail category starred shared isTemplate createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get projects with pagination
export const getPaginatedProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      userId, 
      starred, 
      shared,
      category, 
      type, 
      isTemplate,
      search
    } = req.query;

    // Convert string parameters to appropriate types
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;
    
    // Build filter object based on query params
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (shared) filter.shared = shared === 'true';
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';
    
    // Add text search if provided
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute queries in parallel for better performance
    const [projects, totalProjects] = await Promise.all([
      Project.find(filter)
        .select('title type userId thumbnail category starred shared isTemplate description createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Project.countDocuments(filter)
    ]);
    
    // Calculate total pages
    const totalPages = Math.ceil(totalProjects / limitNumber);
    
    res.status(200).json({
      projects,
      totalProjects,
      totalPages,
      currentPage: pageNumber
    });
  } catch (error) {
    console.error('Error fetching paginated projects:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get project by ID
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    // Use findOne with a custom ID field if the ID is not a valid ObjectId
    const id = req.params.id;
    let project;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findById
      project = await Project.findById(id);
    } else {
      // If it's a custom ID format, try to find by other fields
      project = await Project.findOne({ 
        $or: [
          { _id: id },
          { 'pages.id': id } // If it might be a page ID
        ]
      });
    }
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Create new project with simplified options
export const createProject = async (req: Request<{}, any, CreateProjectRequest>, res: Response): Promise<void> => {
  try {
    const { 
      title = 'Untitled Project',
      description = '',
      type = 'presentation',
      userId,
      category,
      templateId,
      dimensions
    } = req.body;

    // Validate required fields
    if (!userId) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    // Generate a unique page ID
    const pageId = crypto.randomBytes(16).toString('hex');

    // Define default dimensions based on project type
    const defaultDimensions: Record<string, Dimensions> = {
      presentation: { width: 1920, height: 1080, aspectRatio: '16:9' },
      social: { width: 1080, height: 1080, aspectRatio: '1:1' },
      print: { width: 2550, height: 3300, aspectRatio: '4:3' },
      custom: { width: 1920, height: 1080, aspectRatio: '16:9' }
    };

    // Use provided dimensions or default based on type
    const finalDimensions = dimensions || defaultDimensions[type] || defaultDimensions.custom;

    // Define the default background for the page
    const defaultBackground: CanvasBackground = {
      type: 'color',
      value: '#ffffff'
    };

    // Generate default thumbnail based on canvas background and dimensions
    let thumbnailUrl: string | null = null;
    try {
      // Convert dimensions to legacy canvasSize format for thumbnail generator
      const legacyCanvasSize = {
        name: `${type} Canvas`,
        width: finalDimensions.width,
        height: finalDimensions.height
      };
      
      thumbnailUrl = await generateCanvasPreviewThumbnail(
        legacyCanvasSize,
        defaultBackground,
        userId,
        [] // No elements for new projects
      );
      console.log('Generated default thumbnail:', thumbnailUrl);
    } catch (thumbnailError) {
      console.error('Failed to generate default thumbnail:', thumbnailError);
      // Continue with project creation even if thumbnail generation fails
    }

    // Create the project data with new dimensions structure
    const projectData: ProjectData = {
      title,
      description,
      type,
      userId,
      category,
      starred: false,
      shared: false,
      isTemplate: false,
      dimensions: finalDimensions, // Use new dimensions structure
      thumbnail: thumbnailUrl,
      pages: [
        {
          id: pageId,
          name: 'Page 1',
          dimensions: finalDimensions, // Use new dimensions structure
          elements: [],
          background: defaultBackground
        }
      ],
      metadata: templateId ? { templateId, createdFromTemplate: true } : {}
    };

    const newProject = new Project(projectData);
    const savedProject = await newProject.save();
    
    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: 'Failed to create project', error: (error as Error).message });
  }
};

// Create project with full data (for backwards compatibility)
export const createProjectWithFullData = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectData = req.body;
    
    // Handle thumbnail if it's a data URL (base64)
    if (projectData.thumbnail && projectData.thumbnail.startsWith('data:image')) {
      try {
        // Upload the thumbnail to Cloudinary
        const cloudinaryFolder = `users/${projectData.userId}/thumbnails`;
        // Create a temporary file with the base64 data in the project's temp-uploads directory
        const tempDir = path.join(__dirname, '../temp-uploads');
        
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tmpFilePath = path.join(tempDir, `thumbnail_${Date.now()}.png`);
        
        // Extract the base64 data without the prefix
        const base64Data = projectData.thumbnail.replace(/^data:image\/\w+;base64,/, "");
        await fs.promises.writeFile(tmpFilePath, base64Data, { encoding: 'base64' });
        
        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(tmpFilePath, cloudinaryFolder);
        
        // Replace the data URL with the Cloudinary URL
        projectData.thumbnail = uploadResult.secure_url;
        
        // Clean up the temporary file
        await unlinkAsync(tmpFilePath);
      } catch (thumbnailError) {
        console.error('Error processing thumbnail:', thumbnailError);
        // Continue with project creation even if thumbnail processing fails
      }
    }
    
    const newProject = new Project(projectData);
    const savedProject = await newProject.save();
    
    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: 'Failed to create project', error: (error as Error).message });
  }
};

// Update project
export const updateProject = async (req: Request<{ id: string }, any, UpdateProjectRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Handle thumbnail update if it's a data URL (base64)
    if (updates.thumbnail && updates.thumbnail.startsWith('data:image')) {
      try {
        // Find the project to get the user ID
        const project = id.match(/^[0-9a-fA-F]{24}$/) 
          ? await Project.findById(id)
          : await Project.findOne({ $or: [{ _id: id }, { 'pages.id': id }] });
          
        if (!project) {
          res.status(404).json({ message: 'Project not found' });
          return;
        }
        
        // Upload the thumbnail to Cloudinary
        const cloudinaryFolder = `users/${project.userId}/thumbnails`;
        // Create a temporary file with the base64 data in the project's temp-uploads directory
        const tempDir = path.join(__dirname, '../temp-uploads');
        
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tmpFilePath = path.join(tempDir, `thumbnail_${Date.now()}.png`);
        
        // Extract the base64 data without the prefix
        const base64Data = updates.thumbnail.replace(/^data:image\/\w+;base64,/, "");
        await fs.promises.writeFile(tmpFilePath, base64Data, { encoding: 'base64' });
        
        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(tmpFilePath, cloudinaryFolder);
        
        // Replace the data URL with the Cloudinary URL
        updates.thumbnail = uploadResult.secure_url;
        
        // Clean up the temporary file
        await unlinkAsync(tmpFilePath);
      } catch (thumbnailError) {
        console.error('Error processing thumbnail:', thumbnailError);
        // Continue with project update even if thumbnail processing fails
      }
    }
    
    let project;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findByIdAndUpdate
      project = await Project.findByIdAndUpdate(
        id, 
        updates, 
        { new: true, runValidators: true }
      );
    } else {
      // For custom ID formats, use findOneAndUpdate
      project = await Project.findOneAndUpdate(
        { $or: [{ _id: id }, { 'pages.id': id }] },
        updates,
        { new: true, runValidators: true }
      );
    }
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(400).json({ message: 'Failed to update project', error: (error as Error).message });
  }
};

// Delete project
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    let project;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findByIdAndDelete
      project = await Project.findByIdAndDelete(id);
    } else {
      // For custom ID formats, use findOneAndDelete
      project = await Project.findOneAndDelete({ 
        $or: [{ _id: id }, { 'pages.id': id }] 
      });
    }
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    res.status(200).json({ message: 'Project deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Clone project
export const cloneProject = async (req: Request<{ id: string }, any, CloneProjectRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ message: 'User ID is required for cloning' });
      return;
    }
    
    const project = await Project.findById(id);
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    // Create a new project object without the _id field
    const projectData = project.toObject();
    delete (projectData as any)._id;
    
    // Update fields for the cloned project
    projectData.userId = userId;
    projectData.title = `${projectData.title} (Copy)`;
    projectData.shared = false;
    projectData.starred = false;
    projectData.isTemplate = false; // Ensure cloned templates become regular projects
    
    const newProject = new Project(projectData);
    const savedProject = await newProject.save();
    
    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Error cloning project:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get all templates
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, type } = req.query;
    
    // Build filter object based on query params
    const filter: any = { isTemplate: true };
    if (category) filter.category = category;
    if (type) filter.type = type;
    
    const templates = await Project.find(filter)
      .select('title type userId thumbnail category isTemplate createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Convert project to template or vice versa
export const toggleTemplate = async (req: Request<{ id: string }, any, ToggleTemplateRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isTemplate } = req.body;
    
    if (isTemplate === undefined) {
      res.status(400).json({ message: 'isTemplate field is required' });
      return;
    }
    
    let project;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      project = await Project.findByIdAndUpdate(
        id, 
        { isTemplate }, 
        { new: true, runValidators: true }
      );
    } else {
      project = await Project.findOneAndUpdate(
        { $or: [{ _id: id }, { 'pages.id': id }] },
        { isTemplate },
        { new: true, runValidators: true }
      );
    }
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error updating project template status:', error);
    res.status(400).json({ message: 'Failed to update project', error: (error as Error).message });
  }
};
