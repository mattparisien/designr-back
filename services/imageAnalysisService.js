
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ImageAnalysisService {
  constructor() {
    this.openai = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI API key not found. Image analysis will be disabled.');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      this.initialized = true;
      console.log('Image analysis service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize image analysis service:', error);
    }
  }

  /**
   * Analyze image content using OpenAI Vision API
   * @param {string} imageUrl - URL of the image to analyze
   * @returns {Object} Analysis results containing description, objects, colors, themes, etc.
   */
  async analyzeImage(imageUrl) {
    if (!this.initialized || !this.openai) {
      console.warn('Image analysis service not available');
      return null;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Using gpt-4o-mini for vision capabilities
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this image and provide detailed information about its visual content. Return a JSON object with the following structure:
{
  "description": "A detailed description of what's in the image",
  "objects": ["list", "of", "detected", "objects"],
  "colors": ["dominant", "color", "names"],
  "themes": ["visual", "themes", "or", "concepts"],
  "mood": "overall mood or atmosphere",
  "style": "artistic style or visual characteristics",
  "text": "any text visible in the image",
  "categories": ["broader", "category", "classifications"],
  "composition": "description of layout and composition",
  "lighting": "description of lighting conditions",
  "setting": "location or environment if identifiable"
}

Focus on providing keywords and descriptions that would be useful for semantic search. Be specific about objects, colors, and visual elements.`
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
        max_tokens: 1000,
        temperature: 0.3 // Lower temperature for more consistent results
      });

      const analysisText = response.choices[0].message.content;
      
      // Try to parse the JSON response
      let analysis;
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback if no JSON structure is found
          analysis = {
            description: analysisText,
            objects: [],
            colors: [],
            themes: [],
            mood: "",
            style: "",
            text: "",
            categories: [],
            composition: "",
            lighting: "",
            setting: ""
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse AI analysis as JSON, using raw text:', parseError);
        analysis = {
          description: analysisText,
          objects: [],
          colors: [],
          themes: [],
          mood: "",
          style: "",
          text: "",
          categories: [],
          composition: "",
          lighting: "",
          setting: ""
        };
      }

      // Ensure all expected fields exist
      const defaultAnalysis = {
        description: "",
        objects: [],
        colors: [],
        themes: [],
        mood: "",
        style: "",
        text: "",
        categories: [],
        composition: "",
        lighting: "",
        setting: ""
      };

      return { ...defaultAnalysis, ...analysis };

    } catch (error) {
      console.error('Error analyzing image:', error);
      return null;
    }
  }

  /**
   * Analyze image from local file path
   * @param {string} filePath - Local path to the image file
   * @returns {Object} Analysis results
   */
  async analyzeLocalImage(filePath) {
    if (!this.initialized || !this.openai) {
      console.warn('Image analysis service not available');
      return null;
    }

    try {
      // Read the image file and convert to base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromFile(filePath);
      
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      
      return await this.analyzeImage(dataUrl);
    } catch (error) {
      console.error('Error analyzing local image:', error);
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} filePath - Path to the file
   * @returns {string} MIME type
   */
  getMimeTypeFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Create searchable text from analysis results
   * @param {Object} analysis - Analysis results from analyzeImage
   * @returns {string} Searchable text for vectorization
   */
  createSearchableTextFromAnalysis(analysis) {
    if (!analysis) return '';

    const searchableElements = [
      analysis.description,
      ...(analysis.objects || []),
      ...(analysis.colors || []),
      ...(analysis.themes || []),
      analysis.mood,
      analysis.style,
      analysis.text,
      ...(analysis.categories || []),
      analysis.composition,
      analysis.lighting,
      analysis.setting
    ];

    return searchableElements
      .filter(element => element && typeof element === 'string' && element.trim())
      .join(' ')
      .toLowerCase();
  }

  /**
   * Extract color palette from analysis
   * @param {Object} analysis - Analysis results
   * @returns {Array} Array of color names
   */
  extractColorPalette(analysis) {
    if (!analysis || !analysis.colors) return [];
    return analysis.colors.filter(color => color && typeof color === 'string');
  }

  /**
   * Extract themes and categories for better organization
   * @param {Object} analysis - Analysis results
   * @returns {Object} Organized themes and categories
   */
  extractThemesAndCategories(analysis) {
    if (!analysis) return { themes: [], categories: [] };
    
    return {
      themes: (analysis.themes || []).filter(theme => theme && typeof theme === 'string'),
      categories: (analysis.categories || []).filter(cat => cat && typeof cat === 'string')
    };
  }
}

// Export singleton instance
const imageAnalysisService = new ImageAnalysisService();
module.exports = imageAnalysisService;
