// Tests for create social media tool
const { createSocialMediaTool } = require('../../../../agent/tools/projects/createSocialMedia');
const { mockFetchJson } = require('../../setup');

describe('Create Social Media Tool', () => {
  let socialMediaTool;
  let mockContext;

  beforeEach(async () => {
    socialMediaTool = await createSocialMediaTool();
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(socialMediaTool.name).toBe('create_social_media_project');
      expect(socialMediaTool.description).toBe('Create a social media project with platform-specific dimensions and optimizations.');
    });

    test('should have correct parameter schema', () => {
      const params = socialMediaTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.title).toBeDefined();
      expect(params._def.shape.platform).toBeDefined();
      expect(params._def.shape.format).toBeDefined();
      expect(params._def.shape.description).toBeDefined();
      expect(params._def.shape.category).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should create Instagram post successfully', async () => {
      const mockProject = {
        _id: 'project-123',
        title: 'Coffee Shop Promotion',
        type: 'social-media',
        category: 'marketing',
        canvasSize: { width: 1080, height: 1080 },
        designSpec: {
          platform: 'Instagram',
          format: 'post',
          aspectRatio: '1:1',
          orientation: 'square'
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await socialMediaTool.execute({
        title: 'Coffee Shop Promotion',
        platform: 'Instagram',
        format: 'post',
        description: 'Promoting our new coffee blend',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: {
          title: 'Coffee Shop Promotion',
          description: 'Promoting our new coffee blend',
          type: 'social-media',
          userId: 'test-user-123',
          category: 'marketing',
          canvasSize: { width: 1080, height: 1080 },
          designSpec: {
            platform: 'Instagram',
            format: 'post',
            aspectRatio: '1:1',
            orientation: 'square'
          }
        }
      });

      expect(parsed.success).toBe(true);
      expect(parsed.project.platform).toBe('Instagram');
      expect(parsed.project.format).toBe('post');
    });

    test('should create Facebook story successfully', async () => {
      const mockProject = {
        _id: 'project-456',
        title: 'Brand Story',
        type: 'social-media',
        category: 'marketing',
        canvasSize: { width: 1080, height: 1920 },
        designSpec: {
          platform: 'Facebook',
          format: 'story',
          aspectRatio: '9:16',
          orientation: 'portrait'
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await socialMediaTool.execute({
        title: 'Brand Story',
        platform: 'Facebook',
        format: 'story',
        description: 'Behind the scenes content',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.platform).toBe('Facebook');
      expect(parsed.project.format).toBe('story');
    });

    test('should create Twitter post successfully', async () => {
      const mockProject = {
        _id: 'project-789',
        title: 'Twitter Announcement',
        type: 'social-media',
        category: 'marketing',
        canvasSize: { width: 1200, height: 675 },
        designSpec: {
          platform: 'Twitter',
          format: 'post',
          aspectRatio: '16:9',
          orientation: 'landscape'
        }
      };

      mockFetchJson.mockResolvedValue(mockProject);

      const result = await socialMediaTool.execute({
        title: 'Twitter Announcement',
        platform: 'Twitter',
        format: 'post',
        description: 'Product launch announcement',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.project.platform).toBe('Twitter');
    });

    test('should handle API errors gracefully', async () => {
      mockFetchJson.mockRejectedValue(new Error('API Error'));

      const result = await socialMediaTool.execute({
        title: 'Failed Post',
        platform: 'Instagram',
        format: 'post',
        description: 'This should fail',
        category: 'marketing'
      }, mockContext);

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('API Error');
    });

    test('should use default category when not provided', async () => {
      const mockProject = {
        _id: 'project-default',
        title: 'Default Category Post',
        type: 'social-media',
        category: 'marketing'
      };

      mockFetchJson.mockResolvedValue(mockProject);

      await socialMediaTool.execute({
        title: 'Default Category Post',
        platform: 'Instagram',
        format: 'post',
        description: 'No category specified'
      }, mockContext);

      expect(mockFetchJson).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        body: expect.objectContaining({
          category: 'marketing'
        })
      });
    });

    test('should handle all platform-format combinations', async () => {
      const combinations = [
        { platform: 'Instagram', format: 'post', expectedSize: { width: 1080, height: 1080 } },
        { platform: 'Instagram', format: 'story', expectedSize: { width: 1080, height: 1920 } },
        { platform: 'Facebook', format: 'post', expectedSize: { width: 1200, height: 630 } },
        { platform: 'Twitter', format: 'post', expectedSize: { width: 1200, height: 675 } },
        { platform: 'LinkedIn', format: 'post', expectedSize: { width: 1200, height: 627 } },
        { platform: 'YouTube', format: 'thumbnail', expectedSize: { width: 1280, height: 720 } },
        { platform: 'TikTok', format: 'video', expectedSize: { width: 1080, height: 1920 } }
      ];

      for (const { platform, format, expectedSize } of combinations) {
        mockFetchJson.mockResolvedValue({
          _id: `project-${platform}-${format}`,
          title: `${platform} ${format}`,
          type: 'social-media',
          category: 'marketing',
          canvasSize: expectedSize
        });

        await socialMediaTool.execute({
          title: `${platform} ${format}`,
          platform,
          format,
          description: `A ${platform} ${format}`,
          category: 'marketing'
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
      const params = socialMediaTool.parameters;
      
      expect(() => params.parse({
        platform: 'Instagram',
        format: 'post'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Valid Title',
        platform: 'Instagram',
        format: 'post'
      })).not.toThrow();
    });

    test('should validate platform enum values', () => {
      const params = socialMediaTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        platform: 'invalid-platform',
        format: 'post'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        platform: 'Instagram',
        format: 'post'
      })).not.toThrow();
    });

    test('should validate format enum values', () => {
      const params = socialMediaTool.parameters;
      
      expect(() => params.parse({
        title: 'Test',
        platform: 'Instagram',
        format: 'invalid-format'
      })).toThrow();
      
      expect(() => params.parse({
        title: 'Test',
        platform: 'Instagram',
        format: 'post'
      })).not.toThrow();
    });

    test('should allow optional description and category', () => {
      const params = socialMediaTool.parameters;
      
      expect(() => params.parse({
        title: 'Test Post',
        platform: 'Instagram',
        format: 'post'
      })).not.toThrow();
    });
  });
});