import Folder from '../models/Folder.js';
import Asset from '../models/Asset.js';


// Get all folders for a user (with optional parent folder filtering)
exports.getFolders = async (req, res) => {
    try {
        // Support both formats: /api/folders?userId=123 and /api/folders/:userId
        const userId = req.query.userId || req.params.userId;
        const { parentId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                message: 'User ID is required' 
            });
        }
        const query = { userId };
        
        // If parentId is provided, filter by it
        if (parentId === 'null' || parentId === '') {
            query.parentId = null;
        } else if (parentId) {
            query.parentId = parentId;
        }

        const folders = await Folder.find(query);

        // For each folder, add a count of items (subfolders + assets) inside
        const foldersWithCounts = await Promise.all(folders.map(async folder => {
            const folderDoc = folder.toObject();
            
            // Count subfolders
            const subfolderCount = await Folder.countDocuments({
                parentId: folder._id
            });

            // Count assets in this folder
            const assetCount = await Asset.countDocuments({
                folderId: folder._id
            });

            folderDoc.itemCount = subfolderCount + assetCount;
            return folderDoc;
        }));

        return res.json(foldersWithCounts);
    } catch (error) {
        console.error('Error getting folders:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get folders',
            error: error.message
        });
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

// Add a function to build paths for a folder as array of segments
const buildFolderPaths = async (folder) => {
  // First build the full path string
  await folder.buildPath();
  
  // Split the path into segments and remove empty elements
  const segments = folder.path.split('/').filter(segment => segment.length > 0);
  
  // Store the full path segments array
  folder.paths = segments;
  
  return segments;
};

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, parentId, userId } = req.body;

    // Create a new folder
    const newFolder = new Folder({
      name,
      // If parentId is undefined, empty string, or explicitly set to null/root, set it to null
      parentId: (!parentId || parentId === '' || parentId === 'null' || parentId === 'root') ? null : parentId,
      userId
    });

    // Build the full path and then populate the paths array
    await buildFolderPaths(newFolder);
    await newFolder.save();

    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'A folder with this name already exists in this location' 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a folder by ID
exports.getFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const folder = await Folder.findById(id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        return res.json(folder);
    } catch (error) {
        console.error('Error getting folder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get folder',
            error: error.message
        });
    }
};

// Get a folder by slug
exports.getFolderBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId query parameter is required'
            });
        }

        const folder = await Folder.findBySlug(slug, userId);

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        // Get item counts
        const subfolderCount = await Folder.countDocuments({
            parentId: folder._id
        });

        const assetCount = await Asset.countDocuments({
            folderId: folder._id
        });

        const folderWithCount = folder.toObject();
        folderWithCount.itemCount = subfolderCount + assetCount;

        return res.json(folderWithCount);
    } catch (error) {
        console.error('Error getting folder by slug:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get folder',
            error: error.message
        });
    }
};

// Update a folder
exports.updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const folder = await Folder.findById(id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        folder.name = name || folder.name;
        
        // If name changed, rebuild the path
        if (name && name !== folder.name) {
            await folder.buildPath();
        }

        await folder.save();

        return res.json({
            success: true,
            data: folder
        });
    } catch (error) {
        console.error('Error updating folder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update folder',
            error: error.message
        });
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
    const { folderId, newParentId } = req.body;
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Check authorization
    if (folder.userId !== req.user.id && !folder.sharedWith.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to move this folder' });
    }
    
    // Update parentId - set to null if newParentId is empty, "null", or "root"
    folder.parentId = (!newParentId || newParentId === '' || newParentId === 'null' || newParentId === 'root') 
      ? null 
      : newParentId;
    
    // Rebuild path and paths array
    await buildFolderPaths(folder);
    await folder.save();
    
    // Update all subfolder paths
    await updateSubfolderPaths(folder._id);
    
    res.json(folder);
  } catch (error) {
    console.error('Error moving folder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to update the paths of all subfolders when a parent folder is moved
const updateSubfolderPaths = async (parentId) => {
  const subfolders = await Folder.find({ parentId });
  
  for (const subfolder of subfolders) {
    // Update paths array
    await buildFolderPaths(subfolder);
    await subfolder.save();
    
    // Recursively update subfolders
    await updateSubfolderPaths(subfolder._id);
  }
};

// Get folder path
exports.getFolderPath = async (req, res) => {
    // ...existing code...
};