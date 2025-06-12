// filepath: /Users/mattparisien/Dropbox/Development/canva-clone/back/controllers/projectController.ts
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
import type {
  CreateProjectPayload,
  UpdateProjectPayload,
  CloneProjectPayload,
  ToggleTemplatePayload,
  CreateProjectWithFullDataPayload
} from '@canva-clone/shared-types/dist/design/payloads';
import type { Project as ProjectType } from '@canva-clone/shared-types/dist/design/models/project';

const unlinkAsync = promisify(fs.unlink);

// Simplified project creation data interface that matches our current database structure
interface ProjectCreateData {
  title: string;
  description: string;
  type: string;
  userId: string;
  category?: string;
  starred: boolean;
  shared: boolean;
  isTemplate: boolean;
  canvasSize: {
    name: string;
    width: number;
    height: number;
  };
  thumbnail?: string;
  pages: Array<{
    id: string;
    name: string;
    canvasSize: {
      name: string;
      width: number;
      height: number;
    };
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

// Create new project with simplified options
export const createProject = async (req: Request<{}, any, CreateProjectPayload>, res: Response): Promise<void> => {
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

    // Define default canvas sizes based on project type (for backwards compatibility)
    const defaultCanvasSizes = {
      presentation: { name: "Presentation 16:9", width: 1920, height: 1080 },
      social: { name: "Instagram Post", width: 1080, height: 1080 },
      print: { name: "Letter", width: 2550, height: 3300 },
      custom: { name: "Custom", width: 1920, height: 1080 }
    };

    // Convert dimensions to legacy canvas size format if provided
    let finalCanvasSize;
    if (dimensions) {
      finalCanvasSize = {
        name: `${type} Canvas`,
        width: dimensions.width,
        height: dimensions.height
      };
    } else {
      finalCanvasSize = defaultCanvasSizes[type as keyof typeof defaultCanvasSizes] || defaultCanvasSizes.custom;
    }

    // Define the default background for the page
    const defaultBackground: CanvasBackground = {
      type: 'color',
      value: '#ffffff'
    };

    // Generate default thumbnail based on canvas background and dimensions
    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await generateCanvasPreviewThumbnail(
        finalCanvasSize,
        defaultBackground,
        userId,
        [] // No elements for new projects
      );
      console.log('Generated default thumbnail:', thumbnailUrl);
    } catch (thumbnailError) {
      console.error('Failed to generate default thumbnail:', thumbnailError);
      // Continue with project creation even if thumbnail generation fails
    }

    // Create the project data using the simplified structure
    const projectData: ProjectCreateData = {
      title,
      description,
      type,
      userId,
      category,
      starred: false,
      shared: false,
      isTemplate: false,
      canvasSize: finalCanvasSize,
      thumbnail: thumbnailUrl || undefined,
      pages: [
        {
          id: pageId,
          name: 'Page 1',
          canvasSize: finalCanvasSize,
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
    console.error('Error creating project with full data:', error);
    res.status(400).json({ message: 'Failed to create project', error: (error as Error).message });
  }
};

// Continue with other functions...
// (I'll stop here for now since the file was getting corrupted)
