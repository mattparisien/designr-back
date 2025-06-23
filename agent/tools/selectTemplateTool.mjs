import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define the select template tool for the agent to use
const selectTemplateTool = tool(
  async ({ query, category, type, tags, featured, popular, canvasSize, preset, limit = 10 }) => {
    try {
      // If preset is provided, get the canvas size from it
      let requiredCanvasSize = canvasSize;
      if (preset && !requiredCanvasSize) {
        const { getPresetByKey } = await import('../../config/projectPresets.mjs');
        const [presetCategory, presetKey] = preset.split(':');
        const presetData = getPresetByKey(presetCategory, presetKey);
        if (presetData && presetData.canvasSize) {
          requiredCanvasSize = presetData.canvasSize;
        }
      }
      
      // Build the search criteria
      let searchParams = new URLSearchParams();
      
      // Always search for templates
      searchParams.append('isTemplate', 'true');
      
      // Add optional filters
      if (query) searchParams.append('search', query);
      if (category) searchParams.append('category', category);
      if (type) searchParams.append('type', type);
      if (tags && tags.length > 0) {
        tags.forEach(tag => searchParams.append('tags', tag));
      }
      if (featured !== undefined) searchParams.append('featured', featured.toString());
      if (popular !== undefined) searchParams.append('popular', popular.toString());
      
      // Add canvas size filters if specified
      if (requiredCanvasSize) {
        searchParams.append('canvasWidth', requiredCanvasSize.width.toString());
        searchParams.append('canvasHeight', requiredCanvasSize.height.toString());
      }
      
      if (limit) searchParams.append('limit', limit.toString());

      // Make request to projects endpoint with template filter
      const response = await fetch(`http://localhost:3001/api/projects?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const templates = await response.json();
      
      // Format the response for the agent
      const formattedTemplates = templates.map(template => ({
        id: template._id,
        title: template.title,
        description: template.description,
        type: template.type,
        category: template.category,
        tags: template.tags || [],
        thumbnail: template.thumbnail,
        canvasSize: template.canvasSize,
        featured: template.featured,
        popular: template.popular,
        pageCount: template.pages?.length || 0,
        author: template.author,
        createdAt: template.createdAt
      }));

      return {
        success: true,
        count: formattedTemplates.length,
        templates: formattedTemplates,
        searchCriteria: {
          query,
          category,
          type,
          tags,
          featured,
          popular,
          canvasSize: requiredCanvasSize,
          preset,
          limit
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        templates: [],
        count: 0
      };
    }
  },
  {
    name: 'selectTemplate',
    description: 'Search for and select templates based on criteria like category, type, tags, or text query. Templates are projects marked as isTemplate: true.',
    schema: z.object({
      query: z.string().optional().describe('Text search query to match template titles or descriptions'),
      category: z.string().optional().describe('Template category (e.g., "Instagram", "Facebook", "Business")'),
      type: z.enum(['presentation', 'social', 'print', 'custom']).optional().describe('Template type'),
      tags: z.array(z.string()).optional().describe('Array of tags to filter templates by'),
      featured: z.boolean().optional().describe('Filter for featured templates only'),
      popular: z.boolean().optional().describe('Filter for popular templates only'),
      canvasSize: z.object({
        name: z.string().optional(),
        width: z.number(),
        height: z.number()
      }).optional().describe('Required canvas size to match templates against'),
      preset: z.string().optional().describe('Project preset (e.g., "social:instagram-post") to determine canvas size requirements'),
      limit: z.number().optional().default(10).describe('Maximum number of templates to return (default: 10)')
    }),
  }
);

export default selectTemplateTool;