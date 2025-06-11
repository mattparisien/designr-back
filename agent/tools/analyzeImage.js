// agent/tools/analyzeImage.js
// Tool for analyzing image colors and objects

const { requireDynamic } = require('../../utils/dynamicImports');

async function createAnalyzeImageTool(imageAnalysis) {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'analyze_image',
    description: 'Return dominant colours and objects detected in an image URL.',
    parameters: z.object({ 
      imageUrl: z.string().describe('The URL of the image to analyze') 
    }),
    execute: async ({ imageUrl }) => {
      const analysis = await imageAnalysis.analyzeImage(imageUrl);
      return JSON.stringify(analysis ?? {});
    },
  });
}

module.exports = { createAnalyzeImageTool };
