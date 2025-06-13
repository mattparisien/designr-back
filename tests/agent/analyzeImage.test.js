// Tests for analyze image tool
const { createAnalyzeImageTool } = require('../../agent/tools/analyzeImage');
const { mockImageAnalysis } = require('./setup');

describe('Analyze Image Tool', () => {
  let analyzeImageTool;
  let mockContext;

  beforeEach(async () => {
    analyzeImageTool = await createAnalyzeImageTool(mockImageAnalysis);
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(analyzeImageTool.name).toBe('analyze_image');
      expect(analyzeImageTool.description).toBe('Return dominant colours and objects detected in an image URL.');
    });

    test('should have correct parameter schema', () => {
      const params = analyzeImageTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.imageUrl).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should analyze image with basic analysis', async () => {
      const mockAnalysisResult = {
        colors: ['#FF5733', '#33FF57', '#3357FF'],
        objects: ['person', 'laptop', 'coffee cup'],
        description: 'A person working on a laptop with a coffee cup'
      };
      
      mockImageAnalysis.analyzeImage.mockResolvedValue(mockAnalysisResult);

      const result = await analyzeImageTool.execute(
        { imageUrl: 'https://example.com/image.jpg' },
        mockContext
      );

      expect(mockImageAnalysis.analyzeImage).toHaveBeenCalledWith('https://example.com/image.jpg');
      expect(JSON.parse(result)).toEqual(mockAnalysisResult);
    });

    test('should handle null analysis result', async () => {
      mockImageAnalysis.analyzeImage.mockResolvedValue(null);

      const result = await analyzeImageTool.execute(
        { imageUrl: 'https://example.com/invalid.jpg' },
        mockContext
      );

      expect(JSON.parse(result)).toEqual({});
    });

    test('should handle undefined analysis result', async () => {
      mockImageAnalysis.analyzeImage.mockResolvedValue(undefined);

      const result = await analyzeImageTool.execute(
        { imageUrl: 'https://example.com/missing.jpg' },
        mockContext
      );

      expect(JSON.parse(result)).toEqual({});
    });

    test('should handle image analysis errors', async () => {
      mockImageAnalysis.analyzeImage.mockRejectedValue(new Error('Image analysis failed'));

      await expect(analyzeImageTool.execute(
        { imageUrl: 'https://example.com/broken.jpg' },
        mockContext
      )).rejects.toThrow('Image analysis failed');
    });

    test('should handle complex analysis results', async () => {
      const complexResult = {
        colors: ['#FF5733', '#33FF57', '#3357FF', '#F0F0F0'],
        objects: ['person', 'laptop', 'coffee cup', 'desk', 'plant'],
        description: 'A professional workspace with a person working',
        dominantColors: [
          { color: '#FF5733', percentage: 35 },
          { color: '#33FF57', percentage: 25 },
          { color: '#3357FF', percentage: 20 },
          { color: '#F0F0F0', percentage: 20 }
        ],
        mood: 'professional',
        composition: 'rule-of-thirds',
        lighting: 'natural'
      };
      
      mockImageAnalysis.analyzeImage.mockResolvedValue(complexResult);

      const result = await analyzeImageTool.execute(
        { imageUrl: 'https://example.com/complex-image.jpg' },
        mockContext
      );

      expect(JSON.parse(result)).toEqual(complexResult);
    });
  });

  describe('Parameter Validation', () => {
    test('should require imageUrl parameter', () => {
      const params = analyzeImageTool.parameters;
      
      expect(() => params.parse({}))
        .toThrow();
      
      expect(() => params.parse({ imageUrl: 'https://example.com/image.jpg' }))
        .not.toThrow();
    });

    test('should validate imageUrl as string', () => {
      const params = analyzeImageTool.parameters;
      
      expect(() => params.parse({ imageUrl: 123 }))
        .toThrow();
      
      expect(() => params.parse({ imageUrl: 'valid-url' }))
        .not.toThrow();
    });
  });
});