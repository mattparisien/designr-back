// agentTools.js - Tool implementations for the AgentService

const { createProject } = require('../utils/projectApiClient');

/**
 * Tool for creating projects via the API
 * @param {Object} args - The tool arguments
 * @param {string} args.title - Project title
 * @param {string} args.userId - User ID
 * @param {Object} args.canvasSize - Canvas dimensions
 * @param {string} args.description - Optional description
 * @param {string} args.type - Optional project type
 * @param {string} args.category - Optional category
 * @param {Array} args.tags - Optional tags
 * @param {boolean} args.isTemplate - Whether it's a template
 * @returns {Promise<Object>} - The created project data
 */
async function createProjectTool(args) {
  try {
    // Validate required arguments
    if (!args.title) {
      throw new Error('Project title is required');
    }
    
    if (!args.userId) {
      throw new Error('User ID is required');
    }
    
    if (!args.canvasSize || !args.canvasSize.width || !args.canvasSize.height) {
      throw new Error('Canvas size with width and height is required');
    }
    
    // Prepare project data
    const projectData = {
      title: args.title,
      description: args.description || '',
      type: args.type || 'custom',
      userId: args.userId,
      category: args.category || '',
      tags: args.tags || [],
      isTemplate: args.isTemplate || false,
      canvasSize: {
        name: args.canvasSize.name || 'Custom',
        width: args.canvasSize.width,
        height: args.canvasSize.height
      }
    };
    
    // Create the project via API
    const result = await createProject(projectData);
    
    return {
      success: true,
      projectId: result._id,
      title: result.title,
      type: result.type,
      userId: result.userId,
      canvasSize: result.canvasSize,
      createdAt: result.createdAt,
      message: `Project "${result.title}" created successfully`
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Failed to create project: ${error.message}`
    };
  }
}

/**
 * Common canvas size presets
 */
const CANVAS_PRESETS = {
  'Instagram Post': { width: 1080, height: 1080 },
  'Instagram Story': { width: 1080, height: 1920 },
  'Facebook Post': { width: 1200, height: 630 },
  'Twitter Post': { width: 1200, height: 675 },
  'LinkedIn Post': { width: 1200, height: 627 },
  'YouTube Thumbnail': { width: 1280, height: 720 },
  'Presentation (16:9)': { width: 1920, height: 1080 },
  'Presentation (4:3)': { width: 1024, height: 768 },
  'A4 Portrait': { width: 595, height: 842 },
  'A4 Landscape': { width: 842, height: 595 },
  'Letter Portrait': { width: 612, height: 792 },
  'Letter Landscape': { width: 792, height: 612 },
  'Business Card': { width: 350, height: 200 },
  'Flyer': { width: 612, height: 792 },
  'Poster': { width: 1275, height: 1650 }
};

/**
 * Helper function to get canvas size from preset name
 * @param {string} presetName - The preset name
 * @returns {Object|null} - Canvas size object or null if not found
 */
function getCanvasPreset(presetName) {
  return CANVAS_PRESETS[presetName] || null;
}

/**
 * Helper function to suggest canvas size based on project type
 * @param {string} projectType - The project type
 * @returns {Object} - Suggested canvas size
 */
function suggestCanvasSize(projectType) {
  const suggestions = {
    'presentation': CANVAS_PRESETS['Presentation (16:9)'],
    'flyer': CANVAS_PRESETS['Flyer'],
    'poster': CANVAS_PRESETS['Poster'],
    'social-media': CANVAS_PRESETS['Instagram Post'],
    'custom': { width: 800, height: 600 }
  };
  
  return suggestions[projectType] || suggestions['custom'];
}

module.exports = {
  createProjectTool,
  getCanvasPreset,
  suggestCanvasSize,
  CANVAS_PRESETS
};
