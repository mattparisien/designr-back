const Template = require('../models/Template');
const Project = require('../models/Project');

// Get all templates with optional filtering
exports.getTemplates = async (req, res) => {
  try {
    const { category, type, featured, popular, tags } = req.query;
    
    // Build filter object based on query params
    const filter = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (featured) filter.featured = featured === 'true';
    if (popular) filter.popular = popular === 'true';
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagList };
    }
    
    const templates = await Template.find(filter)
      .select('title type category thumbnail previewImages tags featured popular canvasSize createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.status(200).json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new template
exports.createTemplate = async (req, res) => {
  try {
    const templateData = req.body;
    
    // Make sure author field is set
    if (!templateData.author) {
      return res.status(400).json({ message: 'Author is required' });
    }
    
    // Make sure category is set
    if (!templateData.category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    
    const newTemplate = new Template(templateData);
    const savedTemplate = await newTemplate.save();
    
    res.status(201).json(savedTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(400).json({ message: 'Failed to create template', error: error.message });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const template = await Template.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.status(200).json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(400).json({ message: 'Failed to update template', error: error.message });
  }
};

// Delete template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a project from a template
exports.useTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Find the template
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Create a new project based on the template
    const projectData = {
      title: `${template.title} (from template)`,
      description: template.description,
      type: template.type,
      userId: userId,
      canvasSize: template.canvasSize,
      pages: template.pages,
      category: template.category,
      tags: template.tags,
      starred: false,
      shared: false
    };
    
    // Add template reference
    projectData.metadata = {
      templateId: template._id,
      createdFromTemplate: true
    };
    
    // Create and save the new project
    const newProject = new Project(projectData);
    const savedProject = await newProject.save();
    
    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Error creating project from template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Convert existing project to template
exports.createTemplateFromProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { category, author } = req.body;
    
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    
    if (!author) {
      return res.status(400).json({ message: 'Author is required' });
    }
    
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Create a new template based on the project
    const templateData = {
      title: project.title,
      description: project.description,
      type: project.type,
      category: category,
      author: author,
      canvasSize: project.canvasSize,
      pages: project.pages,
      thumbnail: project.thumbnail,
      tags: project.tags || []
    };
    
    // Create and save the new template
    const newTemplate = new Template(templateData);
    const savedTemplate = await newTemplate.save();
    
    res.status(201).json(savedTemplate);
  } catch (error) {
    console.error('Error creating template from project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get featured templates
exports.getFeaturedTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ featured: true })
      .select('title type category thumbnail previewImages tags featured popular canvasSize createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching featured templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get popular templates
exports.getPopularTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ popular: true })
      .select('title type category thumbnail previewImages tags featured popular canvasSize createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching popular templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get templates by category
exports.getTemplatesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const templates = await Template.find({ category })
      .select('title type category thumbnail previewImages tags featured popular canvasSize createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates by category:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};