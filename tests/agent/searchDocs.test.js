// Tests for search documents tool
const { createSearchDocsTool } = require('../../agent/tools/searchDocs');
const { mockVectorStore } = require('./setup');

describe('Search Documents Tool', () => {
  let searchDocsTool;
  let mockContext;

  beforeEach(async () => {
    searchDocsTool = await createSearchDocsTool(mockVectorStore);
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(searchDocsTool.name).toBe('search_documents');
      expect(searchDocsTool.description).toBe('Search within uploaded document text.');
    });

    test('should have correct parameter schema', () => {
      const params = searchDocsTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.query).toBeDefined();
      expect(params._def.shape.limit).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should search documents with basic query', async () => {
      const mockResults = [
        { 
          id: 'doc1', 
          title: 'Brand Guidelines', 
          content: 'Our brand colors are blue and white...',
          score: 0.92 
        },
        { 
          id: 'doc2', 
          title: 'Design System', 
          content: 'Typography should use Helvetica...',
          score: 0.85 
        }
      ];
      
      mockVectorStore.searchDocumentChunks.mockResolvedValue(mockResults);

      const result = await searchDocsTool.execute(
        { query: 'brand colors', limit: 5 },
        mockContext
      );

      expect(mockVectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        'brand colors',
        'test-user-123',
        { limit: 5, threshold: 0.7 }
      );
      expect(JSON.parse(result)).toEqual(mockResults);
    });

    test('should use default limit when not provided', async () => {
      mockVectorStore.searchDocumentChunks.mockResolvedValue([]);

      await searchDocsTool.execute(
        { query: 'design guidelines' },
        mockContext
      );

      expect(mockVectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        'design guidelines',
        'test-user-123',
        { limit: 5, threshold: 0.7 }
      );
    });

    test('should handle custom limit within bounds', async () => {
      mockVectorStore.searchDocumentChunks.mockResolvedValue([]);

      await searchDocsTool.execute(
        { query: 'test query', limit: 15 },
        mockContext
      );

      expect(mockVectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        'test query',
        'test-user-123',
        { limit: 15, threshold: 0.7 }
      );
    });

    test('should handle empty results', async () => {
      mockVectorStore.searchDocumentChunks.mockResolvedValue([]);

      const result = await searchDocsTool.execute(
        { query: 'nonexistent document', limit: 5 },
        mockContext
      );

      expect(JSON.parse(result)).toEqual([]);
    });

    test('should handle vector store errors', async () => {
      mockVectorStore.searchDocumentChunks.mockRejectedValue(new Error('Document search failed'));

      await expect(searchDocsTool.execute(
        { query: 'test query', limit: 5 },
        mockContext
      )).rejects.toThrow('Document search failed');
    });

    test('should handle large result sets', async () => {
      const largeResults = Array.from({ length: 20 }, (_, i) => ({
        id: `doc${i}`,
        title: `Document ${i}`,
        content: `Content for document ${i}...`,
        score: 0.9 - (i * 0.01)
      }));
      
      mockVectorStore.searchDocumentChunks.mockResolvedValue(largeResults);

      const result = await searchDocsTool.execute(
        { query: 'many documents', limit: 20 },
        mockContext
      );

      expect(JSON.parse(result)).toEqual(largeResults);
    });
  });

  describe('Parameter Validation', () => {
    test('should validate limit bounds', () => {
      const params = searchDocsTool.parameters;
      
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
      const params = searchDocsTool.parameters;
      
      expect(() => params.parse({ limit: 5 }))
        .toThrow();
      
      expect(() => params.parse({ query: 'test query', limit: 5 }))
        .not.toThrow();
    });

    test('should handle empty query strings', () => {
      const params = searchDocsTool.parameters;
      
      expect(() => params.parse({ query: '', limit: 5 }))
        .not.toThrow(); // Empty strings are valid, tool should handle them
    });
  });
});