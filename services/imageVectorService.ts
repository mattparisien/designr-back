import OpenAI from 'openai';
import fs from 'fs';
import axios from 'axios';

class ImageVectorService {
  constructor() {
    this.openai = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI API key not found. Image vector service will be disabled.');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      this.initialized = true;
      console.log('Image vector service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize image vector service:', error);
    }
  }

  /**
   * Generate vector embedding directly from image
   * This is more accurate for visual similarity than text descriptions
   */
  async generateImageEmbedding(imageUrl) {
    if (!this.initialized || !this.openai) {
      console.warn('Image vector service not available');
      return null;
    }

    try {
      // Note: OpenAI doesn't have direct image embedding yet
      // So we'll use CLIP-style approach: image -> description -> embedding
      // But we'll make the description more visual-focused
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and create a detailed visual description focusing on:
                - Visual style and artistic technique
                - Color palette and color relationships
                - Composition and layout
                - Geometric shapes and patterns
                - Texture and visual elements
                - Overall aesthetic and mood
                
                Create a description optimized for finding visually similar images, not just semantically similar content.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for consistent visual descriptions
      });

      const visualDescription = response.choices[0].message.content;
      
      // Generate embedding from the visual-focused description
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: visualDescription,
      });

      return {
        embedding: embeddingResponse.data[0].embedding,
        visualDescription: visualDescription,
        type: 'visual-focused'
      };

    } catch (error) {
      console.error('Error generating image embedding:', error);
      return null;
    }
  }

  /**
   * Alternative: Generate embedding from combined text + image analysis
   * This gives best of both worlds
   */
  async generateHybridEmbedding(imageUrl, textAnalysis) {
    if (!this.initialized || !this.openai) {
      return null;
    }

    try {
      // Combine semantic analysis with visual-focused description
      const visualResult = await this.generateImageEmbedding(imageUrl);
      
      if (!visualResult) return null;

      // Create combined text that emphasizes visual characteristics
      const combinedText = [
        visualResult.visualDescription,
        textAnalysis?.description || '',
        ...(textAnalysis?.objects || []),
        ...(textAnalysis?.colors || []),
        textAnalysis?.style || '',
        textAnalysis?.composition || '',
        textAnalysis?.lighting || ''
      ].filter(Boolean).join(' ');

      // Generate final embedding
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: combinedText,
      });

      return {
        embedding: embeddingResponse.data[0].embedding,
        combinedDescription: combinedText,
        visualDescription: visualResult.visualDescription,
        type: 'hybrid'
      };

    } catch (error) {
      console.error('Error generating hybrid embedding:', error);
      return null;
    }
  }
}

// Export singleton instance
const imageVectorService = new ImageVectorService();
export default imageVectorService;
