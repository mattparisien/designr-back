// agentConfig.js - Configuration constants for AI Agent functionality

/**
 * OpenAI API Configuration
 */
const OPENAI_CONFIG = {
  // Model to use for agent responses
  MODEL: 'gpt-4o-2024-08-06',

  // Default tool choice strategy
  TOOL_CHOICE: 'auto',

  // Maximum steps for tool execution loops
  DEFAULT_MAX_STEPS: 8,

  // Function call output type identifier
  FUNCTION_CALL_OUTPUT_TYPE: 'function_call_output'
};

/**
 * Agent Instructions and Prompts
 */
const AGENT_INSTRUCTIONS = {
  // Base instruction for all agent interactions
  BASE: `You are an AI Design Assistant for a Canva-like design platform. You are a creative, knowledgeable, and helpful assistant specializing in:

**Core Capabilities:**
- Design project creation and management
- Visual design guidance and best practices
- Creative inspiration and ideation
- Web research for design trends and resources
- Technical assistance with design workflows

**Your Personality:**
- Professional yet approachable
- Creative and inspiring
- Detail-oriented and practical
- Proactive in offering suggestions
- Patient and educational

**Design Expertise Areas:**
- Graphic design principles (typography, color theory, layout, composition)
- Brand identity and visual branding
- Marketing materials (flyers, posters, social media content)
- Presentation design and slide layouts
- Print design considerations
- Digital design best practices
- User interface and user experience principles
- Design trends and contemporary aesthetics

**Project Creation Guidelines:**
When creating projects, consider:
- Purpose and target audience
- Appropriate canvas dimensions for the intended use
- Visual hierarchy and readability
- Brand consistency and style guidelines
- Platform-specific requirements (social media dimensions, print specifications)
- Accessibility and inclusive design principles

**Communication Style:**
- Use clear, actionable language
- Provide specific, practical advice
- Offer alternatives and creative options
- Explain design reasoning when helpful
- Use design terminology appropriately but explain when necessary
- Format responses with proper structure (headings, lists, emphasis)

**Response Guidelines:**
- Always aim to be helpful and constructive
- Provide context for design decisions
- Suggest improvements and alternatives
- Reference current design trends when relevant
- Include practical next steps or action items
- Use markdown formatting for better readability

**Tool Usage:**
- Use web search to find current design trends, inspiration, and resources
- Create projects when users request new designs or canvases
- Provide comprehensive project specifications including dimensions, colors, and typography suggestions

**Limitations to Acknowledge:**
- Cannot directly create visual content or generate images
- Cannot access user's existing projects or files
- Cannot execute design software functions directly
- Provide guidance and specifications that users can implement

Remember: Your goal is to empower users to create outstanding designs by providing expert guidance, creative inspiration, and practical assistance throughout their design journey.`,

  // Additional instruction when JSON response is required
  JSON_MODE: 'Return ONLY valid JSON (no markdown).',

  // Function to build complete instructions based on response format
  build: (wantsJson = false) => {
    const instructions = [
      AGENT_INSTRUCTIONS.BASE,
      wantsJson ? AGENT_INSTRUCTIONS.JSON_MODE : null
    ].filter(Boolean);

    return instructions.join(' ');
  }
};

/**
 * Tool Configuration
 */
const TOOL_CONFIG = {
  // Default web search tool definition
  WEB_SEARCH: { type: 'web_search' },

  // Project creation tool definition
  CREATE_PROJECT: {
    type: 'function',
    name: 'create_project',
    description: 'Creates a new project via the API. Use this tool when the user wants to create a new project, design, or canvas.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title/name of the project'
        },
        description: {
          type: 'string',
          description: 'Optional description of the project'
        },
        type: {
          type: 'string',
          description: 'Type of project (e.g., "presentation", "flyer", "poster", "social-media", "custom")',
          enum: ['presentation', 'flyer', 'poster', 'social-media', 'custom']
        },
        category: {
          type: 'string',
          description: 'Optional category for the project (e.g., "business", "education", "marketing")'
        },
        canvasSize: {
          type: 'object',
          description: 'Canvas dimensions for the project',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the canvas size preset or "Custom"'
            },
            width: {
              type: 'number',
              description: 'Width in pixels'
            },
            height: {
              type: 'number',
              description: 'Height in pixels'
            }
          },
          required: ['width', 'height']
        },
        tags: {
          type: 'array',
          description: 'Optional tags for the project',
          items: {
            type: 'string'
          }
        },
        isTemplate: {
          type: 'boolean',
          description: 'Whether this project should be created as a template'
        }
      },
      required: ['title', 'userId', 'canvasSize']
    }
  },

  // Function tool configuration defaults
  FUNCTION_DEFAULTS: {
    strict: true
  },

  // Tool execution settings
  EXECUTION: {
    // Timeout for individual tool executions (in ms)
    TIMEOUT: 30000,

    // Maximum retries for failed tool executions
    MAX_RETRIES: 3
  }
};

/**
 * Logging Configuration
 */
const LOGGING_CONFIG = {
  // Enable/disable different types of logging
  ENABLED: {
    TOOL_CALLS: true,
    WEB_SEARCH_QUERIES: true,
    EXECUTION_STATUS: true,
    RESPONSE_PROCESSING: true,
    WEB_SEARCH_RESULTS: true
  },

  // Log message templates
  MESSAGES: {
    INITIAL_REQUEST: '🚀 Making initial request to OpenAI with tools:',
    INITIAL_RESPONSE: '📥 Initial response received, output blocks:',
    STEP_PROCESSING: '🔧 Step {step}: Found {count} tool calls',
    NO_MORE_CALLS: '✅ No more tool calls, finishing',
    TOOL_CALL: '📞 Tool call: {name} with args:',
    WEB_SEARCH_QUERY: '🔍 Web search query:',
    CUSTOM_TOOL_EXECUTING: '🔄 Executing custom tool: {name}',
    CUSTOM_TOOL_SUCCESS: '✅ Custom tool "{name}" executed successfully',
    CUSTOM_TOOL_FAILED: '❌ Custom tool "{name}" failed:',
    WEB_SEARCH_HOSTED: '🌐 Web search executed by OpenAI (hosted tool)',
    NO_EXECUTOR: '⚠️ No executor found for tool: {name}',
    RESPONSE_AFTER_STEP: '📋 Response after step {step}:',
    WEB_SEARCH_PREVIEW: '🌐 Web search results incorporated (preview):'
  }
};

/**
 * JSON Parsing Configuration
 */
const JSON_CONFIG = {
  // Regex pattern to extract JSON from markdown code blocks
  MARKDOWN_PATTERN: /```(?:json)?\s*\n?([\s\S]*?)\s*```/,

  // Response format type for JSON mode
  JSON_OBJECT_TYPE: 'json_object'
};

/**
 * Error Messages
 */
const ERROR_MESSAGES = {
  INVALID_PROMPT: 'prompt must be a non-empty string',
  INVALID_RESPONSE_FORMAT: 'response_format must be an object or null',
  NO_EXECUTOR: 'No executor for tool "{name}"',
  TOOL_EXECUTION_FAILED: 'Tool execution failed: {error}'
};

/**
 * Validation Configuration
 */
const VALIDATION = {
  // Maximum prompt length (characters)
  MAX_PROMPT_LENGTH: 50000,

  // Minimum prompt length (characters)
  MIN_PROMPT_LENGTH: 1,

  // Maximum steps allowed
  MAX_STEPS_LIMIT: 20,

  // Minimum steps allowed
  MIN_STEPS_LIMIT: 1
};

module.exports = {
  OPENAI_CONFIG,
  AGENT_INSTRUCTIONS,
  TOOL_CONFIG,
  LOGGING_CONFIG,
  JSON_CONFIG,
  ERROR_MESSAGES,
  VALIDATION
};
