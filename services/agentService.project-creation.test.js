// agentService.project-creation.test.js - Tests for project creation tool integration

const AgentService = require('./agentService');
const { createProjectTool, getCanvasPreset, suggestCanvasSize, CANVAS_PRESETS } = require('../utils/agentTools');
const { PROJECT_API_CONFIG } = require('../utils/projectApiClient');

describe('AgentService Project Creation Tool', () => {
  describe('Canvas Presets and Utilities', () => {
    it('should provide correct canvas presets', () => {
      expect(getCanvasPreset('Instagram Post')).toEqual({ width: 1080, height: 1080 });
      expect(getCanvasPreset('Presentation (16:9)')).toEqual({ width: 1920, height: 1080 });
      expect(getCanvasPreset('A4 Portrait')).toEqual({ width: 595, height: 842 });
      expect(getCanvasPreset('NonExistent')).toBeNull();
    });
    
    it('should suggest appropriate canvas sizes for project types', () => {
      expect(suggestCanvasSize('presentation')).toEqual({ width: 1920, height: 1080 });
      expect(suggestCanvasSize('flyer')).toEqual({ width: 612, height: 792 });
      expect(suggestCanvasSize('social-media')).toEqual({ width: 1080, height: 1080 });
      expect(suggestCanvasSize('custom')).toEqual({ width: 800, height: 600 });
      expect(suggestCanvasSize('unknown')).toEqual({ width: 800, height: 600 });
    });
    
    it('should have comprehensive canvas presets', () => {
      expect(CANVAS_PRESETS).toHaveProperty('Instagram Post');
      expect(CANVAS_PRESETS).toHaveProperty('Instagram Story');
      expect(CANVAS_PRESETS).toHaveProperty('Facebook Post');
      expect(CANVAS_PRESETS).toHaveProperty('YouTube Thumbnail');
      expect(CANVAS_PRESETS).toHaveProperty('Business Card');
      expect(Object.keys(CANVAS_PRESETS)).toHaveLength(15);
    });
  });
  
  describe('Project Creation Tool Function', () => {
    it('should validate required arguments', async () => {
      // Test missing title
      const result1 = await createProjectTool({});
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('title is required');
      
      // Test missing userId
      const result2 = await createProjectTool({ title: 'Test' });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('User ID is required');
      
      // Test missing canvasSize
      const result3 = await createProjectTool({ title: 'Test', userId: 'user123' });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Canvas size');
    });
    
    it('should accept valid arguments and attempt API call', async () => {
      const validArgs = {
        title: 'Test Project',
        userId: 'test-user-123',
        canvasSize: { width: 800, height: 600 },
        description: 'Test description',
        type: 'presentation',
        category: 'business'
      };
      
      const result = await createProjectTool(validArgs);
      
      // Since the API server isn't running, we expect it to fail with a network error
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/(fetch|ECONNREFUSED|API request failed)/);
      expect(result.message).toContain('Failed to create project');
    });
    
    it('should provide default values for optional fields', async () => {
      // Mock the API call to avoid network requests
      const originalCreateProject = require('../utils/projectApiClient').createProject;
      const mockCreateProject = jest.fn().mockResolvedValue({
        _id: 'mock-project-id',
        title: 'Test Project',
        type: 'custom',
        userId: 'test-user',
        canvasSize: { width: 800, height: 600 },
        createdAt: new Date().toISOString()
      });
      
      // Replace the function temporarily
      require('../utils/projectApiClient').createProject = mockCreateProject;
      
      const minimalArgs = {
        title: 'Minimal Test',
        userId: 'test-user',
        canvasSize: { width: 800, height: 600 }
      };
      
      const result = await createProjectTool(minimalArgs);
      
      expect(result.success).toBe(true);
      expect(result.projectId).toBe('mock-project-id');
      expect(result.title).toBe('Test Project');
      
      // Check that defaults were applied in the API call
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Minimal Test',
          description: '',
          type: 'custom',
          category: '',
          tags: [],
          isTemplate: false,
          canvasSize: expect.objectContaining({
            name: 'Custom',
            width: 800,
            height: 600
          })
        })
      );
      
      // Restore original function
      require('../utils/projectApiClient').createProject = originalCreateProject;
    });
  });
  
  describe('AgentService Integration', () => {
    it('should create AgentService with project creation tool enabled by default', () => {
      // Skip if no OpenAI API key (constructor will fail)
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping AgentService test - no OpenAI API key');
        return;
      }
      
      const agent = new AgentService();
      
      expect(agent.toolDefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            name: 'create_project'
          })
        ])
      );
      
      expect(agent.executors).toHaveProperty('create_project');
      expect(typeof agent.executors['create_project']).toBe('function');
    });
    
    it('should allow disabling project creation tool', () => {
      // Skip if no OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping AgentService test - no OpenAI API key');
        return;
      }
      
      const agent = new AgentService({ enableProjectCreation: false });
      
      expect(agent.toolDefs).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'create_project'
          })
        ])
      );
      
      expect(agent.executors).not.toHaveProperty('create_project');
    });
    
    it('should not duplicate project creation tool if provided manually', () => {
      // Skip if no OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping AgentService test - no OpenAI API key');
        return;
      }
      
      const customProjectTool = {
        type: 'function',
        description: 'Custom project tool',
        execute: async () => ({ custom: true })
      };
      
      const agent = new AgentService({
        tools: {
          create_project: customProjectTool
        }
      });
      
      // Should have only one create_project tool
      const projectTools = agent.toolDefs.filter(t => t.name === 'create_project');
      expect(projectTools).toHaveLength(1);
      expect(projectTools[0].description).toBe('Custom project tool');
      expect(agent.executors['create_project']).toBe(customProjectTool.execute);
    });
  });
  
  describe('Tool Configuration', () => {
    it('should have correct tool definition structure', () => {
      const { TOOL_CONFIG } = require('../config/agentConfig');
      const projectTool = TOOL_CONFIG.CREATE_PROJECT;
      
      expect(projectTool).toBeDefined();
      expect(projectTool.type).toBe('function');
      expect(projectTool.name).toBe('create_project');
      expect(projectTool.description).toContain('Creates a new project');
      expect(projectTool.parameters).toBeDefined();
      expect(projectTool.parameters.required).toEqual(['title', 'userId', 'canvasSize']);
      
      // Check parameter definitions
      const props = projectTool.parameters.properties;
      expect(props.title).toBeDefined();
      expect(props.userId).toBeDefined();
      expect(props.canvasSize).toBeDefined();
      expect(props.canvasSize.properties).toHaveProperty('width');
      expect(props.canvasSize.properties).toHaveProperty('height');
      expect(props.type.enum).toContain('presentation');
      expect(props.type.enum).toContain('flyer');
      expect(props.type.enum).toContain('social-media');
    });
  });
  
  describe('API Configuration', () => {
    it('should have correct API configuration', () => {
      expect(PROJECT_API_CONFIG.BASE_URL).toBeDefined();
      expect(PROJECT_API_CONFIG.ENDPOINTS.PROJECTS).toBe('/api/projects');
      expect(PROJECT_API_CONFIG.DEFAULT_HEADERS['Content-Type']).toBe('application/json');
      expect(PROJECT_API_CONFIG.TIMEOUT).toBeGreaterThan(0);
    });
  });
});
