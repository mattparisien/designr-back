// System message that defines the guardrails for the AI assistant
const SYSTEM_MESSAGE = `You are a Design Assistant for a Canva-like design platform called "Canva Clone". Your ONLY purpose is to help users with design-related tasks within this application.

STRICT RULES - YOU MUST FOLLOW THESE:
1. ONLY discuss design topics: logos, presentations, social media posts, flyers, posters, banners, marketing materials, branding, color schemes, layouts, typography
2. ONLY help with features available in design tools: creating designs, editing elements, choosing templates, managing assets, organizing projects, working with fonts and colors
3. REFUSE to answer questions about: politics, personal advice, medical advice, legal advice, financial advice, programming (except design tool features), other software platforms, current events, controversial topics
4. If asked about anything outside design/creative work, respond: "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?"
5. Always be helpful, encouraging, and focused on the user's creative goals
6. Suggest specific design actions they can take within the platform

Remember: You exist ONLY to help with design and creative tasks within this design platform. Stay focused on that mission.`;

// Send message to chat assistant
exports.sendMessage = async (req, res) => {
  try {
    const { message, useOwnData } = req.body;

    // Basic validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        message: 'Message is required and must be a non-empty string'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        message: 'Message too long. Please keep messages under 1000 characters.'
      });
    }

    // Guard against potentially harmful content
    const lowercaseMessage = message.toLowerCase();
    const forbiddenTopics = [
      'politics', 'election', 'covid', 'virus', 'medical', 'doctor', 'medicine',
      'legal advice', 'lawyer', 'law', 'financial advice', 'investment', 'crypto',
      'hack', 'password', 'personal information', 'private data'
    ];

    const containsForbiddenTopic = forbiddenTopics.some(topic => 
      lowercaseMessage.includes(topic)
    );

    if (containsForbiddenTopic) {
      return res.status(200).json({
        response: "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?",
        timestamp: new Date(),
        useOwnData: false,
        suggestions: [
          "Create a social media post",
          "Design a presentation", 
          "Make a logo",
          "Create a flyer"
        ]
      });
    }

    // Check for design-related keywords
    const designKeywords = [
      'logo', 'poster', 'flyer', 'social media', 'presentation', 'banner',
      'branding', 'color', 'font', 'layout', 'template', 'design', 'create',
      'make', 'build', 'marketing', 'business card', 'invitation', 'card'
    ];

    const containsDesignKeyword = designKeywords.some(keyword => 
      lowercaseMessage.includes(keyword)
    );

    let response;
    let suggestions = [
      "Browse templates",
      "Choose colors", 
      "Upload assets",
      "Start from scratch"
    ];

    if (containsDesignKeyword) {
      response = `Great! I'd love to help you create that. ${useOwnData ? "I'll use your personal assets and brand guidelines. " : ""}Let me suggest some design approaches for your "${message}". Would you like me to recommend some templates or color schemes to get started?`;
      
      // More specific suggestions based on the request
      if (lowercaseMessage.includes('logo')) {
        suggestions = ["Browse logo templates", "Choose brand colors", "Upload brand assets", "Start with text logo"];
      } else if (lowercaseMessage.includes('social media')) {
        suggestions = ["Browse social templates", "Choose post size", "Add trending hashtags", "Use brand colors"];
      } else if (lowercaseMessage.includes('presentation')) {
        suggestions = ["Browse presentation templates", "Choose slide layouts", "Add animations", "Use company branding"];
      }
    } else {
      response = `I can help you turn that idea into a beautiful design! ${useOwnData ? "Using your personal assets, " : ""}I suggest we start with choosing a template. What type of design are you thinking - a social media post, presentation, flyer, or something else?`;
    }

    res.status(200).json({
      response,
      timestamp: new Date(),
      useOwnData: useOwnData || false,
      suggestions
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      message: 'Sorry, I encountered an error. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Health check for the chat system
exports.healthCheck = async (req, res) => {
  try {
    res.status(200).json({
      status: 'operational',
      service: 'Design Assistant Chat',
      timestamp: new Date(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Chat health check error:', error);
    res.status(500).json({
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
