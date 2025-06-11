// agent/tools/projects/createPresentation.js
// Tool for creating presentation projects

const { requireDynamic } = require('../../../utils/dynamicImports');
const { fetchJson } = require('../../../utils/fetchJson');

async function createPresentationTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'create_presentation',
    description: 'Create a new presentation project with default settings.',
    parameters: z.object({
      title: z.string().default('Untitled Presentation').describe('Title for the presentation'),
      category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Presentation category'),
      aspectRatio: z.enum(['16:9', '4:3']).default('16:9').describe('Presentation aspect ratio'),
    }),
    execute: async ({ title, category, aspectRatio }, ctx) => {
      try {
        const canvasSize = aspectRatio === '4:3' 
          ? { name: "Presentation 4:3", width: 1024, height: 768 }
          : { name: "Presentation 16:9", width: 1920, height: 1080 };
        
        const projectData = {
          title,
          description: '',
          type: 'presentation',
          userId: ctx.userId,
          category,
          canvasSize
        };

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
            canvasSize: project.canvasSize
          },
          message: `Created "${title}" presentation project successfully!`
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

module.exports = { createPresentationTool };
