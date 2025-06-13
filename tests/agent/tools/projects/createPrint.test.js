// Tests for create print tool
const { createPrintTool } = require('../../../../agent/tools/projects/createPrint');
const { mockFetchJson } = require('../../setup');

describe('Create Print Tool', () => {
  let printTool;
  let mockContext;

  beforeEach(async () => {
    printTool = await createPrintTool();
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(printTool.name).toBe('create_print_project');
      expect(printTool.description).toBe('Create a print project with specific paper sizes and print-optimized settings.');
    });

    test('should have correct parameter schema', () => {
      const params = printTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.title).toBeDefined();
      expect(params._def.shape.size).toBeDefined();
      expect(params._def.shape.orientation).toBeDefined();
      expect(params._def.shape.description).toBeDefined();
      expect(params._def.shape.category).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should create A4 portrait print project successfully', async () => {
      const mockProject = {
        _id: 'project-123',
        title: 'Business Flyer',
        type: 'print',
        category: 'marketing',
        canvasSize: { width: 2480, height: 3508 },
        designSpec: {
          size: 'A4',
          orientation: 'portrait',
          printReady: true,
          dpi: 300
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await printTool.execute({
        title: 'Business Flyer',
        size: 'A4',
        orientation: 'portrait',
        description: 'Marketing flyer for our business',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: {
          title: 'Business Flyer',
          description: 'Marketing flyer for our business',
          type: 'print',
          userId: 'test-user-123',
          category: 'marketing',
          canvasSize: { width: 2480, height: 3508 },
          designSpec: {
            size: 'A4',
            orientation: 'portrait',
            printReady: true,
            dpi: 300
          }
        }
      });

      expect(parsed.success).toBe(true);
      expect(parsed.project.size).toBe('A4');
      expect(parsed.project.orientation).toBe('portrait');
    });

    test('should create business card project successfully', async () => {
      const mockProject = {
        _id: 'project-456',
        title: 'My Business Card',
        type: 'print',
        category: 'business',
        canvasSize: { width: 1050, height: 600 },
        designSpec: {
          size: 'business-card',
          orientation: 'landscape',
          printReady: true,
          dpi: 300
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await printTool.execute({
        title: 'My Business Card',
        size: 'business-card',
        orientation: 'landscape',
        description: 'Professional business card design',
        category: 'business'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.size).toBe('business-card');
    });

    test('should create poster project successfully', async () => {
      const mockProject = {
        _id: 'project-789',
        title: 'Event Poster',
        type: 'print',
        category: 'event',
        canvasSize: { width: 7016, height: 9933 },
        designSpec: {
          size: 'poster',
          orientation: 'portrait',
          printReady: true,
          dpi: 300
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await printTool.execute({
        title: 'Event Poster',
        size: 'poster',
        orientation: 'portrait',
        description: 'Promotional poster for upcoming event',
        category: 'event'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.size).toBe('poster');
    });

    test('should handle API errors gracefully', async () => {
      mockFetchJson.mockRejectedValue(new Error('API Error'));

      const result = await printTool.execute({
        title: 'Failed Print',
        size: 'A4',
        orientation: 'portrait',
        description: 'This should fail',
        category: 'business'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('API Error');
    });

    test('should use default category when not provided', async () => {
      const mockProject = {
        _id: 'project-default',
        title: 'Default Category Print',
        type: 'print',
        category: 'business'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await printTool.execute({
        title: 'Default Category Print',
        size: 'A4',
        orientation: 'portrait',
        description: 'No category specified'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          category: 'business'
        })
      });
    });

    test('should use default orientation when not provided', async () => {
      const mockProject = {
        _id: 'project-default-orientation',
        title: 'Default Orientation Print',
        type: 'print',
        category: 'business'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await printTool.execute({
        title: 'Default Orientation Print',
        size: 'A4',
        description: 'No orientation specified'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          designSpec: expect.objectContaining({
            orientation: 'portrait'
          })
        })
      });
    });

    test('should handle all print size combinations', async () => {
      const combinations = [
        { 
          size: 'A4', 
          orientation: 'portrait', 
          expectedSize: { width: 2480, height: 3508 } 
        },
        { 
          size: 'A4', 
          orientation: 'landscape', 
          expectedSize: { width: 3508, height: 2480 } 
        },
        { 
          size: 'A5', 
          orientation: 'portrait', 
          expectedSize: { width: 1748, height: 2480 } 
        },
        { 
          size: 'business-card', 
          orientation: 'landscape', 
          expectedSize: { width: 1050, height: 600 } 
        },
        { 
          size: 'poster', 
          orientation: 'portrait', 
          expectedSize: { width: 7016, height: 9933 } 
        },
        { 
          size: 'flyer', 
          orientation: 'portrait', 
          expectedSize: { width: 2480, height: 3508 } 
        }
      ];

      for (const { size, orientation, expectedSize } of combinations) {
        mockFetchJson.mockResolvedValue({
          _id: `project-${size}-${orientation}`,
          title: `${size} ${orientation}`,
          type: 'print',
          category: 'business',
          canvasSize: expectedSize
        });

        await printTool.execute({
          title: `${size} ${orientation}`,
          size,
          orientation,
          description: `A ${size} in ${orientation} orientation`,
          category: 'business'
        }, mockContext);

        expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
          method: 'POST',
          body: expect.objectContaining({
            canvasSize: expectedSize
          })
        });
      }
    });
  });

  describe('Parameter Validation', () => {
    test('should require title parameter', () => {
      const params = printTool.parameters;
      
      expect(() => params.parse({
        size: 'A4',
        orientation: 'portrait'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Valid Title',
        size: 'A4',
        orientation: 'portrait'
      })).not.toThrow();
    });

    test('should validate size enum values', () => {
      const params = printTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        size: 'invalid-size',
        orientation: 'portrait'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        size: 'A4',
        orientation: 'portrait'
      })).not.toThrow();
    });

    test('should validate orientation enum values', () => {
      const params = printTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        size: 'A4',
        orientation: 'invalid-orientation'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        size: 'A4',
        orientation: 'portrait'
      })).not.toThrow();
    });

    test('should allow optional description and category', () => {
      const params = printTool.parameters;
      
      expect(() => params.parse({
        title: 'Test Print',
        size: 'A4',
        orientation: 'portrait'
      })).not.toThrow();
    });
  });
});