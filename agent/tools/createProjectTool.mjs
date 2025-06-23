import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define element schema
const ElementSchema = z.object({
  id: z.string(),
  type: z.string(), // text, image, shape, etc.
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  // Text-specific properties (optional)
  content: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.string().optional(),
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
  isUnderlined: z.boolean().optional(),
  color: z.string().optional(),
  // Image-specific properties (optional)
  src: z.string().optional(),
  alt: z.string().optional(),
  // Shape-specific properties (optional)
  shapeType: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  // Common style properties (optional)
  opacity: z.number().optional(),
  rotation: z.number().optional(),
  zIndex: z.number().optional(),
});

// Define page schema
const PageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  canvasSize: z.object({
    name: z.string().optional(),
    width: z.number(),
    height: z.number()
  }),
  thumbnail: z.string().optional(),
  elements: z.array(ElementSchema).optional().default([]),
  background: z.object({
    type: z.enum(['color', 'image', 'gradient']).default('color'),
    value: z.string().default('#ffffff')
  }).optional()
});

// Define project schema
const ProjectSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['presentation', 'social', 'print', 'custom']).default('custom'),
  thumbnail: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  starred: z.boolean().default(false),
  shared: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
  sharedWith: z.array(z.string()).optional().default([]),
  pages: z.array(PageSchema).optional().default([]),
  canvasSize: z.object({
    name: z.string().optional(),
    width: z.number(),
    height: z.number()
  }),
  metadata: z.record(z.any()).optional()
});

// Define the create project tool for the agent to use
const createProjectTool = tool(
  async ({ project, headers = {} }) => {
    try {
      console.log('project created!');
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(project)
      });

      const responseData = await response.json();
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        success: response.ok
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: null,
        data: null
      };
    }
  },
  {
    name: 'createProject',
    description: 'Create a new project by sending project data to the projects endpoint',
    schema: z.object({
      project: ProjectSchema.describe('The project data with title, canvas size, pages, and other properties'),
      headers: z.object({}).passthrough().optional().describe('Optional headers to include in the request')
    }),
  }
);

export default createProjectTool;