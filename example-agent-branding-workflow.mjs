// Example: AI Agent Using Branding Tools
// This demonstrates how the agent would use the new branding tools in practice

import tools from './agent/tools/index.mjs';

// Get the specific tools we need
const getBrandingTool = tools.find(tool => tool.name === 'getBranding');
const createBrandedProjectTool = tools.find(tool => tool.name === 'createBrandedProject');

// Example agent workflow for: "Create a social media post for my business"
async function exampleAgentWorkflow(userRequest = "Create a social media post for my business") {
    console.log(`User Request: "${userRequest}"\n`);
    
    // Step 1: Agent analyzes the request and determines it needs branding
    console.log("🤖 Agent Analysis:");
    console.log("- User wants to create branded content");
    console.log("- This requires fetching brand information first");
    console.log("- Will create an Instagram-optimized post");
    console.log("");
    
    // Step 2: Get user's branding
    console.log("🎨 Step 1: Fetching user branding...");
    try {
        const brandingResult = await getBrandingTool.invoke({
            userId: '6825167ffe3452cafe0c8440'
        });
        
        if (brandingResult.success) {
            console.log("✅ Brand information retrieved:");
            console.log(`   - Brand: ${brandingResult.data.brandName}`);
            console.log(`   - Primary Color: ${brandingResult.data.colors.primary}`);
            console.log(`   - Secondary Colors: ${brandingResult.data.colors.secondary.join(', ')}`);
            console.log(`   - Heading Font: ${brandingResult.data.fonts.heading}`);
            console.log(`   - Body Font: ${brandingResult.data.fonts.body}`);
            console.log("");
            
            // Step 3: Create branded project
            console.log("🚀 Step 2: Creating branded social media post...");
            
            const projectResult = await createBrandedProjectTool.invoke({
                projectRequest: {
                    title: "Social Media Post - Business",
                    description: "Instagram post with brand colors and fonts",
                    type: "social",
                    tags: ["social-media", "instagram", "branded"],
                    layout: {
                        pages: [{
                            name: "Instagram Post",
                            canvas: { width: 1080, height: 1080 },
                            background: { type: "color" }, // Will be auto-set based on brand
                            elements: [
                                {
                                    id: "headline",
                                    kind: "text",
                                    x: 80,
                                    y: 200,
                                    width: 920,
                                    height: 120,
                                    content: "Your Business Headline",
                                    fontSize: 48,
                                    textAlign: "center",
                                    bold: true
                                    // color and fontFamily will be auto-applied
                                },
                                {
                                    id: "subtext",
                                    kind: "text", 
                                    x: 80,
                                    y: 350,
                                    width: 920,
                                    height: 200,
                                    content: "Engaging description of your product or service that connects with your audience.",
                                    fontSize: 24,
                                    textAlign: "center"
                                    // color and fontFamily will be auto-applied
                                },
                                {
                                    id: "cta-background",
                                    kind: "shape",
                                    x: 290,
                                    y: 600,
                                    width: 500,
                                    height: 80,
                                    shapeType: "rect"
                                    // backgroundColor will be auto-applied from brand
                                },
                                {
                                    id: "cta-text",
                                    kind: "text",
                                    x: 290,
                                    y: 620,
                                    width: 500,
                                    height: 40,
                                    content: "Learn More Today",
                                    fontSize: 20,
                                    textAlign: "center",
                                    bold: true,
                                    color: "#ffffff" // Contrasting color for CTA
                                }
                            ]
                        }]
                    }
                },
                userId: '6825167ffe3452cafe0c8440'
            });
            
            if (projectResult.success) {
                console.log("✅ Branded project created successfully!");
                console.log(`   - Project ID: ${projectResult.data.project.data?.id || 'Generated'}`);
                console.log(`   - Brand Applied: ${projectResult.data.brandingApplied ? 'Yes' : 'No'}`);
                
                if (projectResult.data.brandInfo) {
                    console.log(`   - Brand Used: ${projectResult.data.brandInfo.brandName}`);
                    console.log(`   - Colors Applied: ${Object.keys(projectResult.data.brandInfo.colorsUsed || {}).join(', ')}`);
                }
                
                console.log("\n🎉 Agent Response to User:");
                console.log("I've created a branded social media post for your business! Here's what I included:");
                console.log("- Instagram-optimized dimensions (1080x1080)");
                console.log(`- Your brand colors (${brandingResult.data.colors.primary} as primary)`);
                console.log(`- Your brand fonts (${brandingResult.data.fonts.heading} for headlines)`);
                console.log("- Professional layout with headline, description, and call-to-action");
                console.log("- Background color chosen to complement your brand");
                console.log("\nThe post is ready to use and maintains your brand consistency!");
                
            } else {
                console.log("❌ Failed to create project:", projectResult.error);
            }
            
        } else {
            console.log("⚠️ No branding found - proceeding with default styling");
            console.log("The agent would fall back to createProject with standard design principles");
        }
        
    } catch (error) {
        console.error("❌ Error in agent workflow:", error);
    }
}

// Run the example
console.log("=".repeat(60));
console.log("AI AGENT BRANDING WORKFLOW EXAMPLE");
console.log("=".repeat(60));
console.log("");

exampleAgentWorkflow().catch(console.error);
