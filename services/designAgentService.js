// services/designAgentService.js
// ------------------------------------------------------------
// Design Assistant Agent Service (v2.0.0)
// A class-based service for OpenAI powered design assistance.
// The agent can:
//   • respond conversationally to design questions
//   • provide design suggestions and guidance
//   • remain within strict design-only guard-rails
// ------------------------------------------------------------

const { OpenAI } = require('openai');
const fs = require('fs/promises');
require('dotenv').config();

class DesignAgentService {
  constructor() {
    this.openai = null;
    this.initialized = false;
    this.appName = process.env.APP_NAME || 'Canva Clone';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    // Guard-rail constants
    this.forbiddenTopics = [
      'politics',
      'election',
      'covid',
      'virus',
      'medical',
      'doctor',
      'medicine',
      'legal advice',
      'lawyer',
      'law',
      'financial advice',
      'investment',
      'crypto',
      'hack',
      'password',
      'personal information',
      'private data',
    ];

    this.designKeywords = [
      'logo',
      'poster',
      'flyer',
      'social media',
      'presentation',
      'banner',
      'branding',
      'colour',
      'color',
      'font',
      'layout',
      'template',
      'design',
      'create',
      'make',
      'build',
      'marketing',
      'business card',
      'invitation',
      'card',
    ];
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️ OPENAI_API_KEY not found. Design agent will be disabled.');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.initialized = true;
      console.log('✅ Design Agent service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Design Agent service:', error);
    }
  }

  /**
   * Get the system message for the design assistant
   */
  getSystemMessage() {
    return `You are a Design Assistant for a Canva-like design platform named "${this.appName}".
Your entire purpose is to help users with *design-related* tasks inside this application.

Strict rules:
1. Only discuss design topics (logos, presentations, social posts, flyers, colour schemes, typography, branding, layouts, etc.).
2. Only assist with platform features (templates, editing elements, managing assets, fonts, colours).
3. If the user asks about non-design topics or forbidden areas (${this.forbiddenTopics.join(', ')}), reply exactly with:
   "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?"
4. Respond concisely and helpfully. Offer concrete next steps (e.g. "Browse presentation templates", "Apply brand colours").
5. Always provide helpful suggestions for design actions the user can take.`;
  }

  /**
   * Check if text contains forbidden topics
   */
  containsForbiddenTopic(text) {
    const lower = text.toLowerCase();
    return this.forbiddenTopics.some(topic => lower.includes(topic));
  }

  /**
   * Check if text contains design keywords
   */
  containsDesignKeyword(text) {
    const lower = text.toLowerCase();
    return this.designKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Generate design suggestions based on user input
   */
  generateSuggestions(text) {
    const suggestions = [
      'Browse templates',
      'Choose a colour palette',
      'Upload assets',
      'Start from scratch',
    ];

    if (/logo|branding/i.test(text)) {
      return [
        'Browse logo templates',
        'Choose brand colours',
        'Upload brand assets',
        'Start with a text-only logo',
      ];
    }

    if (/social\s*media|facebook|instagram|twitter|tiktok/i.test(text)) {
      return [
        'Browse social templates',
        'Select post size',
        'Add trending hashtags',
        'Use brand colours',
      ];
    }

    if (/presentation|slides?/i.test(text)) {
      return [
        'Browse presentation templates',
        'Pick slide layouts',
        'Add subtle animations',
        'Apply company branding',
      ];
    }

    return suggestions;
  }

  /**
   * Chat with the design agent
   */
  async chat(userText, useOwnData = false) {
    if (!this.initialized || !this.openai) {
      return this.getFallbackResponse(userText, useOwnData);
    }

    // Check for forbidden topics
    if (this.containsForbiddenTopic(userText)) {
      return {
        assistant_text: "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?",
        suggestions: this.generateSuggestions(''),
        action: 'none',
      };
    }

    try {
      const messages = [
        { role: 'system', content: this.getSystemMessage() },
        { 
          role: 'user', 
          content: `User message: "${userText}". ${useOwnData ? 'The user wants to use personal assets and brand guidelines.' : 'The user is not using personal assets.'}` 
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;

      return {
        assistant_text: response,
        suggestions: this.generateSuggestions(userText),
        action: this.determineAction(userText),
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getFallbackResponse(userText, useOwnData);
    }
  }

  /**
   * Determine the appropriate action based on user input
   */
  determineAction(text) {
    if (/template|browse/i.test(text)) return 'open_template';
    if (/brand|branding/i.test(text)) return 'apply_brand';
    if (/upload|asset/i.test(text)) return 'upload_asset';
    return 'none';
  }

  /**
   * Generate fallback response when OpenAI is not available
   */
  getFallbackResponse(text, useOwnData) {
    if (this.containsDesignKeyword(text)) {
      const extras = useOwnData ? 'I\'ll use your brand assets. ' : '';
      return {
        assistant_text: `Great! ${extras}Let me suggest some design approaches for your "${text}". Would you like recommended templates or colour schemes to get started?`,
        suggestions: this.generateSuggestions(text),
        action: this.determineAction(text),
      };
    }

    return {
      assistant_text: `I can help you turn that idea into a beautiful design! ${useOwnData ? 'Using your personal assets, ' : ''}start by choosing a template – a social media post, presentation, flyer, or something else?`,
      suggestions: this.generateSuggestions(''),
      action: 'none',
    };
  }

  /**
   * Health check for the service
   */
  getHealthStatus() {
    return {
      initialized: this.initialized,
      hasOpenAI: !!this.openai,
      model: this.model,
      appName: this.appName,
    };
  }
}

module.exports = DesignAgentService;
