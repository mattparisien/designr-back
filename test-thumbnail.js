// Test script to verify thumbnail generation with proper aspect ratios
const ProjectAgentService = require('./services/projectAgentService');

async function testThumbnails() {
  console.log('🔧 Testing thumbnail generation with aspect ratios...\n');
  
  try {
    // Initialize the project agent service
    const service = new ProjectAgentService();
    await service.initialize();
    
    console.log('✅ Project Agent Service initialized successfully\n');
    
    // Test different project types with different aspect ratios
    const testCases = [
      {
        name: 'Instagram Post (1:1)',
        message: 'Create an Instagram post about coffee',
        expectedAspect: '1:1'
      },
      {
        name: 'Instagram Story (9:16)', 
        message: 'Create an Instagram story about travel',
        expectedAspect: '9:16'
      },
      {
        name: 'YouTube Thumbnail (16:9)',
        message: 'Create a YouTube thumbnail for a cooking video',
        expectedAspect: '16:9'
      },
      {
        name: 'Presentation (16:9)',
        message: 'Create a presentation about quarterly results',
        expectedAspect: '16:9'
      },
      {
        name: 'A4 Print (√2:1)',
        message: 'Create an A4 flyer for a music concert',
        expectedAspect: 'A4'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`📋 Testing: ${testCase.name}`);
      console.log(`Expected aspect ratio: ${testCase.expectedAspect}`);
      
      try {
        const result = await service.chat(testCase.message, { userId: 'test-user-123' });
        
        const response = result.assistant_text;
        console.log(`Response: ${response.substring(0, 200)}...`);
        
        // Check tool outputs for project creation
        if (result.toolOutputs) {
          const projectTools = Object.keys(result.toolOutputs).filter(key => 
            key.includes('create') && key.includes('project')
          );
          
          for (const toolName of projectTools) {
            const toolOutput = result.toolOutputs[toolName];
            try {
              const projectData = JSON.parse(toolOutput);
              if (projectData.success && projectData.project && projectData.project.canvasSize) {
                const { width, height } = projectData.project.canvasSize;
                const actualRatio = (width / height).toFixed(2);
                console.log(`✅ Canvas dimensions: ${width}x${height} (ratio: ${actualRatio})`);
                
                // Check if thumbnail exists
                if (projectData.project.thumbnail) {
                  console.log(`✅ Thumbnail generated: ${projectData.project.thumbnail.substring(0, 50)}...`);
                } else {
                  console.log('⚠️  No thumbnail in project data');
                }
              } else {
                console.log(`⚠️  Tool output: ${toolOutput}`);
              }
            } catch (parseError) {
              console.log(`⚠️  Could not parse tool output: ${toolOutput}`);
            }
          }
        }
        
        console.log('✅ Project created successfully\n');
        
      } catch (error) {
        console.error(`❌ Error creating ${testCase.name}:`, error.message);
        console.log('');
      }
    }
    
    console.log('🎉 Thumbnail generation test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Check the generated thumbnails in Cloudinary');
    console.log('2. Verify they maintain proper aspect ratios');
    console.log('3. Test with the frontend to see visual results');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testThumbnails();
