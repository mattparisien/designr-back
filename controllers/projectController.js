const Project = require('../models/Project');

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

// Create new project
exports.createProject = async (req, res) => {
  try {
    const newProject = new Project(req.body);
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