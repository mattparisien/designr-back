// agent/tools/projects/createPrint.js
// Tool for creating print projects

const { requireDynamic } = require('../../../utils/dynamicImports');
const { fetchJson } = require('../../../utils/fetchJson');
const printSizes = require('../../config/printSizes');

async function createPrintTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'create_print_project',
    description: 'Create a new print project with standard print dimensions.',
    parameters: z.object({
      title: z.string().default('Untitled Print Design').describe('Title for the print project'),
      format: z.enum(Object.keys(printSizes)).describe('Print format'),
      category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
    }),
    execute: async ({ title, format, category }, ctx) => {
      try {
        // Extract userId from context - try multiple possible locations
        const userId = ctx.userId || ctx.context?.userId || ctx.user?.id || ctx.user || 'default-user';
        
        const canvasSize = printSizes[format];
        
        const projectData = {
          title,
          description: `Print-ready ${format.replace('-', ' ')} design`,
          type: 'print',
          userId: userId,
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
            format,
            canvasSize: project.canvasSize
          },
          message: `Created "${title}" ${format.replace('-', ' ')} print project successfully!`
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

module.exports = { createPrintTool };
