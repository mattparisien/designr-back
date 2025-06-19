// agent/tools/searchAssets.ts
// Tool for searching visually similar assets in the user's library

import { requireDynamic } from '../../utils/dynamicImports';

export async function createSearchAssetsTool(vectorStore: any) {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'search_assets',
    description: "Find visually similar assets in the user's library.",
    parameters: z.object({
      query: z.string().describe('Natural‑language or file name query'),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ query, limit }, ctx) => {
      const results = await vectorStore.searchAssets(query, ctx.userId, {
        limit
      });
      return JSON.stringify(results);
    },
  });
}

