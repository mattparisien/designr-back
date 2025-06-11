// services/projectAgentService.js
// ---------------------------------------------------------------------------
// Project Assistant Agent Service — Agents SDK Edition (v4.1.0)
// Now includes the built‑in `webSearchTool` for external inspiration.
// Uses dynamic imports for ES modules in CommonJS environment.
// ---------------------------------------------------------------------------

require('dotenv').config();
const vectorStore = require('./vectorStore');
const imageAnalysis = require('./imageAnalysisService');

// Dynamic imports for ES modules
let Agent, run, tool, webSearchTool, z, RunToolCallOutputItem;

/**
 * Function‑tool wrappers ----------------------------------------------------
 * These will be created after dynamic imports are loaded
 */
let searchAssetsTool, searchDocsTool, analyzeImageTool, buildWebSearchTool, designOnlyGuardrail;
let createPresentationTool, createSocialMediaTool, createPrintTool, createCustomProjectTool, listProjectTypesTool;

/**
 * ProjectAgentService --------------------------------------------------------
 */
class ProjectAgentService {
  #agent;
  #initialized = false;
  #vectorStore = vectorStore;
  #imageAnalysis = imageAnalysis;

  static MODEL = process.env.OPENAI_MODEL || 'gpt‑4o-mini';
  static APP = process.env.APP_NAME || 'Canva Clone';

  async initialize() {
    if (this.#initialized) return;
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY missing — agent disabled');
      return;
    }

    try {
      // Dynamic import of ES modules
      const agentsModule = await import('@openai/agents');
      const zodModule = await import('zod');

      Agent = agentsModule.Agent;
      run = agentsModule.run;
      tool = agentsModule.tool;
      webSearchTool = agentsModule.webSearchTool;
      RunToolCallOutputItem = agentsModule.RunToolCallOutputItem;
      z = zodModule.z;

      // Create tool functions after imports are available
      searchAssetsTool = ({ vs }) =>
        tool({
          name: 'search_assets',
          description: "Find visually similar assets in the user's library.",
          parameters: z.object({
            query: z.string().describe('Natural‑language or file name query'),
            limit: z.number().int().min(1).max(20).default(5),
          }),
          execute: async ({ query, limit }, ctx) => {
            const results = await vs.searchAssets(query, ctx.userId, {
              limit
            });
            return JSON.stringify(results);
          },
        });

      searchDocsTool = ({ vs }) =>
        tool({
          name: 'search_documents',
          description: 'Search within uploaded document text.',
          parameters: z.object({
            query: z.string(),
            limit: z.number().int().min(1).max(20).default(5),
          }),
          execute: async ({ query, limit }, ctx) => {
            const chunks = await vs.searchDocumentChunks(query, ctx.userId, {
              limit,
              threshold: 0.7,
            });
            return JSON.stringify(chunks);
          },
        });

      analyzeImageTool = ({ ia }) =>
        tool({
          name: 'analyze_image',
          description: 'Return dominant colours and objects detected in an image URL.',
          parameters: z.object({ imageUrl: z.string().describe('The URL of the image to analyze') }),
          execute: async ({ imageUrl }) => {
            const analysis = await ia.analyzeImage(imageUrl);
            return JSON.stringify(analysis ?? {});
          },
        });

      buildWebSearchTool = () =>
        webSearchTool({
          userLocation: {
            type: 'approximate',
            city: process.env.AGENT_CITY || 'Toronto',
          },
        });

      // Project creation tools
      createPresentationTool = () =>
        tool({
          name: 'create_presentation',
          description: 'Create a new presentation project with default settings.',
          parameters: z.object({
            title: z.string().default('Untitled Presentation').describe('Title for the presentation'),
            category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Presentation category'),
            aspectRatio: z.enum(['16:9', '4:3']).default('16:9').describe('Presentation aspect ratio'),
          }),
          execute: async ({ title, category, aspectRatio }, ctx) => {
            try {
              const canvasSize = aspectRatio === '4:3' 
                ? { name: "Presentation 4:3", width: 1024, height: 768 }
                : { name: "Presentation 16:9", width: 1920, height: 1080 };
              
              const projectData = {
                title,
                description: '',
                type: 'presentation',
                userId: ctx.userId,
                category,
                canvasSize
              };

              const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3001'}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
              });

              if (!response.ok) {
                throw new Error(`Failed to create presentation: ${response.statusText}`);
              }

              const project = await response.json();
              return JSON.stringify({
                success: true,
                project: {
                  id: project._id,
                  title: project.title,
                  type: project.type,
                  category: project.category,
                  canvasSize: project.canvasSize
                },
                message: `Created "${title}" presentation project successfully!`
              });
            } catch (error) {
              return JSON.stringify({
                success: false,
                error: error.message
              });
            }
          },
        });

      createSocialMediaTool = () =>
        tool({
          name: 'create_social_media_project',
          description: 'Create a new social media project with platform-specific dimensions.',
          parameters: z.object({
            title: z.string().default('Untitled Social Post').describe('Title for the social media project'),
            platform: z.enum(['instagram-post', 'instagram-story', 'facebook-post', 'twitter-post', 'linkedin-post', 'youtube-thumbnail', 'tiktok-video']).describe('Target social media platform'),
            category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
          }),
          execute: async ({ title, platform, category }, ctx) => {
            try {
              const platformSizes = {
                'instagram-post': { name: "Instagram Post", width: 1080, height: 1080 },
                'instagram-story': { name: "Instagram Story", width: 1080, height: 1920 },
                'facebook-post': { name: "Facebook Post", width: 1200, height: 630 },
                'twitter-post': { name: "Twitter Post", width: 1200, height: 675 },
                'linkedin-post': { name: "LinkedIn Post", width: 1200, height: 627 },
                'youtube-thumbnail': { name: "YouTube Thumbnail", width: 1280, height: 720 },
                'tiktok-video': { name: "TikTok Video", width: 1080, height: 1920 }
              };

              const canvasSize = platformSizes[platform];
              
              const projectData = {
                title,
                description: `Optimized for ${platform.replace('-', ' ')}`,
                type: 'social',
                userId: ctx.userId,
                category,
                canvasSize
              };

              const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3001'}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
              });

              if (!response.ok) {
                throw new Error(`Failed to create social media project: ${response.statusText}`);
              }

              const project = await response.json();
              return JSON.stringify({
                success: true,
                project: {
                  id: project._id,
                  title: project.title,
                  type: project.type,
                  category: project.category,
                  platform,
                  canvasSize: project.canvasSize
                },
                message: `Created "${title}" for ${platform.replace('-', ' ')} successfully!`
              });
            } catch (error) {
              return JSON.stringify({
                success: false,
                error: error.message
              });
            }
          },
        });

      createPrintTool = () =>
        tool({
          name: 'create_print_project',
          description: 'Create a new print project with standard print dimensions.',
          parameters: z.object({
            title: z.string().default('Untitled Print Design').describe('Title for the print project'),
            format: z.enum(['a4', 'a5', 'us-letter', 'us-legal', 'poster', 'business-card', 'flyer']).describe('Print format'),
            category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
          }),
          execute: async ({ title, format, category }, ctx) => {
            try {
              const printSizes = {
                'a4': { name: "A4", width: 794, height: 1123 },
                'a5': { name: "A5", width: 559, height: 794 },
                'us-letter': { name: "US Letter", width: 816, height: 1056 },
                'us-legal': { name: "US Legal", width: 816, height: 1344 },
                'poster': { name: "Poster", width: 1240, height: 1754 },
                'business-card': { name: "Business Card", width: 315, height: 189 },
                'flyer': { name: "Flyer", width: 794, height: 1123 }
              };

              const canvasSize = printSizes[format];
              
              const projectData = {
                title,
                description: `Print-ready ${format.replace('-', ' ')} design`,
                type: 'print',
                userId: ctx.userId,
                category,
                canvasSize
              };

              const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3001'}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
              });

              if (!response.ok) {
                throw new Error(`Failed to create print project: ${response.statusText}`);
              }

              const project = await response.json();
              return JSON.stringify({
                success: true,
                project: {
                  id: project._id,
                  title: project.title,
                  type: project.type,
                  category: project.category,
                  format,
                  canvasSize: project.canvasSize
                },
                message: `Created "${title}" ${format.replace('-', ' ')} print project successfully!`
              });
            } catch (error) {
              return JSON.stringify({
                success: false,
                error: error.message
              });
            }
          },
        });

      createCustomProjectTool = () =>
        tool({
          name: 'create_custom_project',
          description: 'Create a new custom project with specified dimensions.',
          parameters: z.object({
            title: z.string().default('Untitled Custom Design').describe('Title for the custom project'),
            width: z.number().int().min(100).max(8000).describe('Canvas width in pixels'),
            height: z.number().int().min(100).max(8000).describe('Canvas height in pixels'),
            category: z.enum(['marketing', 'education', 'events', 'personal', 'other']).default('personal').describe('Project category'),
          }),
          execute: async ({ title, width, height, category }, ctx) => {
            try {
              const canvasSize = {
                name: `Custom ${width}x${height}`,
                width,
                height
              };
              
              const projectData = {
                title,
                description: `Custom dimensions: ${width}x${height}px`,
                type: 'custom',
                userId: ctx.userId,
                category,
                canvasSize
              };

              const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3001'}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
              });

              if (!response.ok) {
                throw new Error(`Failed to create custom project: ${response.statusText}`);
              }

              const project = await response.json();
              return JSON.stringify({
                success: true,
                project: {
                  id: project._id,
                  title: project.title,
                  type: project.type,
                  category: project.category,
                  dimensions: `${width}x${height}`,
                  canvasSize: project.canvasSize
                },
                message: `Created "${title}" custom project (${width}x${height}px) successfully!`
              });
            } catch (error) {
              return JSON.stringify({
                success: false,
                error: error.message
              });
            }
          },
        });

      listProjectTypesTool = () =>
        tool({
          name: 'list_project_types',
          description: 'List available project types and their supported formats/platforms.',
          parameters: z.object({}),
          execute: async () => {
            const projectTypes = {
              presentation: {
                description: 'Slideshow presentations for business, education, or personal use',
                formats: ['16:9 (recommended)', '4:3 (classic)'],
                examples: ['Business pitch deck', 'School presentation', 'Portfolio showcase']
              },
              social_media: {
                description: 'Social media posts optimized for specific platforms',
                platforms: ['Instagram Post (1:1)', 'Instagram Story (9:16)', 'Facebook Post', 'Twitter Post', 'LinkedIn Post', 'YouTube Thumbnail', 'TikTok Video'],
                examples: ['Product announcement', 'Event promotion', 'Brand awareness post']
              },
              print: {
                description: 'Print-ready designs for physical media',
                formats: ['A4', 'A5', 'US Letter', 'US Legal', 'Poster', 'Business Card', 'Flyer'],
                examples: ['Business card', 'Event flyer', 'Poster design', 'Brochure']
              },
              custom: {
                description: 'Custom dimensions for specialized use cases',
                note: 'Specify exact width and height in pixels (100-8000px)',
                examples: ['Web banner', 'Email header', 'Digital display', 'Custom artwork']
              }
            };

            return JSON.stringify({
              available_project_types: projectTypes,
              usage: {
                create_presentation: 'For slideshow presentations',
                create_social_media_project: 'For social media content',
                create_print_project: 'For physical print materials',
                create_custom_project: 'For custom dimensions'
              }
            });
          },
        });

      const FORBIDDEN = [
        'politics',
        'election',
        'covid',
        'virus',
        'medical',
        'doctor',
        'medicine',
        'legal advice',
        'lawyer',
        'financial advice',
        'investment',
        'crypto',
        'password',
        'private data',
      ];

      designOnlyGuardrail = {
        name: 'project‑focused‑topics',
        async check({ content }) {
          const lower = content.toLowerCase();
          const hit = FORBIDDEN.some((t) => lower.includes(t));
          if (hit) {
            return {
              success: false,
              message:
                "I'm a Project Assistant focused on helping you create amazing designs and manage your projects. Let's talk about your creative projects instead! What would you like to create today?",
            };
          }
          return { success: true };
        },
      };

      console.log('✅ ES modules loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load ES modules:', error.message);
      return;
    }

    // Initialise dependent services in parallel.
    await Promise.all([
      this.#vectorStore.initialize(),
      this.#imageAnalysis.initialize(),
    ]);

    // Build the Agent with tools + guardrails.
    this.#agent = new Agent({
      name: 'Project Assistant',
      instructions: `You are a Project Assistant for the design platform "${ProjectAgentService.APP}". You help with graphic‑design tasks (logos, presentations, social posts, colour theory, typography, etc.) and project management. 

You can create different types of projects:
- Presentations: Use create_presentation for slideshow presentations
- Social Media: Use create_social_media_project for platform-specific posts (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok)
- Print: Use create_print_project for physical media (A4, A5, posters, business cards, flyers)
- Custom: Use create_custom_project for specific dimensions

Always suggest concrete next steps (e.g. "Browse presentation templates", "Apply brand colours", "Create an Instagram post"). When external inspiration is helpful, feel free to use the web search tool.`,
      model: ProjectAgentService.MODEL,
      tools: [
        searchAssetsTool({ vs: this.#vectorStore }),
        searchDocsTool({ vs: this.#vectorStore }),
        analyzeImageTool({ ia: this.#imageAnalysis }),
        buildWebSearchTool(),
        createPresentationTool(),
        createSocialMediaTool(),
        createPrintTool(),
        createCustomProjectTool(),
        listProjectTypesTool(),
      ],
      // inputGuardrails: [designOnlyGuardrail], // Temporarily disabled for testing
    });

    this.#initialized = true;
    console.log('✅ Project Agent (Agents SDK + webSearch) ready');
  }

  /**
   * Top‑level helper to chat with the agent.
   * Returns { assistant_text, toolOutputs, trace }.
   */
  async chat(userText, { userId } = {}) {
    if (!this.#initialized) await this.initialize();
    if (!this.#agent) {
      // Fallback when API key missing.
      return {
        assistant_text:
          "I can't connect to the model right now, but I can still help you explore templates or colour palettes locally!",
      };
    }

    const result = await run(this.#agent, userText, { userId });

    const toolOutputs = result.newItems
      .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed')
      .reduce((acc, i) => {
        acc[i.rawItem.name] = acc[i.output];
        return acc;
      }, {});

      console.log(result.newItems
      .filter((i) => i instanceof RunToolCallOutputItem && i.rawItem.status === 'completed'));

    return {
      assistant_text: result.finalOutput,
      toolOutputs, // key‑value map of toolName → return value
      traceId: result.traceId, // useful for debugging with the tracing UI
    };
  }

  /** Simple health endpoint for monitoring. */
  getHealthStatus() {
    return {
      initialized: this.#initialized,
      model: ProjectAgentService.MODEL,
      tools: this.#agent?.tools?.map((t) => t.name) ?? [],
    };
  }
}

module.exports = ProjectAgentService;
