const Project = require('../models/Project');
const cloudinary = require('../config/cloudinary');
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Get all projects (with optional filtering)
exports.getProjects = async (req, res) => {
  try {
    const { userId, starred, category, type, isTemplate } = req.query;
    
    // Build filter object based on query params
    const filter = {};
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get projects with pagination
exports.getPaginatedProjects = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userId, 
      starred, 
      shared,
      category, 
      type, 
      isTemplate,
      search
    } = req.query;

    // Convert string parameters to appropriate types
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;
    
    // Build filter object based on query params
    const filter = {};
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get project by ID
exports.getProjectById = async (req, res) => {
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
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new project with simplified options
exports.createProject = async (req, res) => {
  try {
    const { 
      title = 'Untitled Project',
      description = '',
      type = 'presentation',
      userId,
      category,
      templateId,
      canvasSize
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Generate a unique page ID
    const { v4: uuidv4 } = require('uuid');
    const pageId = uuidv4();

    // Define default canvas sizes based on project type
    const defaultCanvasSizes = {
      presentation: { name: "Presentation 16:9", width: 1920, height: 1080 },
      social: { name: "Instagram Post", width: 1080, height: 1080 },
      print: { name: "Letter", width: 2550, height: 3300 },
      custom: { name: "Custom", width: 1920, height: 1080 }
    };

    // Use provided canvas size or default based on type
    const finalCanvasSize = canvasSize || defaultCanvasSizes[type] || defaultCanvasSizes.custom;

    // Create the project data with defaults
    const projectData = {
      title,
      description,
      type,
      userId,
      category,
      starred: false,
      shared: false,
      isTemplate: false,
      canvasSize: finalCanvasSize,
      pages: [
        {
          id: pageId,
          name: 'Page 1',
          canvasSize: finalCanvasSize,
          elements: [],
          background: {
            type: 'color',
            value: '#ffffff'
          }
        }
      ],
      metadata: templateId ? { templateId, createdFromTemplate: true } : {}
    };

    const newProject = new Project(projectData);
    const savedProject = await newProject.save();
    
    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: 'Failed to create project', error: error.message });
  }
};

// Create project with full data (for backwards compatibility)
exports.createProjectWithFullData = async (req, res) => {
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
    res.status(400).json({ message: 'Failed to create project', error: error.message });
  }
};

// Update project
exports.updateProject = async (req, res) => {
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
          return res.status(404).json({ message: 'Project not found' });
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
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(400).json({ message: 'Failed to update project', error: error.message });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
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
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json({ message: 'Project deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Clone project
exports.cloneProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required for cloning' });
    }
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Create a new project object without the _id field
    const projectData = project.toObject();
    delete projectData._id;
    
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all templates
exports.getTemplates = async (req, res) => {
  try {
    const { category, type } = req.query;
    
    // Build filter object based on query params
    const filter = { isTemplate: true };
    if (category) filter.category = category;
    if (type) filter.type = type;
    
    const templates = await Project.find(filter)
      .select('title type userId thumbnail category isTemplate createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Convert project to template or vice versa
exports.toggleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { isTemplate } = req.body;
    
    if (isTemplate === undefined) {
      return res.status(400).json({ message: 'isTemplate field is required' });
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
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error('Error updating project template status:', error);
    res.status(400).json({ message: 'Failed to update project', error: error.message });
  }
};