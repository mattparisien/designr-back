import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define the clone template tool for the agent to use
const cloneTemplateTool = tool(
  async ({ templateId, customizations, newTitle, headers = {} }) => {
    try {
      // First, fetch the template
      const templateResponse = await fetch(`http://localhost:3001/api/projects/${templateId}`);
      
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.status}`);
      }
      
      const template = await templateResponse.json();
      
      // Clone the template and apply customizations
      let clonedProject = {
        ...template,
        title: newTitle || `${template.title} - Copy`,
        isTemplate: false, // New project is not a template
        starred: false,
        shared: false,
        sharedWith: [],
        // Remove template-specific fields
        featured: undefined,
        popular: undefined,
        author: undefined, // Will be set by the API based on authenticated user
        // Deep clone pages to avoid reference issues
        pages: template.pages ? JSON.parse(JSON.stringify(template.pages)) : []
      };
      
      // Apply customizations if provided
      if (customizations) {
        // Apply text content customizations
        if (customizations.textReplacements) {
          clonedProject.pages = clonedProject.pages.map(page => ({
            ...page,
            elements: page.elements.map(element => {
              if (element.type === 'text' && element.content) {
                let newContent = element.content;
                customizations.textReplacements.forEach(replacement => {
                  newContent = newContent.replace(
                    new RegExp(replacement.find, 'gi'), 
                    replacement.replace
                  );
                });
                return { ...element, content: newContent };
              }
              return element;
            })
          }));
        }
        
        // Apply color customizations
        if (customizations.colorReplacements) {
          clonedProject.pages = clonedProject.pages.map(page => ({
            ...page,
            elements: page.elements.map(element => {
              let updatedElement = { ...element };
              customizations.colorReplacements.forEach(colorReplacement => {
                if (element.color === colorReplacement.from) {
                  updatedElement.color = colorReplacement.to;
                }
                if (element.backgroundColor === colorReplacement.from) {
                  updatedElement.backgroundColor = colorReplacement.to;
                }
              });
              return updatedElement;
            })
          }));
        }
        
        // Apply background customizations
        if (customizations.backgroundColor) {
          clonedProject.pages = clonedProject.pages.map(page => ({
            ...page,
            background: {
              type: 'color',
              value: customizations.backgroundColor
            }
          }));
        }
        
        // Update title and description
        if (customizations.title) clonedProject.title = customizations.title;
        if (customizations.description) clonedProject.description = customizations.description;
        if (customizations.category) clonedProject.category = customizations.category;
        if (customizations.tags) clonedProject.tags = customizations.tags;
      }
      
      // Remove MongoDB _id and timestamps to create new project
      delete clonedProject._id;
      delete clonedProject.createdAt;
      delete clonedProject.updatedAt;
      delete clonedProject.__v;
      
      // Create the new project
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(clonedProject)
      });
      
      const responseData = await response.json();
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        success: response.ok,
        templateId,
        customizationsApplied: !!customizations
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: null,
        data: null,
        templateId
      };
    }
  },
  {
    name: 'cloneTemplate',
    description: 'Clone a template and create a new project with optional customizations like text replacements, color changes, and content updates.',
    schema: z.object({
      templateId: z.string().describe('The ID of the template to clone'),
      customizations: z.object({
        title: z.string().optional().describe('New title for the project'),
        description: z.string().optional().describe('New description for the project'),
        category: z.string().optional().describe('New category for the project'),
        tags: z.array(z.string()).optional().describe('New tags for the project'),
        textReplacements: z.array(z.object({
          find: z.string().describe('Text to find (supports regex)'),
          replace: z.string().describe('Text to replace with')
        })).optional().describe('Array of text replacements to apply to all text elements'),
        colorReplacements: z.array(z.object({
          from: z.string().describe('Color to replace (hex code)'),
          to: z.string().describe('New color (hex code)')
        })).optional().describe('Array of color replacements'),
        backgroundColor: z.string().optional().describe('New background color for all pages (hex code)')
      }).optional().describe('Customizations to apply to the cloned template'),
      newTitle: z.string().optional().describe('Title for the new project (fallback if not in customizations)'),
      headers: z.object({}).passthrough().optional().describe('Optional headers to include in the request')
    }),
  }
);

export default cloneTemplateTool;
