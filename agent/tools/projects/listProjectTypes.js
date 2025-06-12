// agent/tools/projects/listProjectTypes.js
// Tool for listing available project types with hierarchical support

const { requireDynamic } = require('../../../utils/dynamicImports');
const { getAvailablePlatforms, getAvailableFormats, hierarchicalPlatforms } = require('../../config/hierarchicalPlatforms');

async function listProjectTypesTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'list_project_types',
    description: 'List available project types and their supported formats/platforms in hierarchical structure.',
    parameters: z.object({
      mainType: z.enum(['social', 'presentation', 'print', 'custom']).optional().describe('Filter by main project type'),
      detailed: z.boolean().default(false).describe('Show detailed format specifications including dimensions')
    }),
    execute: async ({ mainType, detailed }) => {
      const projectTypes = {};

      if (!mainType || mainType === 'social') {
        projectTypes.social = {
          description: 'Social media posts optimized for specific platforms',
          platforms: {
            instagram: {
              description: 'Instagram content formats',
              formats: detailed ? hierarchicalPlatforms.social.instagram : Object.keys(hierarchicalPlatforms.social.instagram),
              examples: ['Product announcement', 'Story highlight', 'Reel content']
            },
            facebook: {
              description: 'Facebook content formats',
              formats: detailed ? hierarchicalPlatforms.social.facebook : Object.keys(hierarchicalPlatforms.social.facebook),
              examples: ['Event promotion', 'Page cover', 'Story content']
            },
            twitter: {
              description: 'Twitter/X content formats',
              formats: detailed ? hierarchicalPlatforms.social.twitter : Object.keys(hierarchicalPlatforms.social.twitter),
              examples: ['Tweet image', 'Profile header']
            },
            linkedin: {
              description: 'LinkedIn professional content',
              formats: detailed ? hierarchicalPlatforms.social.linkedin : Object.keys(hierarchicalPlatforms.social.linkedin),
              examples: ['Professional post', 'Company banner']
            },
            youtube: {
              description: 'YouTube video content',
              formats: detailed ? hierarchicalPlatforms.social.youtube : Object.keys(hierarchicalPlatforms.social.youtube),
              examples: ['Video thumbnail', 'Channel banner']
            },
            tiktok: {
              description: 'TikTok short-form content',
              formats: detailed ? hierarchicalPlatforms.social.tiktok : Object.keys(hierarchicalPlatforms.social.tiktok),
              examples: ['Vertical video content']
            }
          },
          usage: 'Use create_social_media_project with platform and format (e.g., platform: "instagram", format: "post")'
        };
      }

      if (!mainType || mainType === 'presentation') {
        projectTypes.presentation = {
          description: 'Slideshow presentations for business, education, or personal use',
          formats: detailed ? hierarchicalPlatforms.presentation : Object.keys(hierarchicalPlatforms.presentation),
          examples: ['Business pitch deck', 'School presentation', 'Portfolio showcase'],
          usage: 'Use create_presentation with format (e.g., format: "widescreen")'
        };
      }

      if (!mainType || mainType === 'print') {
        projectTypes.print = {
          description: 'Print-ready designs for physical media',
          categories: {
            document: {
              description: 'Standard document formats',
              formats: detailed ? hierarchicalPlatforms.print.document : Object.keys(hierarchicalPlatforms.print.document),
              examples: ['Reports', 'Letters', 'Forms']
            },
            marketing: {
              description: 'Marketing and promotional materials',
              formats: detailed ? hierarchicalPlatforms.print.marketing : Object.keys(hierarchicalPlatforms.print.marketing),
              examples: ['Event posters', 'Product flyers', 'Trade show banners']
            },
            stationery: {
              description: 'Business stationery and cards',
              formats: detailed ? hierarchicalPlatforms.print.stationery : Object.keys(hierarchicalPlatforms.print.stationery),
              examples: ['Business cards', 'Letterheads', 'Envelopes']
            }
          },
          usage: 'Use create_print_project with category and format (e.g., category: "document", format: "a4")'
        };
      }

      if (!mainType || mainType === 'custom') {
        projectTypes.custom = {
          description: 'Custom projects with user-defined dimensions',
          formats: ['custom', 'template'],
          examples: ['Custom artwork', 'Unique dimensions', 'Template-based designs'],
          usage: 'Use create_custom_project with custom width and height'
        };
      }

      return JSON.stringify({
        success: true,
        projectTypes,
        hierarchicalSupport: true,
        legacyCompatibility: 'Supports both new hierarchical format (platform + format) and legacy platform keys (instagram-post, etc.)',
        message: detailed ? 'Detailed project types with dimensions' : 'Available project types and formats'
      });
    },
  });
}

module.exports = { listProjectTypesTool };
