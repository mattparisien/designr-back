// agent/tools/projects/listProjectTypes.js
// Tool for listing available project types and formats

const { requireDynamic } = require('../../../utils/dynamicImports');

async function listProjectTypesTool() {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'list_project_types',
    description: 'List available project types and their supported formats/platforms.',
    parameters: z.object({}),
    execute: async () => {
      const projectTypes = {
        presentation: {
          description: 'Slideshow presentations for business, education, or personal use',
          formats: ['16:9 (recommended)', '4:3 (classic)'],
          examples: ['Business pitch deck', 'School presentation', 'Portfolio showcase']
        },
        social_media: {
          description: 'Social media posts optimized for specific platforms',
          platforms: ['Instagram Post (1:1)', 'Instagram Story (9:16)', 'Facebook Post', 'Twitter Post', 'LinkedIn Post', 'YouTube Thumbnail', 'TikTok Video'],
          examples: ['Product announcement', 'Event promotion', 'Brand awareness post']
        },
        print: {
          description: 'Print-ready designs for physical media',
          formats: ['A4', 'A5', 'US Letter', 'US Legal', 'Poster', 'Business Card', 'Flyer'],
          examples: ['Business card', 'Event flyer', 'Poster design', 'Brochure']
        },
        custom: {
          description: 'Custom dimensions for specialized use cases',
          note: 'Specify exact width and height in pixels (100-8000px)',
          examples: ['Web banner', 'Email header', 'Digital display', 'Custom artwork']
        }
      };

      return JSON.stringify({
        available_project_types: projectTypes,
        usage: {
          create_presentation: 'For slideshow presentations',
          create_social_media_project: 'For social media content',
          create_print_project: 'For physical print materials',
          create_custom_project: 'For custom dimensions'
        }
      });
    },
  });
}

module.exports = { listProjectTypesTool };
