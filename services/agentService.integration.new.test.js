const request = require('supertest');
const express = require('express');
const agentRoutes = require('../routes/agent');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);

describe('Agent Integration Tests (New Architecture)', () => {
  beforeAll(() => {
    // Make sure we have an API key for testing
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set. Integration tests will be skipped.');
    }
  });

  describe('POST /api/agent/generate', () => {
    it('should make a real request to OpenAI and return a response', async () => {
      // Skip test if no API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping integration test - no API key');
        return;
      }

      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: 'Say hello in a friendly way',
          response_format: null
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(typeof response.body.response).toBe('string');
      expect(response.body.response.length).toBeGreaterThan(0);
      
      console.log('✅ Real AI Response:', response.body.response);
    }, 10000); // 10 second timeout for AI response

    it('should make a real request for JSON format', async () => {
      // Skip test if no API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping integration test - no API key');
        return;
      }

      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: 'Return a simple user object with name and age properties',
          response_format: { type: 'json_object' }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('parsed');
      expect(typeof response.body.parsed).toBe('object');
      expect(response.body.parsed).not.toBeNull();
      
      console.log('✅ Real AI JSON Response:', response.body);
    }, 10000); // 10 second timeout for AI response

    it('should handle invalid requests with proper error response', async () => {
      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          // Missing prompt
        });

      // Should return 400 for validation error
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('prompt must be');
      
      console.log('✅ Validation error handled properly:', response.body);
    });
    
    it('should handle invalid response_format with proper error response', async () => {
      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: 'Test prompt',
          response_format: 'invalid_format' // Should be object or null
        });

      // Should return 400 for validation error
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('response_format must be');
      
      console.log('✅ Response format validation handled properly:', response.body);
    });
    
    it('should perform web search and return current information with enhanced logging', async () => {
      // Skip test if no API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping web search integration test - no API key');
        return;
      }

      console.log('🚀 Starting web search test with enhanced logging...');
      
      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: 'What is the current weather in New York City? Please search the web for real-time weather information.',
          response_format: null
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(typeof response.body.response).toBe('string');
      expect(response.body.response.length).toBeGreaterThan(50);
      
      console.log('📏 Response Length:', response.body.response.length);
      console.log('🌐 Full Web Search Results:');
      console.log('='.repeat(80));
      console.log(response.body.response);
      console.log('='.repeat(80));
      
      // Check if response contains current/real-time information indicators
      const hasCurrentInfo = response.body.response.toLowerCase().includes('current') ||
                            response.body.response.toLowerCase().includes('now') ||
                            response.body.response.toLowerCase().includes('today') ||
                            response.body.response.match(/\d{1,2}:\d{2}/) || // time format
                            response.body.response.toLowerCase().includes('weather') ||
                            response.body.response.toLowerCase().includes('temperature');
      
      console.log('⏰ Contains current/real-time info:', hasCurrentInfo);
      console.log('🌡️ Contains weather information:', response.body.response.toLowerCase().includes('weather'));
      
      expect(hasCurrentInfo).toBe(true);
      console.log('✅ Web search test with enhanced logging completed successfully!');
    }, 20000); // 20 second timeout for web search + AI response

    it('should perform web search for recent news and events', async () => {
      // Skip test if no API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping news search integration test - no API key');
        return;
      }

      console.log('📰 Starting news search test...');
      
      const response = await request(app)
        .post('/api/agent/generate')
        .send({
          prompt: 'What are the latest technology news headlines today? Please search the web for recent tech news.',
          response_format: null
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(typeof response.body.response).toBe('string');
      expect(response.body.response.length).toBeGreaterThan(100);
      
      // Check if response contains news-related keywords
      const hasNewsContent = response.body.response.toLowerCase().includes('news') ||
                            response.body.response.toLowerCase().includes('headlines') ||
                            response.body.response.toLowerCase().includes('latest') ||
                            response.body.response.toLowerCase().includes('recent') ||
                            response.body.response.toLowerCase().includes('technology') ||
                            response.body.response.toLowerCase().includes('tech');
      
      console.log('📰 Contains news-related content:', hasNewsContent);
      console.log('📄 News search response preview:', response.body.response.substring(0, 300) + '...');
      
      expect(hasNewsContent).toBe(true);
      console.log('✅ News search test completed successfully!');
    }, 20000); // 20 second timeout for web search + AI response
  });
});
