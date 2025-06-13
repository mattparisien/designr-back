// Tests for create custom project tool
const { createCustomProjectTool } = require('../../../../agent/tools/projects/createCustom');
const { mockFetchJson } = require('../../setup');

describe('Create Custom Project Tool', () => {
  let customTool;
  let mockContext;

  beforeEach(async () => {
    customTool = await createCustomProjectTool();
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(customTool.name).toBe('create_custom_project');
      expect(customTool.description).toBe('Create a project with custom dimensions specified by the user.');
    });

    test('should have correct parameter schema', () => {
      const params = customTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.title).toBeDefined();
      expect(params._def.shape.width).toBeDefined();
      expect(params._def.shape.height).toBeDefined();
      expect(params._def.shape.description).toBeDefined();
      expect(params._def.shape.category).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should create custom project successfully', async () => {
      const mockProject = {
        _id: 'project-123',
        title: 'Custom Banner',
        type: 'custom',
        category: 'marketing',
        canvasSize: { width: 1200, height: 400 }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await customTool.execute({
        title: 'Custom Banner',
        width: 1200,
        height: 400,
        description: 'A custom web banner',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: {
          title: 'Custom Banner',
          description: 'Custom dimensions: 1200x400px',
          type: 'custom',
          userId: 'test-user-123',
          category: 'marketing',
          canvasSize: { width: 1200, height: 400 }
        }
      });

      expect(parsed.success).toBe(true);
      expect(parsed.project.id).toBe('project-123');
      expect(parsed.project.title).toBe('Custom Banner');
      expect(parsed.project.type).toBe('custom');
      expect(parsed.project.dimensions).toBe('1200x400');
      expect(parsed.message).toContain('Custom Banner');
      expect(parsed.message).toContain('1200x400px');
    });

    test('should create square custom project', async () => {
      const mockProject = {
        _id: 'project-456',
        title: 'Custom Square',
        type: 'custom',
        category: 'design',
        canvasSize: { width: 800, height: 800 }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await customTool.execute({
        title: 'Custom Square',
        width: 800,
        height: 800,
        description: 'A perfect square design',
        category: 'design'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.dimensions).toBe('800x800');
    });

    test('should create tall custom project', async () => {
      const mockProject = {
        _id: 'project-789',
        title: 'Custom Tall Banner',
        type: 'custom',
        category: 'advertising',
        canvasSize: { width: 300, height: 1200 }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await customTool.execute({
        title: 'Custom Tall Banner',
        width: 300,
        height: 1200,
        description: 'A tall vertical banner',
        category: 'advertising'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.dimensions).toBe('300x1200');
    });

    test('should handle API errors gracefully', async () => {
      mockFetchJson.mockRejectedValue(new Error('API Error'));

      const result = await customTool.execute({
        title: 'Failed Custom',
        width: 1000,
        height: 500,
        description: 'This should fail',
        category: 'design'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('API Error');
    });

    test('should use default category when not provided', async () => {
      const mockProject = {
        _id: 'project-default',
        title: 'Default Category Custom',
        type: 'custom',
        category: 'design'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await customTool.execute({
        title: 'Default Category Custom',
        width: 1000,
        height: 600,
        description: 'No category specified'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          category: 'design'
        })
      });
    });

    test('should handle various dimension ranges', async () => {
      const dimensions = [
        { width: 100, height: 100 }, // Minimum size
        { width: 1920, height: 1080 }, // HD size
        { width: 4000, height: 3000 }, // Large size
        { width: 2560, height: 1440 }, // QHD size
        { width: 1000, height: 2000 } // Tall format
      ];

      for (const { width, height } of dimensions) {
        mockFetchJson.mockResolvedValue({
          _id: `project-${width}x${height}`,
          title: `Custom ${width}x${height}`,
          type: 'custom',
          category: 'design',
          canvasSize: { width, height }
        });

        const result = await customTool.execute({
          title: `Custom ${width}x${height}`,
          width,
          height,
          description: `A ${width}x${height} custom project`,
          category: 'design'
        }, mockContext);

        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.project.dimensions).toBe(`${width}x${height}`);
      }
    });

    test('should generate correct description when user description provided', async () => {
      const mockProject = {
        _id: 'project-desc',
        title: 'Custom With Description',
        type: 'custom',
        category: 'design'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await customTool.execute({
        title: 'Custom With Description',
        width: 800,
        height: 600,
        description: 'User provided description',
        category: 'design'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          description: 'Custom dimensions: 800x600px'
        })
      });
    });
  });

  describe('Parameter Validation', () => {
    test('should require title parameter', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        width: 1000,
        height: 600
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Valid Title',
        width: 1000,
        height: 600
      })).not.toThrow();
    });

    test('should require width parameter', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        height: 600
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 600
      })).not.toThrow();
    });

    test('should require height parameter', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 600
      })).not.toThrow();
    });

    test('should validate width bounds', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        width: 0,
        height: 600
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 10001,
        height: 600
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 600
      })).not.toThrow();
    });

    test('should validate height bounds', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 0
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 10001
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        width: 1000,
        height: 600
      })).not.toThrow();
    });

    test('should allow optional description and category', () => {
      const params = customTool.parameters;
      
      expect(() => params.parse({
        title: 'Test Custom',
        width: 1000,
        height: 600
      })).not.toThrow();
    });
  });
});