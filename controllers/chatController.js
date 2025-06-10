// controllers/chatControllerImproved.js
// ------------------------------------------------------------
// Design‑Assistant chat controller
// A robust, secure wrapper around the OpenAI chat API that enforces
// strict design‑only guard‑rails for a Canva‑like platform.
// ------------------------------------------------------------

/* eslint-disable no-console */

const OpenAI = require('openai');
const { StatusCodes } = require('http-status-codes');
require('dotenv').config();

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const CONFIG = {
  APP_NAME: process.env.APP_NAME || 'Canva Clone',
  MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  MAX_MESSAGE_LENGTH: 1000,
  MAX_TOKENS: 200,
};

// ------------------------------------------------------------
// System Prompt – design‑only guardrails
// ------------------------------------------------------------

const SYSTEM_MESSAGE = `You are a Design Assistant for a Canva‑like design platform named *${CONFIG.APP_NAME}*.
Your *only* purpose is to help users with design‑related tasks **inside this application**.

# Strict rules – you must follow:
1. **Only** discuss design topics — e.g. logos, presentations, social media posts, flyers, posters, banners, marketing materials, branding, colour schemes, layouts, typography.
2. **Only** assist with platform features — e.g. creating designs, editing elements, choosing templates, managing assets, organising projects, working with fonts & colours.
3. **Refuse** any request about politics, personal/medical/legal/financial advice, programming (except design‑tool features), other software, current events, or controversial issues.
4. When asked about non‑design topics, reply *exactly* with:
   "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?"
5. Remain helpful, encouraging, and laser‑focused on the user's creative goals.
6. Suggest concrete design actions they can take within the platform.
`;

// ------------------------------------------------------------
// Keyword & topic reference data
// ------------------------------------------------------------

const FORBIDDEN_TOPICS = new Set([
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
]);

const DESIGN_KEYWORDS = [
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

// Map of keyword‑regex → contextual suggestion lists
const SUGGESTIONS_MAP = [
  {
    test: /logo|branding/i,
    suggestions: [
      'Browse logo templates',
      'Choose brand colours',
      'Upload brand assets',
      'Start with a text‑only logo',
    ],
  },
  {
    test: /social\s*media|facebook|instagram|twitter|tiktok/i,
    suggestions: [
      'Browse social templates',
      'Select post size',
      'Add trending hashtags',
      'Use brand colours',
    ],
  },
  {
    test: /presentation|slides?/i,
    suggestions: [
      'Browse presentation templates',
      'Pick slide layouts',
      'Add subtle animations',
      'Apply company branding',
    ],
  },
];

const DEFAULT_SUGGESTIONS = [
  'Browse templates',
  'Choose a colour palette',
  'Upload assets',
  'Start from scratch',
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Normalise text for case‑insensitive comparison. */
const normalise = (text = '') => text.toLowerCase();

/** Quick forbidden‑topic scan (O(n) but small n). */
function containsForbiddenTopic(text) {
  const lower = normalise(text);
  return Array.from(FORBIDDEN_TOPICS).some((topic) => lower.includes(topic));
}

/** Does the message appear design‑related? */
function containsDesignKeyword(text) {
  const lower = normalise(text);
  return DESIGN_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Return the first matching suggestion set or the default. */
function generateSuggestions(text) {
  for (const entry of SUGGESTIONS_MAP) {
    if (entry.test.test(text)) return entry.suggestions;
  }
  return DEFAULT_SUGGESTIONS;
}

/** Fallback response when the OpenAI call fails or model unavailable. */
function buildFallback(text, useOwnData) {
  if (containsDesignKeyword(text)) {
    const extras = useOwnData ? 'I’ll use your brand assets. ' : '';
    return `Great! ${extras}Let me suggest some design approaches for your “${text}”. Would you like recommended templates or colour schemes to get started?`;
  }
  return `I can help you turn that idea into a beautiful design! ${useOwnData ? 'Using your personal assets, ' : ''}start by choosing a template – a social media post, presentation, flyer, or something else?`;
}

// ------------------------------------------------------------
// OpenAI initialisation (done once at module load‑time)
// ------------------------------------------------------------

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.info('✅ OpenAI client initialised');
  } catch (err) {
    console.error('❌ Failed to initialise OpenAI:', err.message);
  }
} else {
  console.warn('⚠️  OPENAI_API_KEY not set – falling back to local responses.');
}

// ------------------------------------------------------------
// Controller: POST /chat/send‑message
// ------------------------------------------------------------

exports.sendMessage = async (req, res) => {
  const { message = '', useOwnData = false } = req.body || {};

  // Basic validation – keep responses early‑exit & clear
  if (typeof message !== 'string' || !message.trim()) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: '“message” must be a non‑empty string.' });
  }
  if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: `Message exceeds ${CONFIG.MAX_MESSAGE_LENGTH} characters.` });
  }

  // Guardrails: forbidden topics
  if (containsForbiddenTopic(message)) {
    return res.status(StatusCodes.OK).json({
      response:
        "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?",
      timestamp: new Date(),
      useOwnData: false,
      suggestions: DEFAULT_SUGGESTIONS,
    });
  }

  // Default suggestions based on content
  const suggestions = generateSuggestions(message);

  // If OpenAI not configured, return fallback immediately
  if (!openai) {
    return res.status(StatusCodes.OK).json({
      response: buildFallback(message, useOwnData),
      timestamp: new Date(),
      useOwnData,
      suggestions,
    });
  }

  // Build the chat conversation payload
  const messages = [
    { role: 'system', content: SYSTEM_MESSAGE },
    {
      role: 'user',
      content: `User message: "${message}". ${useOwnData ? 'The user wants to use personal assets and brand guidelines.' : 'The user is not using personal assets.'}`,
    },
  ];

  try {
    const aiResponse = await openai.chat.completions.create({
      model: CONFIG.MODEL,
      messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: 0.7,
    });

    const reply = aiResponse.choices?.[0]?.message?.content?.trim() || buildFallback(message, useOwnData);

    return res.status(StatusCodes.OK).json({
      response: reply,
      timestamp: new Date(),
      useOwnData,
      suggestions,
    });
  } catch (err) {
    console.error('🛑 OpenAI API error:', err);
    return res.status(StatusCodes.OK).json({
      response: buildFallback(message, useOwnData),
      timestamp: new Date(),
      useOwnData,
      suggestions,
    });
  }
};

// ------------------------------------------------------------
// Health‑check endpoint GET /chat/health
// ------------------------------------------------------------

exports.healthCheck = (req, res) => {
  res.status(StatusCodes.OK).json({
    status: 'operational',
    service: 'Design Assistant Chat',
    timestamp: new Date(),
    version: '2.0.0',
  });
};
