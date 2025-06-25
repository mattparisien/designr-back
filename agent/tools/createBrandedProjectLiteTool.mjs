import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Simplified schema with fewer optional fields to reduce token usage
const SimplifiedProjectSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['presentation', 'social', 'print', 'custom']).default('custom'),
    layout: z.object({
        pages: z.array(z.object({
            canvas: z.object({ width: z.number(), height: z.number() }),
            elements: z.array(z.object({
                id: z.string(),
                kind: z.enum(['text', 'image', 'shape']),
                x: z.number(), y: z.number(),
                width: z.number(), height: z.number(),
                content: z.string().optional(),
                fontSize: z.number().optional(),
                shapeType: z.enum(['rect', 'circle', 'triangle']).optional()
            })).default([])
        }))
    })
});

const createBrandedProjectLiteTool = tool(
    async ({ project, userId }) => {
        try {
            // Quick brand fetch with minimal processing
            const brandUrl = `http://localhost:3001/api/brands`;
            const brandRes = await fetch(brandUrl, {
                headers: { 'User-ID': userId || '6825167ffe3452cafe0c8440' }
            });

            let brandColors = null;
            if (brandRes.ok) {
                const { data: brands } = await brandRes.json();
                if (brands?.length > 0) {
                    const brand = brands.find(b => b.isActive) || brands[0];
                    const palette = brand.colorPalettes?.[0];
                    if (palette) {
                        brandColors = {
                            primary: palette.primary,
                            secondary: palette.secondary?.[0] || palette.primary
                        };
                    }
                }
            }

            // Apply basic brand styling if available
            if (brandColors && project.layout?.pages) {
                project.layout.pages.forEach(page => {
                    page.elements?.forEach((element, i) => {
                        if (element.kind === 'text' && !element.color) {
                            element.color = i % 2 === 0 ? brandColors.primary : brandColors.secondary;
                        }
                    });
                });
            }

            // Create project
            const projectRes = await fetch('http://localhost:3001/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });

            const result = await projectRes.json();
            return { success: projectRes.ok, data: result };

        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    {
        name: 'createBrandedProjectLite',
        description: 'Create a project with basic brand colors applied. Simplified version for faster execution.',
        schema: z.object({
            project: SimplifiedProjectSchema,
            userId: z.string().optional()
        })
    }
);

export default createBrandedProjectLiteTool;
