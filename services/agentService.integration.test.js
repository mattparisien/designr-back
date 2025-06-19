const request = require('supertest');
const express = require('express');
const agentRoutes = require('../routes/agent');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);

describe('Agent Integration Tests', () => {
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
    }, 10000); // 10 second timeout for AI response    it('should handle invalid requests with proper error response', async () => {
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
  });
});
