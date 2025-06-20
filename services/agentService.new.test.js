// Mock OpenAI before importing the service
jest.mock('openai');

const AgentService = require('../services/agentService');
const OpenAI = require('openai');

describe('AgentService (New Architecture)', () => {
  let mockResponses;
  let agentService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create mock responses object
    mockResponses = {
      create: jest.fn()
    };
    
    // Mock the OpenAI constructor to return our mock
    OpenAI.mockImplementation(() => ({
      responses: mockResponses
    }));

    // Create a fresh instance for each test (with web search disabled for predictable testing)
    agentService = new AgentService({ enableWebSearch: false });
  });

  describe('constructor', () => {
    it('should initialize with no tools by default but include web search', () => {
      const service = new AgentService();
      expect(service.toolDefs).toHaveLength(1);
      expect(service.toolDefs[0]).toEqual({ type: 'web_search' });
      expect(service.executors).toEqual({});
    });

    it('should initialize with web search disabled', () => {
      const service = new AgentService({ enableWebSearch: false });
      expect(service.toolDefs).toEqual([]);
      expect(service.executors).toEqual({});
    });

    it('should initialize with function tools and keep web search', () => {
      const tools = {
        test_function: {
          type: 'function',
          description: 'A test function',
          parameters: { type: 'object' },
          execute: jest.fn()
        }
      };
      
      const service = new AgentService({ tools });
      
      expect(service.toolDefs).toHaveLength(2);
      expect(service.toolDefs[0]).toEqual({ type: 'web_search' });
      expect(service.toolDefs[1]).toEqual({
        type: 'function',
        name: 'test_function',
        description: 'A test function',
        parameters: { type: 'object' },
        strict: true
      });
      expect(service.executors.test_function).toBe(tools.test_function.execute);
    });

    it('should not duplicate web search if user provides one', () => {
      const tools = {
        web_search: { type: 'web_search' }
      };
      
      const service = new AgentService({ tools });
      
      expect(service.toolDefs).toHaveLength(1);
      expect(service.toolDefs[0]).toEqual({ type: 'web_search' });
    });

    it('should initialize with built-in tools', () => {
      const tools = {
        file_search: { type: 'file_search' }
      };
      
      const service = new AgentService({ tools });
      
      expect(service.toolDefs).toHaveLength(2);
      expect(service.toolDefs[0]).toEqual({ type: 'web_search' });
      expect(service.toolDefs[1]).toEqual({ type: 'file_search' });
      expect(service.executors.file_search).toBeUndefined();
    });
  });

  describe('generateResponse', () => {
    describe('basic functionality', () => {
      it('should generate a text response successfully', async () => {
        // Arrange
        const prompt = 'Hello, how are you?';
        const mockResponse = {
          id: 'resp_123',
          output: [],
          output_text: 'I am doing well, thank you for asking!'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await agentService.generateResponse(prompt);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: prompt,
          tools: [],
          tool_choice: 'auto'
        });
        expect(result).toEqual({
          response: 'I am doing well, thank you for asking!',
          parsed: undefined
        });
      });

      it('should handle JSON response format', async () => {
        // Arrange
        const prompt = 'Give me user data';
        const response_format = { type: 'json_object' };
        const mockJsonResponse = '{"name": "John", "age": 30}';
        const mockResponse = {
          id: 'resp_123',
          output: [],
          output_text: mockJsonResponse
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await agentService.generateResponse(prompt, { response_format });

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant. Return ONLY valid JSON (no markdown).',
          input: prompt,
          tools: [],
          tool_choice: 'auto'
        });
        expect(result).toEqual({
          response: mockJsonResponse,
          parsed: { name: 'John', age: 30 }
        });
      });
    });

    describe('tool execution', () => {
      let serviceWithTools;
      let mockExecutor;

      beforeEach(() => {
        mockExecutor = jest.fn();
        const tools = {
          test_tool: {
            type: 'function',
            description: 'A test tool',
            parameters: { type: 'object' },
            execute: mockExecutor
          }
        };
        serviceWithTools = new AgentService({ tools, enableWebSearch: false });
      });

      it('should handle tool calls and execute them', async () => {
        // Arrange
        const prompt = 'Use a tool';
        
        // First response with tool call
        const firstResponse = {
          id: 'resp_123',
          output: [{
            type: 'tool_call',
            id: 'call_123',
            name: 'test_tool',
            arguments: '{"arg1": "value1"}'
          }],
          output_text: ''
        };
        
        // Second response after tool execution
        const secondResponse = {
          id: 'resp_456',
          output: [],
          output_text: 'Tool executed successfully!'
        };

        mockResponses.create
          .mockResolvedValueOnce(firstResponse)
          .mockResolvedValueOnce(secondResponse);
        
        mockExecutor.mockResolvedValue({ result: 'success' });

        // Act
        const result = await serviceWithTools.generateResponse(prompt);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledTimes(2);
        
        // First call
        expect(mockResponses.create).toHaveBeenNthCalledWith(1, {
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: prompt,
          tools: [{
            type: 'function',
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object' },
            strict: true
          }],
          tool_choice: 'auto'
        });

        // Second call with tool results
        expect(mockResponses.create).toHaveBeenNthCalledWith(2, {
          model: 'gpt-4o-2024-08-06',
          input: [{
            type: 'function_call_output',
            call_id: 'call_123',
            output: '{"result":"success"}'
          }],
          previous_response_id: 'resp_123'
        });

        expect(mockExecutor).toHaveBeenCalledWith({ arg1: 'value1' });
        expect(result).toEqual({
          response: 'Tool executed successfully!',
          parsed: undefined
        });
      });

      it('should handle tool execution errors gracefully', async () => {
        // Arrange
        const prompt = 'Use a tool';
        
        const firstResponse = {
          id: 'resp_123',
          output: [{
            type: 'tool_call',
            id: 'call_123',
            name: 'test_tool',
            arguments: '{"arg1": "value1"}'
          }],
          output_text: ''
        };
        
        const secondResponse = {
          id: 'resp_456',
          output: [],
          output_text: 'Tool execution failed, but I handled it gracefully.'
        };

        mockResponses.create
          .mockResolvedValueOnce(firstResponse)
          .mockResolvedValueOnce(secondResponse);
        
        mockExecutor.mockRejectedValue(new Error('Tool failed'));

        // Act
        const result = await serviceWithTools.generateResponse(prompt);

        // Assert
        expect(mockResponses.create).toHaveBeenNthCalledWith(2, {
          model: 'gpt-4o-2024-08-06',
          input: [{
            type: 'function_call_output',
            call_id: 'call_123',
            output: '{"error":"Tool failed"}'
          }],
          previous_response_id: 'resp_123'
        });

        expect(result.response).toBe('Tool execution failed, but I handled it gracefully.');
      });

      it('should respect maxSteps limit', async () => {
        // Arrange
        const prompt = 'Use tools repeatedly';
        
        // Always return a tool call to create infinite loop
        const responseWithTool = {
          id: 'resp_123',
          output: [{
            type: 'tool_call',
            id: 'call_123',
            name: 'test_tool',
            arguments: '{}'
          }],
          output_text: ''
        };

        mockResponses.create.mockResolvedValue(responseWithTool);
        mockExecutor.mockResolvedValue({ result: 'success' });

        // Act
        const result = await serviceWithTools.generateResponse(prompt, { maxSteps: 2 });

        // Assert - should call exactly 3 times (initial + 2 tool steps)
        expect(mockResponses.create).toHaveBeenCalledTimes(3);
        expect(mockExecutor).toHaveBeenCalledTimes(2);
      });
    });

    describe('validation', () => {
      it('should throw error for missing prompt', async () => {
        await expect(agentService.generateResponse())
          .rejects
          .toThrow('prompt must be a non-empty string');
      });

      it('should throw error for empty prompt', async () => {
        await expect(agentService.generateResponse(''))
          .rejects
          .toThrow('prompt must be a non-empty string');
      });

      it('should throw error for non-string prompt', async () => {
        await expect(agentService.generateResponse(123))
          .rejects
          .toThrow('prompt must be a non-empty string');
      });

      it('should throw error for invalid response_format', async () => {
        await expect(agentService.generateResponse('test', { response_format: 'invalid' }))
          .rejects
          .toThrow('response_format must be an object or null');
      });
    });

    describe('error handling', () => {
      it('should throw error when OpenAI API fails', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const openaiError = new Error('OpenAI API Error');
        mockResponses.create.mockRejectedValue(openaiError);

        // Act & Assert
        await expect(agentService.generateResponse(prompt))
          .rejects
          .toThrow('OpenAI API Error');
      });
    });
  });
});
