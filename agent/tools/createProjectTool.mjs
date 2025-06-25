import { tool } from '@langchain/core/tools';
import { getPresetByKey } from '../../config/projectPresets.mjs';
import { z } from 'zod';

// Define element schema matching Element.ts discriminated union
const ElementSchema = z.object({
    id: z.string(),
    kind: z.enum(['text', 'image', 'shape']), // discriminator field
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number().optional().default(0),
    opacity: z.number().optional().default(1),
    zIndex: z.number().optional().default(0),
    // Text-specific properties (optional)
    content: z.string().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    color: z.string().optional(),
    // Image-specific properties (optional)
    src: z.string().optional(),
    alt: z.string().optional(),
    // Shape-specific properties (optional)
    shapeType: z.enum(['rect', 'circle', 'triangle']).optional(),
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
    borderWidth: z.number().optional(),
});

// Define page schema matching Page.ts PageSchema
const PageSchema = z.object({
    name: z.string().optional(),
    canvas: z.object({
        width: z.number(),
        height: z.number()
    }),
    background: z.object({
        type: z.enum(['color', 'image', 'gradient']).default('color'),
        value: z.string().optional()
    }).optional(),
    elements: z.array(ElementSchema).optional().default([])
});

// Define layout schema matching Page.ts LayoutSchema
const LayoutSchema = z.object({
    pages: z.array(PageSchema)
});

// Define project schema matching Project.ts (API input format)
const CreateProjectSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    type: z.enum(['presentation', 'social', 'print', 'custom']).default('custom'),
    thumbnail: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    ownerId: z.string().optional(), // Will be converted to ObjectId on backend
    starred: z.boolean().optional().default(false),
    sharedWith: z.array(z.string()).optional().default([]), // Will be converted to ObjectId[] on backend
    sourceTemplateId: z.string().optional(), // Will be converted to ObjectId on backend
    // Layout data - this matches what the backend expects in the API
    layout: LayoutSchema
});

// Define the create project tool for the agent to use
const createProjectTool = tool(
    async ({ 
        project, 
        preset, 
        brandColors,
        headers = {} 
    }) => {
        try {
            let projectData = { ...project };

            // If preset is provided, merge it with project data
            if (preset) {
                const [category, key] = preset.split(':');
                const presetData = getPresetByKey(category, key);

                if (presetData) {
                    // Apply preset canvas size to all pages if not specified
                    if (presetData.canvasSize && projectData.layout.pages) {
                        projectData.layout.pages = projectData.layout.pages.map(page => ({
                            ...page,
                            canvas: {
                                width: presetData.canvasSize.width,
                                height: presetData.canvasSize.height
                            }
                        }));
                    }

                    // Merge preset data with project data
                    projectData = {
                        ...projectData,
                        title: project.title || presetData.name,
                        type: project.type || presetData.type || 'custom',
                        tags: [...(presetData.tags || []), ...(project.tags || [])]
                    };
                }
            }

            // Apply brand colors if provided
            if (brandColors) {
                projectData = applyBrandColors(projectData, brandColors);
            }

            // Ensure at least one page exists with default values
            if (!projectData.layout.pages || projectData.layout.pages.length === 0) {
                projectData.layout.pages = [{
                    name: 'Page 1',
                    canvas: { width: 800, height: 600 },
                    background: { type: 'color', value: '#ffffff' },
                    elements: []
                }];
            }

            console.log('Creating project with data:', JSON.stringify(projectData, null, 2));

            const response = await fetch('http://localhost:3001/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(projectData)
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('Project creation failed:', responseData);
                return {
                    success: false,
                    error: responseData.message || responseData.error || 'Unknown error',
                    status: response.status,
                    data: responseData
                };
            }

            console.log('Project created successfully:', responseData);

            return {
                status: response.status,
                statusText: response.statusText,
                data: responseData,
                success: true
            };
        } catch (error) {
            console.error('Error creating project:', error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred',
                status: null,
                data: null
            };
        }
    },
    {
        name: 'createProject',
        description: 'Create a new project by sending project data to the projects endpoint. The project must include a layout with pages containing design elements. Can use presets like "social:instagram-post" for predefined canvas sizes and settings.',
        schema: z.object({
            project: CreateProjectSchema.describe('The project data that matches the Project model: title (required), layout with pages containing elements, and optional fields like description, type, tags, etc.'),
            preset: z.string().optional().describe('Optional preset in format "category:key" like "social:instagram-post" to automatically set canvas size and other properties'),
            brandColors: z.object({
                primary: z.string(),
                secondary: z.array(z.string()).optional(),
                accent: z.array(z.string()).optional()
            }).optional().describe('Brand colors to apply to the project elements. Primary color for main text/backgrounds, secondary and accent for variations.'),
            headers: z.object({}).passthrough().optional().describe('Optional headers to include in the request')
        }),
    }
);

/**
 * Apply brand colors to project elements
 */
function applyBrandColors(projectData, brandColors) {
    if (!projectData.layout || !projectData.layout.pages) {
        return projectData;
    }

    const { primary, secondary = [], accent = [] } = brandColors;
    
    // Create a color palette from brand colors
    const colorPalette = [primary, ...secondary, ...accent].filter(Boolean);
    
    projectData.layout.pages = projectData.layout.pages.map(page => {
        // Apply brand colors to page background if not explicitly set
        if (!page.background || !page.background.value || page.background.value === '#ffffff') {
            page.background = {
                type: 'color',
                value: getContrastBackgroundColor(primary)
            };
        }

        // Apply brand colors to elements
        if (page.elements) {
            page.elements = page.elements.map((element, index) => {
                // Apply colors to text elements
                if (element.kind === 'text') {
                    if (!element.color) {
                        // Use primary color for main text, secondary colors for variation
                        element.color = getTextColor(primary, secondary, accent, index);
                    }
                }
                
                // Apply colors to shape elements
                if (element.kind === 'shape') {
                    if (!element.backgroundColor) {
                        element.backgroundColor = getShapeColor(colorPalette, index);
                    }
                    if (!element.borderColor && colorPalette.length > 1) {
                        element.borderColor = colorPalette[1] || primary;
                    }
                }
                
                return element;
            });
        }

        return page;
    });

    return projectData;
}

/**
 * Get appropriate text color based on brand colors and element index
 */
function getTextColor(primary, secondary, accent, index) {
    const colors = [primary, ...secondary, ...accent].filter(Boolean);
    
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return primary;
    
    // Cycle through colors for variety
    return colors[index % colors.length];
}

/**
 * Get appropriate shape color based on brand color palette and element index
 */
function getShapeColor(colorPalette, index) {
    if (colorPalette.length === 0) return '#cccccc';
    if (colorPalette.length === 1) return addOpacity(colorPalette[0], 0.3);
    
    // Use different colors for variety, with reduced opacity
    return addOpacity(colorPalette[index % colorPalette.length], 0.5);
}

/**
 * Get contrasting background color (light if primary is dark, dark if primary is light)
 */
function getContrastBackgroundColor(primaryColor) {
    // Simple contrast check - in production you might want a more sophisticated algorithm
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // If primary color is dark, use light background, and vice versa
    return brightness < 128 ? '#ffffff' : '#f8f9fa';
}

/**
 * Add opacity to a hex color
 */
function addOpacity(hexColor, opacity) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return hexColor + alpha;
}

export default createProjectTool;