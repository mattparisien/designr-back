import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getBrandingTool = tool(
    async ({ 
        userId,
        brandId,
        headers = {} 
    }) => {
        try {
            let url = 'http://localhost:3001/api/brands';
            
            // If brandId is provided, get specific brand
            if (brandId) {
                url += `/${brandId}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-ID': userId || '6825167ffe3452cafe0c8440', // Default user ID for testing
                    ...headers
                }
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch branding:', responseData);
                return {
                    success: false,
                    error: responseData.message || responseData.error || 'Failed to fetch branding',
                    status: response.status,
                    data: null
                };
            }

            let brandData;
            
            if (brandId) {
                // Single brand requested
                brandData = responseData.data;
            } else {
                // All brands returned, find the active one or use the first one
                const brands = responseData.data;
                if (brands.length === 0) {
                    return {
                        success: false,
                        error: 'No brands found for user',
                        status: 404,
                        data: null
                    };
                }
                
                // Find active brand or use first brand
                brandData = brands.find(brand => brand.isActive) || brands[0];
            }

            // Extract useful branding information for project creation
            const brandingInfo = {
                brandId: brandData._id,
                brandName: brandData.name,
                tagline: brandData.tagline,
                industry: brandData.industry,
                colors: extractBrandColors(brandData),
                fonts: extractBrandFonts(brandData),
                logos: extractBrandLogos(brandData),
                voice: brandData.brandVoice,
                guidelines: brandData.guidelines
            };

            return {
                success: true,
                status: response.status,
                data: brandingInfo
            };

        } catch (error) {
            console.error('Error fetching branding:', error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred',
                status: null,
                data: null
            };
        }
    },
    {
        name: 'getBranding',
        description: 'Fetch user branding information including color palettes, fonts, logos, and brand voice to use when creating new projects. This ensures projects align with the user\'s brand identity.',
        schema: z.object({
            userId: z.string().optional().describe('The user ID to fetch branding for. If not provided, uses default test user.'),
            brandId: z.string().optional().describe('Optional specific brand ID to fetch. If not provided, gets the active brand or first available brand.'),
            headers: z.object({}).passthrough().optional().describe('Optional headers to include in the request')
        }),
    }
);

/**
 * Extract and organize color palettes from brand data
 */
function extractBrandColors(brandData) {
    if (!brandData.colorPalettes || brandData.colorPalettes.length === 0) {
        return {
            primary: '#000000',
            secondary: [],
            accent: [],
            palette: null
        };
    }

    // Find default palette or use first one
    const defaultPalette = brandData.colorPalettes.find(palette => palette.isDefault) 
                          || brandData.colorPalettes[0];

    return {
        primary: defaultPalette.primary,
        secondary: defaultPalette.secondary || [],
        accent: defaultPalette.accent || [],
        palette: defaultPalette,
        allPalettes: brandData.colorPalettes
    };
}

/**
 * Extract font information from brand data
 */
function extractBrandFonts(brandData) {
    if (!brandData.typography) {
        return {
            heading: 'Arial',
            body: 'Arial',
            pairings: []
        };
    }

    return {
        heading: brandData.typography.headingFont,
        body: brandData.typography.bodyFont,
        pairings: brandData.typography.fontPairings || []
    };
}

/**
 * Extract logo information from brand data
 */
function extractBrandLogos(brandData) {
    if (!brandData.logos || brandData.logos.length === 0) {
        return {
            primary: null,
            all: []
        };
    }

    // Find primary logo or use first one
    const primaryLogo = brandData.logos.find(logo => logo.usage === 'primary') 
                       || brandData.logos[0];

    return {
        primary: primaryLogo,
        all: brandData.logos
    };
}

export default getBrandingTool;
