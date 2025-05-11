const Folder = require('../models/Folder');
const Asset = require('../models/Asset');

// Utility function to ensure root folder exists for a user
exports.ensureRootFolder = async (userId) => {
  try {
    // Check if root folder exists
    let rootFolder = await Folder.findOne({ 
      userId, 
      name: 'Root', 
      parentId: null 
    });
    
    if (rootFolder) {
      // Update existing root folder if needed
      if (!rootFolder.path || rootFolder.path !== '/root') {
        rootFolder.path = '/root';
        if (!rootFolder.slug) {
          rootFolder.slug = 'root';
        }
        await rootFolder.save();
        console.log(`Updated root folder for user ${userId}`);
      }
      return rootFolder;
    } else {
      // Create root folder if it doesn't exist
      const newRootFolder = new Folder({
        name: 'Root',
        slug: 'root',
        userId,
        parentId: null,
        path: '/root',
        isShared: false
      });
      
      await newRootFolder.save();
      console.log(`Created root folder for user ${userId}`);
      return newRootFolder;
    }
  } catch (error) {
    console.error('Error ensuring root folder exists:', error);
    throw error;
  }
};

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

        // Ensure root folder exists for this user
        await exports.ensureRootFolder(userId);
        
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

// Create a new folder
exports.createFolder = async (req, res) => {
    try {
        const { name, parentId, userId } = req.body;

        if (!name || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Name and userId are required'
            });
        }

        // Ensure root folder exists
        await exports.ensureRootFolder(userId);

        // Create the folder
        const folder = new Folder({
            name,
            userId,
            parentId: parentId || null
        });

        // Generate the path
        await folder.buildPath();

        // Save the folder
        await folder.save();

        return res.status(201).json({
            success: true,
            data: folder
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        
        // Handle duplicate folder name error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A folder with this name already exists in this location'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create folder',
            error: error.message
        });
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

        // If the slug is 'root', ensure the root folder exists
        if (slug === 'root') {
            await exports.ensureRootFolder(userId);
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
    const { id } = req.params;
    const { newParentId } = req.body;
    
    // Find the folder to move
    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Check if a folder with the same name already exists at the destination
    const existingFolder = await Folder.findOne({
      _id: { $ne: id }, // Exclude the current folder
      name: { $regex: new RegExp(`^${folder.name}$`, 'i') }, // Case insensitive match
      userId: folder.userId,
      parentId: newParentId || null
    });

    if (existingFolder) {
      return res.status(400).json({ 
        message: 'A folder with this name already exists at the destination' 
      });
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

// Get folder path
exports.getFolderPath = async (req, res) => {
    // ...existing code...
};