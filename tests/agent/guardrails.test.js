// Tests for agent guardrails
const { createProjectFocusedTopicsGuardrail } = require('../../agent/guardrails/projectTopics');

describe('Agent Guardrails', () => {
  describe('Project Focused Topics Guardrail', () => {
    let guardrail;

    beforeEach(() => {
      guardrail = createProjectFocusedTopicsGuardrail();
    });

    test('should have correct configuration', () => {
      expect(guardrail.name).toBe('project_focused_topics');
      expect(guardrail.description).toBeDefined();
      expect(typeof guardrail.execute).toBe('function');
    });

    test('should allow project-related queries', async () => {
      const projectQueries = [
        'Create a presentation about quarterly results',
        'Design an Instagram post for my coffee shop',
        'Make a business card for my company',
        'I need a poster for an event',
        'Create a custom banner with specific dimensions',
        'Help me with logo design',
        'What colors work well together?',
        'Find assets related to technology',
        'Analyze this image for design inspiration'
      ];

      for (const query of projectQueries) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('project-related');
      }
    });

    test('should block non-project queries', async () => {
      const nonProjectQueries = [
        'What is the weather today?',
        'How do I cook pasta?',
        'Tell me about the stock market',
        'What is the capital of France?',
        'Help me with my math homework',
        'Explain quantum physics',
        'What movies should I watch?',
        'How to fix my car?'
      ];

      for (const query of nonProjectQueries) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not related to design');
      }
    });

    test('should handle edge cases', async () => {
      const edgeCases = [
        { query: '', expectedAllowed: false },
        { query: '   ', expectedAllowed: false },
        { query: 'design', expectedAllowed: true },
        { query: 'PROJECT', expectedAllowed: true },
        { query: 'Create something creative', expectedAllowed: true },
        { query: 'Help me with branding strategy', expectedAllowed: true }
      ];

      for (const { query, expectedAllowed } of edgeCases) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(expectedAllowed);
        expect(typeof result.reason).toBe('string');
      }
    });

    test('should detect design-related keywords', async () => {
      const designKeywords = [
        'color palette',
        'typography',
        'layout',
        'branding',
        'visual identity',
        'graphic design',
        'user interface',
        'logo creation',
        'marketing materials',
        'print design'
      ];

      for (const keyword of designKeywords) {
        const query = `I need help with ${keyword}`;
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(true);
      }
    });

    test('should handle mixed content appropriately', async () => {
      const mixedQueries = [
        {
          query: 'Create a presentation about the weather forecast for our outdoor event',
          expectedAllowed: true // Contains presentation creation
        },
        {
          query: 'I want to cook dinner and also design a menu',
          expectedAllowed: true // Contains design element
        },
        {
          query: 'Help me study physics and also create study materials',
          expectedAllowed: true // Contains creation aspect
        }
      ];

      for (const { query, expectedAllowed } of mixedQueries) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(expectedAllowed);
      }
    });

    test('should provide helpful suggestions for blocked queries', async () => {
      const blockedQuery = 'What is the weather today?';
      const result = await guardrail.execute({ query: blockedQuery });
      
      expect(result.allowed).toBe(false);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('design');
    });

    test('should handle case insensitive matching', async () => {
      const caseVariations = [
        'CREATE A PRESENTATION',
        'create a presentation',
        'Create A Presentation',
        'CrEaTe A pReSeNtAtIoN'
      ];

      for (const query of caseVariations) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(true);
      }
    });

    test('should handle queries with special characters', async () => {
      const specialCharQueries = [
        'Create a presentation! It should be amazing.',
        'Design an Instagram post... with cool graphics?',
        'I need help with: logo design, branding, and colors',
        'Can you help me create (urgent) a business card?'
      ];

      for (const query of specialCharQueries) {
        const result = await guardrail.execute({ query });
        expect(result.allowed).toBe(true);
      }
    });

    test('should handle long queries efficiently', async () => {
      const longQuery = 'I am working on a comprehensive rebranding project for my company and I need help creating various design materials including a new logo, business cards, letterhead, presentation templates, social media graphics, website banners, print advertisements, and email newsletter templates. The brand should convey professionalism, innovation, and trustworthiness while appealing to our target demographic of young professionals in the technology sector.';
      
      const start = Date.now();
      const result = await guardrail.execute({ query: longQuery });
      const duration = Date.now() - start;
      
      expect(result.allowed).toBe(true);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    test('should maintain consistent behavior across similar queries', async () => {
      const similarQueries = [
        'Create a social media post',
        'Make a social media post',
        'Design a social media post',
        'Build a social media post',
        'Generate a social media post'
      ];

      const results = similarQueries.map(query => guardrail.execute({ query }));
      const responses = await Promise.all(results);
      
      responses.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });
  });
});
