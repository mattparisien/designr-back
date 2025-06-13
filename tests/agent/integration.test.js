// Integration tests for the Project Agent Service
const ProjectAgentService = require('../../services/projectAgentService');
const { mockVectorStore, mockImageAnalysis, mockFetchJson } = require('./setup');

// Mock the agent builder and dependencies
jest.mock('../../agent/index', () => ({
  buildAgent: jest.fn()
}));

jest.mock('../../services/vectorStore', () => mockVectorStore);
jest.mock('../../services/imageAnalysisService', () => mockImageAnalysis);

describe('Project Agent Service Integration', () => {
  let agentService;
  let mockAgent;

  beforeEach(async () => {
    // Mock the built agent
    mockAgent = {
      tools: [
        { name: 'search_assets' },
        { name: 'search_documents' },
        { name: 'analyze_image' },
        { name: 'create_presentation' },
        { name: 'create_social_media_project' },
        { name: 'create_print_project' },
        { name: 'create_custom_project' },
        { name: 'list_project_types' }
      ]
    };

    const { buildAgent } = require('../../agent/index');
    buildAgent.mockResolvedValue(mockAgent);

    agentService = new ProjectAgentService();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully with all dependencies', async () => {
      await agentService.initialize();
      
      const { buildAgent } = require('../../agent/index');
      expect(buildAgent).toHaveBeenCalledWith({
        vectorStore: mockVectorStore,
        imageAnalysis: mockImageAnalysis
      });
    });

    test('should handle missing OpenAI API key gracefully', async () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await agentService.initialize();
      
      // Should not throw, just log a warning
      expect(true).toBe(true); // Test passes if no error thrown

      // Restore API key
      if (originalApiKey) {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });

    test('should provide correct health status', async () => {
      await agentService.initialize();
      
      const health = agentService.getHealthStatus();
      expect(health).toHaveProperty('initialized', true);
      expect(health).toHaveProperty('vectorStoreReady', true);
      expect(health).toHaveProperty('imageAnalysisReady', true);
      expect(health).toHaveProperty('tools');
      expect(Array.isArray(health.tools)).toBe(true);
    });
  });

  describe('Chat Functionality', () => {
    beforeEach(async () => {
      // Mock the requireDynamic function
      jest.doMock('../../utils/dynamicImports', () => ({
        requireDynamic: jest.fn().mockResolvedValue({
          run: jest.fn().mockResolvedValue({
            finalOutput: 'Mocked response',
            newItems: [],
            traceId: 'mock-trace-123'
          }),
          user: jest.fn(content => ({ role: 'user', content })),
          assistant: jest.fn(content => ({ role: 'assistant', content })),
          system: jest.fn(content => ({ role: 'system', content })),
          RunToolCallOutputItem: class MockItem {}
        })
      }));

      await agentService.initialize();
    });

    test('should handle simple chat request', async () => {
      const result = await agentService.chat('Hello, can you help me create a presentation?', {
        userId: 'test-user-123'
      });

      expect(result).toHaveProperty('assistant_text');
      expect(result).toHaveProperty('toolOutputs');
      expect(result).toHaveProperty('traceId');
      expect(typeof result.assistant_text).toBe('string');
    });

    test('should handle chat with conversation history', async () => {
      const conversationHistory = [
        { role: 'user', content: 'I need help with a design project' },
        { role: 'assistant', content: 'I can help you create various design projects. What type are you looking for?' }
      ];

      const result = await agentService.chatWithHistory(
        'I want to create an Instagram post for my coffee shop',
        conversationHistory,
        { userId: 'test-user-123' }
      );

      expect(result).toHaveProperty('assistant_text');
      expect(result).toHaveProperty('toolOutputs');
      expect(result).toHaveProperty('traceId');
    });

    test('should handle errors gracefully', async () => {
      // Mock an error in the run function
      const { requireDynamic } = require('../../utils/dynamicImports');
      requireDynamic.mockResolvedValue({
        run: jest.fn().mockRejectedValue(new Error('Mock error')),
        user: jest.fn(),
        system: jest.fn(),
        RunToolCallOutputItem: class MockItem {}
      });

      const result = await agentService.chat('This should fail', {
        userId: 'test-user-123'
      });

      expect(result).toHaveProperty('error');
      expect(result.assistant_text).toContain('encountered an error');
    });
  });

  describe('Tool Integration Scenarios', () => {
    beforeEach(async () => {
      // Setup comprehensive mock for tool execution
      const mockToolOutputs = {
        search_assets: [
          { id: 'asset1', name: 'logo.png', similarity: 0.95 }
        ],
        create_social_media_project: {
          success: true,
          project: {
            id: 'project-123',
            title: 'Instagram Post',
            type: 'social-media',
            platform: 'Instagram',
            format: 'post'
          }
        },
        analyze_image: {
          colors: ['#FF5733', '#33FF57'],
          objects: ['coffee', 'cup'],
          description: 'A coffee cup on a wooden table'
        }
      };

      jest.doMock('../../utils/dynamicImports', () => ({
        requireDynamic: jest.fn().mockResolvedValue({
          run: jest.fn().mockResolvedValue({
            finalOutput: 'I\'ve created your Instagram post project successfully!',
            newItems: [
              {
                rawItem: { name: 'create_social_media_project', status: 'completed' },
                output: JSON.stringify(mockToolOutputs.create_social_media_project)
              }
            ],
            traceId: 'integration-test-123'
          }),
          user: jest.fn(content => ({ role: 'user', content })),
          system: jest.fn(content => ({ role: 'system', content })),
          RunToolCallOutputItem: class MockItem {
            constructor(rawItem, output) {
              this.rawItem = rawItem;
              this.output = output;
            }
          }
        })
      }));

      await agentService.initialize();
    });

    test('should handle Instagram post creation workflow', async () => {
      mockFetchJson.mockResolvedValue({
        _id: 'project-instagram-123',
        title: 'Coffee Shop Promotion',
        type: 'social-media',
        category: 'marketing',
        canvasSize: { width: 1080, height: 1080 }
      });

      const result = await agentService.chat(
        'Create an Instagram post for promoting my coffee shop\'s new blend',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
      expect(result.toolOutputs).toHaveProperty('create_social_media_project');
    });

    test('should handle asset search and analysis workflow', async () => {
      mockVectorStore.searchAssets.mockResolvedValue([
        { id: 'asset1', name: 'coffee-beans.jpg', similarity: 0.92 }
      ]);

      mockImageAnalysis.analyzeImage.mockResolvedValue({
        colors: ['#8B4513', '#D2691E'],
        objects: ['coffee beans', 'texture'],
        mood: 'warm'
      });

      const result = await agentService.chat(
        'Find coffee-related images and analyze their colors',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
      // Tools should be called by the agent
    });

    test('should handle presentation creation with document search', async () => {
      mockVectorStore.searchDocumentChunks.mockResolvedValue([
        {
          id: 'doc1',
          title: 'Brand Guidelines',
          content: 'Our brand colors are blue and white...',
          score: 0.88
        }
      ]);

      mockFetchJson.mockResolvedValue({
        _id: 'project-presentation-456',
        title: 'Company Overview',
        type: 'presentation',
        canvasSize: { width: 1920, height: 1080 }
      });

      const result = await agentService.chat(
        'Create a presentation about our company and use our brand guidelines',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
    });

    test('should handle print project creation', async () => {
      mockFetchJson.mockResolvedValue({
        _id: 'project-print-789',
        title: 'Business Flyer',
        type: 'print',
        category: 'marketing',
        canvasSize: { width: 2480, height: 3508 }
      });

      const result = await agentService.chat(
        'Create an A4 flyer for our upcoming event',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
    });

    test('should handle custom project creation', async () => {
      mockFetchJson.mockResolvedValue({
        _id: 'project-custom-101',
        title: 'Custom Web Banner',
        type: 'custom',
        canvasSize: { width: 1200, height: 400 }
      });

      const result = await agentService.chat(
        'Create a custom web banner that is 1200x400 pixels',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle tool execution errors', async () => {
      jest.doMock('../../utils/dynamicImports', () => ({
        requireDynamic: jest.fn().mockResolvedValue({
          run: jest.fn().mockResolvedValue({
            finalOutput: 'I encountered an issue creating the project.',
            newItems: [
              {
                rawItem: { name: 'create_social_media_project', status: 'failed' },
                output: JSON.stringify({
                  success: false,
                  error: 'API Error'
                })
              }
            ],
            traceId: 'error-test-123'
          }),
          user: jest.fn(content => ({ role: 'user', content })),
          system: jest.fn(content => ({ role: 'system', content })),
          RunToolCallOutputItem: class MockItem {
            constructor(rawItem, output) {
              this.rawItem = rawItem;
              this.output = output;
            }
          }
        })
      }));

      await agentService.initialize();

      const result = await agentService.chat(
        'Create a project that will fail',
        { userId: 'test-user-123' }
      );

      expect(result.assistant_text).toBeDefined();
      // Should handle gracefully without throwing
    });

    test('should handle uninitialized agent calls', async () => {
      const uninitializedService = new ProjectAgentService();
      
      const result = await uninitializedService.chat(
        'This should work without initialization',
        { userId: 'test-user-123' }
      );

      // Should auto-initialize or provide fallback response
      expect(result).toHaveProperty('assistant_text');
    });

    test('should handle empty or invalid user input', async () => {
      await agentService.initialize();

      const emptyResult = await agentService.chat('', { userId: 'test-user-123' });
      expect(emptyResult).toHaveProperty('assistant_text');

      const spaceResult = await agentService.chat('   ', { userId: 'test-user-123' });
      expect(spaceResult).toHaveProperty('assistant_text');
    });

    test('should handle missing userId', async () => {
      await agentService.initialize();

      const result = await agentService.chat('Create a presentation');
      expect(result).toHaveProperty('assistant_text');
      // Should handle gracefully with anonymous user
    });
  });

  describe('Performance and Resource Management', () => {
    test('should not re-initialize if already initialized', async () => {
      await agentService.initialize();
      const { buildAgent } = require('../../agent/index');
      const callCount = buildAgent.mock.calls.length;

      await agentService.initialize();
      expect(buildAgent.mock.calls.length).toBe(callCount); // No additional calls
    });

    test('should handle multiple concurrent chat requests', async () => {
      await agentService.initialize();

      const promises = Array.from({ length: 5 }, (_, i) =>
        agentService.chat(`Create project ${i}`, { userId: `user-${i}` })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('assistant_text');
      });
    });
  });
});
