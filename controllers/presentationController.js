const Presentation = require('../models/Presentation');

// Get all presentations (with optional filtering)
exports.getPresentations = async (req, res) => {
  try {
    const { userId, starred, category } = req.query;
    
    // Build filter object based on query params
    const filter = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (category) filter.category = category;
    
    const presentations = await Presentation.find(filter)
      .select('title userId thumbnail category starred shared createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(presentations);
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get presentation by ID
exports.getPresentationById = async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }
    
    res.status(200).json(presentation);
  } catch (error) {
    console.error('Error fetching presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new presentation
exports.createPresentation = async (req, res) => {
  try {
    const newPresentation = new Presentation(req.body);
    const savedPresentation = await newPresentation.save();
    
    res.status(201).json(savedPresentation);
  } catch (error) {
    console.error('Error creating presentation:', error);
    res.status(400).json({ message: 'Failed to create presentation', error: error.message });
  }
};

// Update presentation
exports.updatePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const presentation = await Presentation.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true }
    );
    
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }
    
    res.status(200).json(presentation);
  } catch (error) {
    console.error('Error updating presentation:', error);
    res.status(400).json({ message: 'Failed to update presentation', error: error.message });
  }
};

// Delete presentation
exports.deletePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const presentation = await Presentation.findByIdAndDelete(id);
    
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }
    
    res.status(200).json({ message: 'Presentation deleted successfully' });
  } catch (error) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Clone presentation
exports.clonePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required for cloning' });
    }
    
    const presentation = await Presentation.findById(id);
    
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }
    
    // Create a new presentation object without the _id field
    const presentationData = presentation.toObject();
    delete presentationData._id;
    
    // Update fields for the cloned presentation
    presentationData.userId = userId;
    presentationData.title = `${presentationData.title} (Copy)`;
    presentationData.shared = false;
    presentationData.starred = false;
    
    const newPresentation = new Presentation(presentationData);
    const savedPresentation = await newPresentation.save();
    
    res.status(201).json(savedPresentation);
  } catch (error) {
    console.error('Error cloning presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};