import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const createBrandedProjectTool = tool(
    async ({ 
        projectRequest,
        userId,
        brandId,
        headers = {} 
    }) => {
        try {
            // Step 1: Fetch user's branding with timeout
            console.log('Fetching user branding...');
            
            let brandUrl = 'http://localhost:3001/api/brands';
            if (brandId) {
                brandUrl += `/${brandId}`;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const brandResponse = await fetch(brandUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-ID': userId || '6825167ffe3452cafe0c8440',
                    ...headers
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let brandData = null;
            let brandColors = null;
            let brandFonts = null;

            if (brandResponse.ok) {
                const brandResult = await brandResponse.json();
                
                if (brandId) {
                    brandData = brandResult.data;
                } else {
                    const brands = brandResult.data;
                    if (brands && brands.length > 0) {
                        brandData = brands.find(brand => brand.isActive) || brands[0];
                    }
                }

                if (brandData) {
                    // Extract brand colors
                    if (brandData.colorPalettes && brandData.colorPalettes.length > 0) {
                        const defaultPalette = brandData.colorPalettes.find(p => p.isDefault) 
                                              || brandData.colorPalettes[0];
                        brandColors = {
                            primary: defaultPalette.primary,
                            secondary: defaultPalette.secondary || [],
                            accent: defaultPalette.accent || []
                        };
                    }

                    // Extract brand fonts
                    if (brandData.typography) {
                        brandFonts = {
                            heading: brandData.typography.headingFont,
                            body: brandData.typography.bodyFont
                        };
                    }

                    console.log('Brand colors extracted:', brandColors);
                    console.log('Brand fonts extracted:', brandFonts);
                }
            } else {
                console.log('No branding found, proceeding with default styling');
            }

            // Step 2: Apply branding to project data
            let projectData = { ...projectRequest };

            // Apply brand colors to elements if branding was found
            if (brandColors) {
                projectData = applyBrandStyling(projectData, brandColors, brandFonts);
            }

            // Ensure at least one page exists with default values
            if (!projectData.layout.pages || projectData.layout.pages.length === 0) {
                const backgroundColor = brandColors ? getContrastBackgroundColor(brandColors.primary) : '#ffffff';
                projectData.layout.pages = [{
                    name: 'Page 1',
                    canvas: { width: 800, height: 600 },
                    background: { type: 'color', value: backgroundColor },
                    elements: []
                }];
            }

            // Step 3: Create the project
            console.log('Creating branded project...');
            
            const projectResponse = await fetch('http://localhost:3001/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(projectData)
            });

            const projectResult = await projectResponse.json();

            if (!projectResponse.ok) {
                console.error('Project creation failed:', projectResult);
                return {
                    success: false,
                    error: projectResult.message || projectResult.error || 'Project creation failed',
                    status: projectResponse.status,
                    data: projectResult
                };
            }

            // Step 4: Return success with branding info
            return {
                success: true,
                status: projectResponse.status,
                data: {
                    project: projectResult,
                    brandingApplied: !!brandData,
                    brandInfo: brandData ? {
                        brandId: brandData._id,
                        brandName: brandData.name,
                        colorsUsed: brandColors,
                        fontsUsed: brandFonts
                    } : null
                }
            };

            } catch (error) {
                clearTimeout(timeoutId);
                console.error('Error creating branded project:', error);
                
                // Return more specific error information
                let errorMessage = 'Unknown error occurred';
                let shouldRetry = false;
                
                if (error.name === 'AbortError') {
                    errorMessage = 'Request timeout - please try again';
                    shouldRetry = true;
                } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
                    errorMessage = 'Rate limit exceeded - please wait a moment and try again';
                    shouldRetry = true;
                } else if (error.message?.includes('fetch')) {
                    errorMessage = 'Network error - please check your connection';
                    shouldRetry = true;
                } else {
                    errorMessage = error.message;
                }
                
                return {
                    success: false,
                    error: errorMessage,
                    shouldRetry,
                    status: null,
                    data: null
                };
            }
    },
    {
        name: 'createBrandedProject',
        description: 'Create a new project with automatic brand styling applied. This tool fetches the user\'s branding (colors, fonts, etc.) and applies it to the project elements to ensure brand consistency.',
        schema: z.object({
            projectRequest: z.object({
                title: z.string().min(1, 'Title is required'),
                description: z.string().optional(),
                type: z.enum(['presentation', 'social', 'print', 'custom']).default('custom'),
                tags: z.array(z.string()).optional().default([]),
                layout: z.object({
                    pages: z.array(z.object({
                        name: z.string().optional(),
                        canvas: z.object({
                            width: z.number(),
                            height: z.number()
                        }),
                        background: z.object({
                            type: z.enum(['color', 'image', 'gradient']).default('color'),
                            value: z.string().optional()
                        }).optional(),
                        elements: z.array(z.object({
                            id: z.string(),
                            kind: z.enum(['text', 'image', 'shape']),
                            x: z.number(),
                            y: z.number(),
                            width: z.number(),
                            height: z.number(),
                            rotation: z.number().optional().default(0),
                            opacity: z.number().optional().default(1),
                            zIndex: z.number().optional().default(0),
                            content: z.string().optional(),
                            fontSize: z.number().optional(),
                            fontFamily: z.string().optional(),
                            textAlign: z.enum(['left', 'center', 'right']).optional(),
                            bold: z.boolean().optional(),
                            italic: z.boolean().optional(),
                            underline: z.boolean().optional(),
                            color: z.string().optional(),
                            src: z.string().optional(),
                            alt: z.string().optional(),
                            shapeType: z.enum(['rect', 'circle', 'triangle']).optional(),
                            backgroundColor: z.string().optional(),
                            borderColor: z.string().optional(),
                            borderWidth: z.number().optional(),
                        })).optional().default([])
                    }))
                })
            }).describe('The project data to create'),
            userId: z.string().optional().describe('The user ID to fetch branding for. Uses default test user if not provided.'),
            brandId: z.string().optional().describe('Optional specific brand ID to use. If not provided, uses the active brand or first available brand.'),
            headers: z.object({}).passthrough().optional().describe('Optional headers to include in the requests')
        }),
    }
);

/**
 * Apply brand styling to project data
 */
function applyBrandStyling(projectData, brandColors, brandFonts) {
    if (!projectData.layout || !projectData.layout.pages) {
        return projectData;
    }

    const { primary, secondary = [], accent = [] } = brandColors;
    const colorPalette = [primary, ...secondary, ...accent].filter(Boolean);
    
    projectData.layout.pages = projectData.layout.pages.map(page => {
        // Apply brand colors to page background if not explicitly set
        if (!page.background || !page.background.value || page.background.value === '#ffffff') {
            page.background = {
                type: 'color',
                value: getContrastBackgroundColor(primary)
            };
        }

        // Apply brand styling to elements
        if (page.elements) {
            page.elements = page.elements.map((element, index) => {
                // Apply styling to text elements
                if (element.kind === 'text') {
                    if (!element.color) {
                        element.color = getTextColor(primary, secondary, accent, index);
                    }
                    if (!element.fontFamily && brandFonts) {
                        // Use heading font for larger text, body font for smaller text
                        element.fontFamily = (element.fontSize && element.fontSize > 18) 
                            ? brandFonts.heading 
                            : brandFonts.body;
                    }
                }
                
                // Apply styling to shape elements
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
 * Helper functions (same as in createProjectTool.mjs)
 */
function getTextColor(primary, secondary, accent, index) {
    const colors = [primary, ...secondary, ...accent].filter(Boolean);
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return primary;
    return colors[index % colors.length];
}

function getShapeColor(colorPalette, index) {
    if (colorPalette.length === 0) return '#cccccc';
    if (colorPalette.length === 1) return addOpacity(colorPalette[0], 0.3);
    return addOpacity(colorPalette[index % colorPalette.length], 0.5);
}

function getContrastBackgroundColor(primaryColor) {
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128 ? '#ffffff' : '#f8f9fa';
}

function addOpacity(hexColor, opacity) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return hexColor + alpha;
}

export default createBrandedProjectTool;
