const Folder = require('../models/Folder');
const Asset = require('../models/Asset');

// Get all folders for a user (with optional parent folder filtering)
exports.getFolders = async (req, res) => {
  try {
    const { userId, parentId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const filter = { userId };
    if (parentId !== undefined) {
      // If parentId is explicitly null, find root folders
      if (parentId === 'null') {
        filter.parentId = null;
      } else {
        filter.parentId = parentId;
      }
    }
    
    const folders = await Folder.find(filter).sort({ name: 1 });
    res.status(200).json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single folder by ID
exports.getFolderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const folder = await Folder.findById(id);
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    res.status(200).json(folder);
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, userId, parentId } = req.body;
    
    if (!name || !userId) {
      return res.status(400).json({ message: 'Name and user ID are required' });
    }
    
    // Set up the folder path
    let path = '/';
    
    // If this is a subfolder, get the parent folder to build the path
    if (parentId) {
      const parentFolder = await Folder.findById(parentId);
      if (!parentFolder) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
      
      // Build path based on parent
      path = parentFolder.path === '/' ? `/${parentFolder.name}` : `${parentFolder.path}/${parentFolder.name}`;
    }
    
    const newFolder = new Folder({
      name,
      userId,
      parentId: parentId || null,
      path
    });
    
    const savedFolder = await newFolder.save();
    res.status(201).json(savedFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(400).json({ message: 'Failed to create folder', error: error.message });
  }
};

// Update a folder
exports.updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow changing parentId directly through update since it requires path updates
    if (updates.parentId !== undefined) {
      return res.status(400).json({ message: 'Changing parent folder hierarchy not allowed through this endpoint' });
    }
    
    const folder = await Folder.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    res.status(200).json(folder);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(400).json({ message: 'Failed to update folder', error: error.message });
  }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find folder to delete
    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Get all subfolders recursively
    const getSubfolderIds = async (folderId) => {
      const folders = await Folder.find({ parentId: folderId });
      let ids = [folderId];
      
      for (const subfolder of folders) {
        const subIds = await getSubfolderIds(subfolder._id);
        ids = [...ids, ...subIds];
      }
      
      return ids;
    };
    
    // Get all folder IDs to delete
    const folderIds = await getSubfolderIds(id);
    
    // Delete all assets in these folders
    await Asset.deleteMany({ folderId: { $in: folderIds } });
    
    // Delete all folders
    await Folder.deleteMany({ _id: { $in: folderIds } });
    
    res.status(200).json({ message: 'Folder and all contents deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Move folder to a new parent
exports.moveFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { newParentId } = req.body;
    
    // Find the folder to move
    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Check if the new parent exists (or is null for root)
    let newPath = '/';
    if (newParentId) {
      const newParent = await Folder.findById(newParentId);
      if (!newParent) {
        return res.status(404).json({ message: 'New parent folder not found' });
      }
      
      // Prevent circular references
      if (folder._id.equals(newParentId) || folder.path.includes(`/${newParent.name}`)) {
        return res.status(400).json({ message: 'Cannot move folder inside itself or its descendants' });
      }
      
      // Build new path
      newPath = newParent.path === '/' ? `/${newParent.name}` : `${newParent.path}/${newParent.name}`;
    }
    
    // Calculate old path segment for updating descendants
    const oldPath = folder.path === '/' ? `/${folder.name}` : `${folder.path}/${folder.name}`;
    
    // Update the folder itself
    folder.parentId = newParentId || null;
    folder.path = newPath;
    await folder.save();
    
    // Update all descendant folders by replacing the path prefix
    const descendants = await Folder.find({ path: { $regex: `^${oldPath}/` } });
    for (const descendant of descendants) {
      descendant.path = descendant.path.replace(oldPath, newPath);
      await descendant.save();
    }
    
    res.status(200).json({ message: 'Folder moved successfully', folder });
  } catch (error) {
    console.error('Error moving folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};