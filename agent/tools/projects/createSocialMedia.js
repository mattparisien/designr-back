// agent/tools/projects/createSocialMedia.js
// Tool for creating social media projects

const { requireDynamic } = require('../../../utils/dynamicImports');
const { fetchJson } = require('../../../utils/fetchJson');
const platformSizes = require('../../config/platformSizes');

async function createSocialMediaTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'create_social_media_project',
    description: 'Create a new social media project with platform-specific dimensions.',
    parameters: z.object({
      title: z.string().default('Untitled Social Post').describe('Title for the social media project'),
      platform: z.enum(Object.keys(platformSizes)).describe('Target social media platform'),
      category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
    }),
    execute: async ({ title, platform, category }, ctx) => {
      try {
        console.log('🔍 Social Media Tool Context:', ctx);
        console.log('🔍 UserId from context:', ctx.userId);
        
        const canvasSize = platformSizes[platform];
        
        const projectData = {
          title,
          description: `Optimized for ${platform.replace('-', ' ')}`,
          type: 'social',
          userId: ctx.userId,
          category,
          canvasSize
        };

        console.log('🔍 Project data being sent:', projectData);

        const project = await fetchJson('/api/projects', {
          method: 'POST',
          body: projectData
        });

        return JSON.stringify({
          success: true,
          project: {
            id: project._id,
            title: project.title,
            type: project.type,
            category: project.category,
            platform,
            canvasSize: project.canvasSize
          },
          message: `Created "${title}" for ${platform.replace('-', ' ')} successfully!`
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.message
        });
      }
    },
  });
}

module.exports = { createSocialMediaTool };
