// agent/tools/analyzeImage.ts
// Tool for analyzing image colors and objects

import { requireDynamic } from '../../utils/dynamicImports';

export async function createAnalyzeImageTool(imageAnalysis: any) {
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

