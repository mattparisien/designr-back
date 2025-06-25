// Test script for branding tools
const { getBrandingTool, createBrandedProjectTool } = require('./agent/tools/index.mjs');

async function testBrandingTools() {
    console.log('Testing branding integration tools...\n');
    
    // Test 1: Get user branding
    console.log('1. Testing getBranding tool...');
    try {
        const brandingResult = await getBrandingTool.invoke({
            userId: '6825167ffe3452cafe0c8440'
        });
        console.log('Branding result:', JSON.stringify(brandingResult, null, 2));
    } catch (error) {
        console.error('Error testing getBranding:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Create a branded project
    console.log('2. Testing createBrandedProject tool...');
    try {
        const projectResult = await createBrandedProjectTool.invoke({
            projectRequest: {
                title: 'Test Branded Project',
                description: 'A test project with brand colors applied',
                type: 'social',
                layout: {
                    pages: [{
                        name: 'Main Page',
                        canvas: { width: 1080, height: 1080 },
                        elements: [
                            {
                                id: 'text1',
                                kind: 'text',
                                x: 50,
                                y: 50,
                                width: 300,
                                height: 50,
                                content: 'Brand Headline',
                                fontSize: 24
                            },
                            {
                                id: 'text2',
                                kind: 'text',
                                x: 50,
                                y: 120,
                                width: 400,
                                height: 100,
                                content: 'This is body text that should use brand colors',
                                fontSize: 16
                            },
                            {
                                id: 'shape1',
                                kind: 'shape',
                                x: 500,
                                y: 50,
                                width: 200,
                                height: 100,
                                shapeType: 'rect'
                            }
                        ]
                    }]
                }
            },
            userId: '6825167ffe3452cafe0c8440'
        });
        console.log('Branded project result:', JSON.stringify(projectResult, null, 2));
    } catch (error) {
        console.error('Error testing createBrandedProject:', error.message);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testBrandingTools().catch(console.error);
}

module.exports = { testBrandingTools };
