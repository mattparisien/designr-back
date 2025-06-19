// agent/tools/projects/createCustom.ts
// Tool for creating custom dimension projects

import { requireDynamic } from '../../../utils/dynamicImports';
import { fetchJson } from '../../../utils/fetchJson';

export async function createCustomProjectTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'create_custom_project',
    description: 'Create a new custom project with specified dimensions.',
    parameters: z.object({
      title: z.string().default('Untitled Custom Design').describe('Title for the custom project'),
      width: z.number().int().min(100).max(8000).describe('Canvas width in pixels'),
      height: z.number().int().min(100).max(8000).describe('Canvas height in pixels'),
      category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
    }),
    execute: async ({ title, width, height, category }, ctx) => {
      try {
        // Extract userId from context - try multiple possible locations
        const userId = ctx.userId || ctx.context?.userId || ctx.user?.id || ctx.user || 'default-user';
        
        const canvasSize = {
          name: `Custom ${width}x${height}`,
          width,
          height
        };
        
        const projectData = {
          title,
          description: `Custom dimensions: ${width}x${height}px`,
          type: 'custom',
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
            dimensions: `${width}x${height}`,
            canvasSize: project.canvasSize
          },
          message: `Created "${title}" custom project (${width}x${height}px) successfully!`
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

