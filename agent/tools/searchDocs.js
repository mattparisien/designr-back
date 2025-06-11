// agent/tools/searchDocs.js
// Tool for searching within uploaded document text

const { requireDynamic } = require('../../utils/dynamicImports');

async function createSearchDocsTool(vectorStore) {
  const { tool, z } = await requireDynamic();
  
  return tool({
    name: 'search_documents',
    description: 'Search within uploaded document text.',
    parameters: z.object({
      query: z.string(),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ query, limit }, ctx) => {
      const chunks = await vectorStore.searchDocumentChunks(query, ctx.userId, {
        limit,
        threshold: 0.7,
      });
      return JSON.stringify(chunks);
    },
  });
}

module.exports = { createSearchDocsTool };
