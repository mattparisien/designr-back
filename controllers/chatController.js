// controllers/chatControllerImproved.js
// ------------------------------------------------------------
// Design‑Assistant chat controller (v3.0.0)
// A robust, secure wrapper around the OpenAI chat API that enforces
// strict design‑only guard‑rails for a Canva‑like platform and returns
// **structured JSON** responses (assistant_text, suggestions, action).
// ------------------------------------------------------------

/* eslint-disable no-console */

const OpenAI = require('openai');
const { StatusCodes } = require('http-status-codes');
require('dotenv').config();

// ------------------------------------------------------------
// Configuration & feature flags
// ------------------------------------------------------------

const CONFIG = {
  APP_NAME: process.env.APP_NAME || 'Canva Clone',
  MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  MAX_MESSAGE_LENGTH: 1000,
  MAX_TOKENS: 300,
  /**
   * Set OPENAI_JSON=true to switch to JSON output mode.
   * In this mode the controller asks the model for valid JSON using
   *    response_format:{type:'json_object'}
   * and returns a single SSE event containing the parsed object.
   */
  USE_JSON_MODE: process.env.OPENAI_JSON === 'true',
};

// ------------------------------------------------------------
// System Prompt – design‑only guardrails & JSON schema instructions
// ------------------------------------------------------------

const SYSTEM_MESSAGE = ({ appName, jsonMode }) => `You are a Design Assistant for a Canva‑like design platform named *${appName}*.
Your *only* purpose is to help users with design‑related tasks **inside this application**.

# Strict rules – you must follow:
1. **Only** discuss design topics — e.g. logos, presentations, social media posts, flyers, posters, banners, marketing materials, branding, colour schemes, layouts, typography.
2. **Only** assist with platform features — e.g. creating designs, editing elements, choosing templates, managing assets, organising projects, working with fonts & colours.
3. **Refuse** any request about politics, personal/medical/legal/financial advice, programming (except design‑tool features), other software, current events, or controversial issues.
4. When asked about non‑design topics, reply *exactly* with:
   "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?"
5. Remain helpful, encouraging, and laser‑focused on the user's creative goals.
6. Suggest concrete design actions they can take within the platform.
${jsonMode ? `\n# Output format\nReturn **only** valid JSON with the following keys and NEVER any additional keys or markdown.\n- assistant_text: string  // conversational reply to show the user\n- suggestions:   string[] // 1‑5 quick actions\n- action:        string   // one of [\"none\",\"open_template\",\"apply_brand\",\"upload_asset\"]` : ''}`;

// ------------------------------------------------------------
// Keyword & topic reference data (unchanged)
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

const normalise = (text = '') => text.toLowerCase();

function containsForbiddenTopic(text) {
  const lower = normalise(text);
  return Array.from(FORBIDDEN_TOPICS).some((topic) => lower.includes(topic));
}

function containsDesignKeyword(text) {
  const lower = normalise(text);
  return DESIGN_KEYWORDS.some((kw) => lower.includes(kw));
}

function generateSuggestions(text) {
  for (const entry of SUGGESTIONS_MAP) {
    if (entry.test.test(text)) return entry.suggestions;
  }
  return DEFAULT_SUGGESTIONS;
}

function buildFallback(text, useOwnData) {
  if (containsDesignKeyword(text)) {
    const extras = useOwnData ? 'I’ll use your brand assets. ' : '';
    return {
      assistant_text: `Great! ${extras}Let me suggest some design approaches for your “${text}”. Would you like recommended templates or colour schemes to get started?`,
      suggestions: generateSuggestions(text),
      action: 'none',
    };
  }
  return {
    assistant_text: `I can help you turn that idea into a beautiful design! ${useOwnData ? 'Using your personal assets, ' : ''}start by choosing a template – a social media post, presentation, flyer, or something else?`,
    suggestions: DEFAULT_SUGGESTIONS,
    action: 'none',
  };
}

// ------------------------------------------------------------
// OpenAI initialisation (once at module load‑time)
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

  // ---------------- Validation ----------------
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

  // ---------------- Guard‑rails ----------------
  if (containsForbiddenTopic(message)) {
    return res.status(StatusCodes.OK).json({
      assistant_text:
        "I'm a Design Assistant focused only on helping you create amazing designs. Let's talk about your design projects instead! What would you like to create today?",
      suggestions: DEFAULT_SUGGESTIONS,
      action: 'none',
      timestamp: new Date(),
      useOwnData: false,
    });
  }

  // No OpenAI client? -> fallback immediately (JSON)
  if (!openai) {
    return res.status(StatusCodes.OK).json({
      ...buildFallback(message, useOwnData),
      timestamp: new Date(),
      useOwnData,
    });
  }

  // ---------------- Build prompt ----------------
  const messages = [
    { role: 'system', content: SYSTEM_MESSAGE({ appName: CONFIG.APP_NAME, jsonMode: CONFIG.USE_JSON_MODE }) },
    {
      role: 'user',
      content: `User message: "${message}". ${useOwnData ? 'The user wants to use personal assets and brand guidelines.' : 'The user is not using personal assets.'}`,
    },
  ];

  // ---------------- SSE headers ----------------
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    if (CONFIG.USE_JSON_MODE) {
      // -------- Non‑streaming call, guaranteed JSON --------
      const completion = await openai.chat.completions.create({
        model: CONFIG.MODEL,
        messages,
        max_tokens: CONFIG.MAX_TOKENS,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content);
      // Validate shape (basic)
      if (!parsed.assistant_text) throw new Error('assistant_text missing');
      if (!Array.isArray(parsed.suggestions)) parsed.suggestions = generateSuggestions(message);
      if (!parsed.action) parsed.action = 'none';

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        ...parsed,
        timestamp: new Date(),
        useOwnData,
      })}\n\n`);
      return res.end();
    }

    // -------- Legacy streaming text mode --------
    const stream = await openai.chat.completions.create({
      model: CONFIG.MODEL,
      messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content, timestamp: new Date() })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({
      type: 'complete',
      assistant_text: fullResponse,
      suggestions: generateSuggestions(message),
      action: 'none',
      timestamp: new Date(),
      useOwnData,
    })}\n\n`);
    res.end();
  } catch (err) {
    console.error('🛑 OpenAI API error:', err);

    // Send fallback JSON
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      ...buildFallback(message, useOwnData),
      timestamp: new Date(),
      useOwnData,
    })}\n\n`);
    res.end();
  }
};

// ------------------------------------------------------------
// Health‑check endpoint GET /chat/health
// ------------------------------------------------------------

exports.healthCheck = (_req, res) => {
  res.status(StatusCodes.OK).json({
    status: 'operational',
    service: 'Design Assistant Chat',
    timestamp: new Date(),
    version: '3.0.0',
    jsonMode: CONFIG.USE_JSON_MODE,
  });
};
