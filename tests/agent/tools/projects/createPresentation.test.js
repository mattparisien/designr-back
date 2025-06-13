// Tests for create presentation tool
const { createPresentationTool } = require('../../../../agent/tools/projects/createPresentation');
const { mockFetchJson } = require('../../setup');

describe('Create Presentation Tool', () => {
  let presentationTool;
  let mockContext;

  beforeEach(async () => {
    presentationTool = await createPresentationTool();
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(presentationTool.name).toBe('create_presentation');
      expect(presentationTool.description).toBe('Create a presentation project optimized for slideshow format (16:9 aspect ratio).');
    });

    test('should have correct parameter schema', () => {
      const params = presentationTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.title).toBeDefined();
      expect(params._def.shape.description).toBeDefined();
      expect(params._def.shape.category).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should create presentation project successfully', async () => {
      const mockProject = {
        _id: 'project-123',
        title: 'My Business Presentation',
        type: 'presentation',
        category: 'business',
        canvasSize: { width: 1920, height: 1080 },
        designSpec: {
          format: 'slideshow',
          aspectRatio: '16:9',
          orientation: 'landscape'
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await presentationTool.execute({
        title: 'My Business Presentation',
        description: 'A presentation about quarterly results',
        category: 'business'
      }, mockContext);

      const parsed = JSON.parse(result);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: {
          title: 'My Business Presentation',
          description: 'A presentation about quarterly results',
          type: 'presentation',
          userId: 'test-user-123',
          category: 'business',
          canvasSize: { width: 1920, height: 1080 },
          designSpec: {
            format: 'slideshow',
            aspectRatio: '16:9',
            orientation: 'landscape'
          }
        }
      });

      expect(parsed.success).toBe(true);
      expect(parsed.project.id).toBe('project-123');
      expect(parsed.project.title).toBe('My Business Presentation');
      expect(parsed.project.type).toBe('presentation');
      expect(parsed.message).toContain('My Business Presentation');
    });

    test('should handle API errors gracefully', async () => {
      mockFetchJson.mockRejectedValue(new Error('API Error'));

      const result = await presentationTool.execute({
        title: 'Failed Presentation',
        description: 'This should fail',
        category: 'business'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('API Error');
    });

    test('should use default category when not provided', async () => {
      const mockProject = {
        _id: 'project-456',
        title: 'Default Category Presentation',
        type: 'presentation',
        category: 'business'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await presentationTool.execute({
        title: 'Default Category Presentation',
        description: 'No category specified'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          category: 'business'
        })
      });
    });

    test('should handle different categories', async () => {
      const categories = ['business', 'education', 'marketing', 'personal'];
      
      for (const category of categories) {
        mockFetchJson.mockResolvedValue({
          _id: `project-${category}`,
          title: `${category} presentation`,
          type: 'presentation',
          category
        });

        await presentationTool.execute({
          title: `${category} presentation`,
          description: `A ${category} presentation`,
          category
        }, mockContext);

        expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
          method: 'POST',
          body: expect.objectContaining({
            category
          })
        });
      }
    });
  });

  describe('Parameter Validation', () => {
    test('should require title parameter', () => {
      const params = presentationTool.parameters;
      
      expect(() => params.parse({
        description: 'A presentation',
        category: 'business'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Valid Title',
        description: 'A presentation',
        category: 'business'
      })).not.toThrow();
    });

    test('should validate category enum values', () => {
      const params = presentationTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        description: 'Test',
        category: 'invalid-category'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        description: 'Test',
        category: 'business'
      })).not.toThrow();
    });

    test('should allow optional description', () => {
      const params = presentationTool.parameters;
      
      expect(() => params.parse({
        title: 'Test Presentation',
        category: 'business'
      })).not.toThrow();
    });
  });
});