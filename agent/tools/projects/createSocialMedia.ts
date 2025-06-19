// agent/tools/projects/createSocialMedia.ts
// Tool for creating social media projects with hierarchical type support

import { requireDynamic } from '../../../utils/dynamicImports';
import { fetchJson } from '../../../utils/fetchJson';
import platformSizes from '../../config/platformSizes';
import { getHierarchicalDimensions, getAvailablePlatforms, getAvailableFormats } from '../../config/hierarchicalPlatforms';

export async function createSocialMediaTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'create_social_media_project',
    description: 'Create a new social media project with platform-specific dimensions. Supports hierarchical platform.format specification (e.g., instagram.post, facebook.story) or legacy platform keys.',
    parameters: z.object({
      title: z.string().default('Untitled Social Post').describe('Title for the social media project'),
      platform: z.string().describe('Target social media platform (instagram, facebook, twitter, linkedin, youtube, tiktok) or legacy format (instagram-post, facebook-post, etc.)'),
      format: z.string().nullable().default(null).describe('Specific format for the platform (post, story, reel, etc.). Can be null if using legacy platform format.'),
      category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
    }),
    execute: async ({ title, platform, format, category }, ctx) => {
      try {
        // Extract userId from context - try multiple possible locations
        const userId = ctx.userId || ctx.context?.userId || ctx.user?.id || ctx.user || 'default-user';
        
        let canvasSize;
        let platformDescription;
        let designSpec;

        // Check if it's a hierarchical format (platform + format)
        if (format) {
          // New hierarchical format: platform + format
          canvasSize = getHierarchicalDimensions('social', platform, format);
          platformDescription = `Optimized for ${platform} ${format}`;
          designSpec = {
            mainType: 'social',
            platform: platform,
            format: format,
            dimensions: {
              width: canvasSize.width,
              height: canvasSize.height,
              aspectRatio: canvasSize.aspectRatio || '16:9'
            }
          };
        } else if (platformSizes[platform]) {
          // Legacy format support
          canvasSize = platformSizes[platform];
          platformDescription = `Optimized for ${platform.replace('-', ' ')}`;
          
          // Try to convert legacy to hierarchical
          const parts = platform.split('-');
          designSpec = {
            mainType: 'social',
            platform: parts[0] || platform,
            format: parts.slice(1).join('-') || 'post',
            dimensions: {
              width: canvasSize.width,
              height: canvasSize.height,
              aspectRatio: canvasSize.aspectRatio || '16:9'
            }
          };
        } else {
          throw new Error(`Unsupported platform: ${platform}. Available platforms: ${getAvailablePlatforms('social').join(', ')}`);
        }

        const projectData = {
          title,
          description: platformDescription,
          type: 'social',
          userId: userId,
          category,
          canvasSize,
          // Add hierarchical design specification
          designSpec,
          mainType: 'social',
          platform: designSpec.platform,
          format: designSpec.format
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
            platform: designSpec.platform,
            format: designSpec.format,
            canvasSize: project.canvasSize,
            designSpec: project.designSpec
          },
          message: `Created "${title}" for ${designSpec.platform} ${designSpec.format} successfully!`
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

