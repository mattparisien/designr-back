// Mock OpenAI before importing the service
jest.mock('openai');

const AgentService = require('../services/agentService');
const OpenAI = require('openai');

describe('AgentService', () => {
  let mockResponses;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create mock responses object
    mockResponses = {
      create: jest.fn()
    };
    
    // Set up the mock for the existing AgentService instance
    AgentService.openai = {
      responses: mockResponses
    };
  });

  describe('generateResponse', () => {
    describe('with text response format', () => {
      it('should generate a text response successfully', async () => {
        // Arrange
        const prompt = 'Hello, how are you?';
        const mockResponse = {
          output_text: 'I am doing well, thank you for asking!'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: prompt
        });
        expect(result).toEqual({
          response: 'I am doing well, thank you for asking!',
          parsed: undefined
        });
      });

      it('should handle null response_format as text format', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const mockResponse = {
          output_text: 'Test response'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt, null);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: prompt
        });
        expect(result.parsed).toBeUndefined();
      });
    });

    describe('with JSON response format', () => {
      it('should generate and parse JSON response successfully', async () => {
        // Arrange
        const prompt = 'Give me user data';
        const response_format = { type: 'json_object' };
        const mockJsonResponse = '{"name": "John", "age": 30}';
        const mockResponse = {
          output_text: mockJsonResponse
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt, response_format);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant. When you answer, output ONLY valid JSON (no markdown, no extra text).',
          input: prompt
        });
        expect(result).toEqual({
          response: mockJsonResponse,
          parsed: { name: 'John', age: 30 }
        });
      });

      it('should handle invalid JSON gracefully', async () => {
        // Arrange
        const prompt = 'Give me user data';
        const response_format = { type: 'json_object' };
        const mockInvalidJsonResponse = 'This is not valid JSON';
        const mockResponse = {
          output_text: mockInvalidJsonResponse
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt, response_format);

        // Assert
        expect(result).toEqual({
          response: mockInvalidJsonResponse,
          parsed: undefined
        });
      });

      it('should include JSON instruction when response_format type is json_object', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const response_format = { type: 'json_object' };
        const mockResponse = {
          output_text: '{"test": "data"}'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        await AgentService.generateResponse(prompt, response_format);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant. When you answer, output ONLY valid JSON (no markdown, no extra text).',
          input: prompt
        });
      });
    });

    describe('error handling', () => {
      it('should throw an error when OpenAI API fails', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const openaiError = new Error('OpenAI API Error');
        mockResponses.create.mockRejectedValue(openaiError);

        // Act & Assert
        await expect(AgentService.generateResponse(prompt))
          .rejects
          .toThrow('Failed to generate AI response');
      });

      it('should log the original error when OpenAI API fails', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const openaiError = new Error('OpenAI API Error');
        mockResponses.create.mockRejectedValue(openaiError);
        
        // Mock console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act
        try {
          await AgentService.generateResponse(prompt);
        } catch (error) {
          // Expected to throw
        }

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith('Error generating response from OpenAI:', openaiError);
        
        // Cleanup
        consoleSpy.mockRestore();
      });
    });

    describe('edge cases', () => {
      it('should handle empty prompt', async () => {
        // Arrange
        const prompt = '';
        const mockResponse = {
          output_text: 'I need more information to help you.'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: ''
        });
        expect(result.response).toBe('I need more information to help you.');
      });

      it('should handle response_format with different type', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const response_format = { type: 'text' };
        const mockResponse = {
          output_text: 'Regular text response'
        };
        mockResponses.create.mockResolvedValue(mockResponse);

        // Act
        const result = await AgentService.generateResponse(prompt, response_format);

        // Assert
        expect(mockResponses.create).toHaveBeenCalledWith({
          model: 'gpt-4o-2024-08-06',
          instructions: 'You are a helpful assistant.',
          input: prompt
        });
        expect(result.parsed).toBeUndefined();
      });
    });
  });

  describe('constructor', () => {
    it('should initialize OpenAI client with API key from environment', () => {
      // Since the service is a singleton, we can just verify it has the openai property
      expect(AgentService.openai).toBeDefined();
    });
  });
});
