const Design = require('../models/Design');

// Get all designs (with optional filtering)
exports.getDesigns = async (req, res) => {
  try {
    const { userId, starred, category, type } = req.query;
    
    // Build filter object based on query params
    const filter = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (category) filter.category = category;
    if (type) filter.type = type;
    
    const designs = await Design.find(filter)
      .select('title type userId thumbnail category starred shared createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(designs);
  } catch (error) {
    console.error('Error fetching designs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get design by ID
exports.getDesignById = async (req, res) => {
  try {
    // Use findOne with a custom ID field if the ID is not a valid ObjectId
    const id = req.params.id;
    let design;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findById
      design = await Design.findById(id);
    } else {
      // If it's a custom ID format, try to find by other fields
      design = await Design.findOne({ 
        $or: [
          { _id: id },
          { 'pages.id': id } // If it might be a page ID
        ]
      });
    }
    
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }
    
    res.status(200).json(design);
  } catch (error) {
    console.error('Error fetching design:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new design
exports.createDesign = async (req, res) => {
  try {
    const newDesign = new Design(req.body);
    const savedDesign = await newDesign.save();
    
    res.status(201).json(savedDesign);
  } catch (error) {
    console.error('Error creating design:', error);
    res.status(400).json({ message: 'Failed to create design', error: error.message });
  }
};

// Update design
exports.updateDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    let design;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findByIdAndUpdate
      design = await Design.findByIdAndUpdate(
        id, 
        updates, 
        { new: true, runValidators: true }
      );
    } else {
      // For custom ID formats, use findOneAndUpdate
      design = await Design.findOneAndUpdate(
        { $or: [{ _id: id }, { 'pages.id': id }] },
        updates,
        { new: true, runValidators: true }
      );
    }
    
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }
    
    res.status(200).json(design);
  } catch (error) {
    console.error('Error updating design:', error);
    res.status(400).json({ message: 'Failed to update design', error: error.message });
  }
};

// Delete design
exports.deleteDesign = async (req, res) => {
  try {
    const { id } = req.params;
    
    let design;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's a valid ObjectId, use findByIdAndDelete
      design = await Design.findByIdAndDelete(id);
    } else {
      // For custom ID formats, use findOneAndDelete
      design = await Design.findOneAndDelete({ 
        $or: [{ _id: id }, { 'pages.id': id }] 
      });
    }
    
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }
    
    res.status(200).json({ message: 'Design deleted successfully' });
  } catch (error) {
    console.error('Error deleting design:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Clone design
exports.cloneDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required for cloning' });
    }
    
    const design = await Design.findById(id);
    
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }
    
    // Create a new design object without the _id field
    const designData = design.toObject();
    delete designData._id;
    
    // Update fields for the cloned design
    designData.userId = userId;
    designData.title = `${designData.title} (Copy)`;
    designData.shared = false;
    designData.starred = false;
    
    const newDesign = new Design(designData);
    const savedDesign = await newDesign.save();
    
    res.status(201).json(savedDesign);
  } catch (error) {
    console.error('Error cloning design:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};