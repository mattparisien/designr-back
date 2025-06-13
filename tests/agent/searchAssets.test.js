// Tests for search assets tool
const { createSearchAssetsTool } = require('../../agent/tools/searchAssets');
const { mockVectorStore } = require('./setup');

describe('Search Assets Tool', () => {
  let searchAssetsTool;
  let mockContext;

  beforeEach(async () => {
    searchAssetsTool = await createSearchAssetsTool(mockVectorStore);
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(searchAssetsTool.name).toBe('search_assets');
      expect(searchAssetsTool.description).toBe("Find visually similar assets in the user's library.");
    });

    test('should have correct parameter schema', () => {
      const params = searchAssetsTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.query).toBeDefined();
      expect(params._def.shape.limit).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should search assets with basic query', async () => {
      const mockResults = [
        { id: 'asset1', name: 'logo.png', similarity: 0.95 },
        { id: 'asset2', name: 'banner.jpg', similarity: 0.88 }
      ];
      
      mockVectorStore.searchAssets.mockResolvedValue(mockResults);

      const result = await searchAssetsTool.execute(
        { query: 'logo design', limit: 5 },
        mockContext
      );

      expect(mockVectorStore.searchAssets).toHaveBeenCalledWith(
        'logo design',
        'test-user-123',
        { limit: 5 }
      );
      expect(JSON.parse(result)).toEqual(mockResults);
    });

    test('should use default limit when not provided', async () => {
      mockVectorStore.searchAssets.mockResolvedValue([]);

      await searchAssetsTool.execute(
        { query: 'test query' },
        mockContext
      );

      expect(mockVectorStore.searchAssets).toHaveBeenCalledWith(
        'test query',
        'test-user-123',
        { limit: 5 }
      );
    });

    test('should handle custom limit within bounds', async () => {
      mockVectorStore.searchAssets.mockResolvedValue([]);

      await searchAssetsTool.execute(
        { query: 'test query', limit: 10 },
        mockContext
      );

      expect(mockVectorStore.searchAssets).toHaveBeenCalledWith(
        'test query',
        'test-user-123',
        { limit: 10 }
      );
    });

    test('should handle empty results', async () => {
      mockVectorStore.searchAssets.mockResolvedValue([]);

      const result = await searchAssetsTool.execute(
        { query: 'nonexistent asset', limit: 5 },
        mockContext
      );

      expect(JSON.parse(result)).toEqual([]);
    });

    test('should handle vector store errors', async () => {
      mockVectorStore.searchAssets.mockRejectedValue(new Error('Vector store error'));

      await expect(searchAssetsTool.execute(
        { query: 'test query', limit: 5 },
        mockContext
      )).rejects.toThrow('Vector store error');
    });

    test('should handle large result sets', async () => {
      const largeResults = Array.from({ length: 20 }, (_, i) => ({
        id: `asset${i}`,
        name: `file${i}.jpg`,
        similarity: 0.9 - (i * 0.01)
      }));
      
      mockVectorStore.searchAssets.mockResolvedValue(largeResults);

      const result = await searchAssetsTool.execute(
        { query: 'many assets', limit: 20 },
        mockContext
      );

      expect(JSON.parse(result)).toEqual(largeResults);
    });
  });

  describe('Parameter Validation', () => {
    test('should validate limit bounds', () => {
      const params = searchAssetsTool.parameters;
      
      // Test minimum
      expect(() => params.parse({ query: 'test', limit: 0 }))
        .toThrow();
      
      // Test maximum
      expect(() => params.parse({ query: 'test', limit: 21 }))
        .toThrow();
      
      // Test valid range
      expect(() => params.parse({ query: 'test', limit: 10 }))
        .not.toThrow();
    });

    test('should require query parameter', () => {
      const params = searchAssetsTool.parameters;
      
      expect(() => params.parse({ limit: 5 }))
        .toThrow();
      
      expect(() => params.parse({ query: 'test', limit: 5 }))
        .not.toThrow();
    });
  });
});