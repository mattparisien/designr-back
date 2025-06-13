// Tests for list project types tool
const { listProjectTypesTool } = require('../../../../agent/tools/projects/listProjectTypes');

describe('List Project Types Tool', () => {
  let projectTypesTool;
  let mockContext;

  beforeEach(async () => {
    projectTypesTool = await listProjectTypesTool();
    mockContext = {
      userId: 'test-user-123'
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(projectTypesTool.name).toBe('list_project_types');
      expect(projectTypesTool.description).toBe('List all available project types and their specifications.');
    });

    test('should have correct parameter schema', () => {
      const params = projectTypesTool.parameters;
      expect(params).toBeDefined();
      expect(params._def.shape.category).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('should list all project types when no category specified', async () => {
      const result = await projectTypesTool.execute({}, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('projectTypes');
      expect(Array.isArray(parsed.projectTypes)).toBe(true);
      expect(parsed.projectTypes.length).toBeGreaterThan(0);

      // Check that all main categories are included
      const types = parsed.projectTypes;
      expect(types.some(t => t.type === 'presentation')).toBe(true);
      expect(types.some(t => t.type === 'social-media')).toBe(true);
      expect(types.some(t => t.type === 'print')).toBe(true);
      expect(types.some(t => t.type === 'custom')).toBe(true);
    });

    test('should filter by presentation category', async () => {
      const result = await projectTypesTool.execute({ category: 'presentation' }, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed.projectTypes).toBeDefined();
      const presentationTypes = parsed.projectTypes.filter(t => t.type === 'presentation');
      expect(presentationTypes.length).toBeGreaterThan(0);

      // Check presentation structure
      const presentation = presentationTypes[0];
      expect(presentation).toHaveProperty('type', 'presentation');
      expect(presentation).toHaveProperty('name');
      expect(presentation).toHaveProperty('description');
      expect(presentation).toHaveProperty('dimensions');
      expect(presentation).toHaveProperty('aspectRatio');
    });

    test('should filter by social-media category', async () => {
      const result = await projectTypesTool.execute({ category: 'social-media' }, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed.projectTypes).toBeDefined();
      const socialTypes = parsed.projectTypes.filter(t => t.type === 'social-media');
      expect(socialTypes.length).toBeGreaterThan(0);

      // Check social media structure
      const socialMedia = socialTypes[0];
      expect(socialMedia).toHaveProperty('type', 'social-media');
      expect(socialMedia).toHaveProperty('platforms');
      expect(Array.isArray(socialMedia.platforms)).toBe(true);
    });

    test('should filter by print category', async () => {
      const result = await projectTypesTool.execute({ category: 'print' }, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed.projectTypes).toBeDefined();
      const printTypes = parsed.projectTypes.filter(t => t.type === 'print');
      expect(printTypes.length).toBeGreaterThan(0);

      // Check print structure
      const print = printTypes[0];
      expect(print).toHaveProperty('type', 'print');
      expect(print).toHaveProperty('sizes');
      expect(Array.isArray(print.sizes)).toBe(true);
    });

    test('should filter by custom category', async () => {
      const result = await projectTypesTool.execute({ category: 'custom' }, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed.projectTypes).toBeDefined();
      const customTypes = parsed.projectTypes.filter(t => t.type === 'custom');
      expect(customTypes.length).toBeGreaterThan(0);

      // Check custom structure
      const custom = customTypes[0];
      expect(custom).toHaveProperty('type', 'custom');
      expect(custom).toHaveProperty('name');
      expect(custom).toHaveProperty('description');
    });

    test('should handle invalid category gracefully', async () => {
      const result = await projectTypesTool.execute({ category: 'invalid-category' }, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed.projectTypes).toBeDefined();
      expect(Array.isArray(parsed.projectTypes)).toBe(true);
      // Should return empty array or all types for invalid category
    });

    test('should include detailed specifications for each project type', async () => {
      const result = await projectTypesTool.execute({}, mockContext);
      const parsed = JSON.parse(result);

      const types = parsed.projectTypes;
      
      // Check presentation details
      const presentation = types.find(t => t.type === 'presentation');
      if (presentation) {
        expect(presentation).toHaveProperty('dimensions');
        expect(presentation).toHaveProperty('aspectRatio', '16:9');
        expect(presentation.dimensions).toEqual({ width: 1920, height: 1080 });
      }

      // Check social media details
      const socialMedia = types.find(t => t.type === 'social-media');
      if (socialMedia && socialMedia.platforms) {
        const instagram = socialMedia.platforms.find(p => p.platform === 'Instagram');
        if (instagram) {
          expect(instagram).toHaveProperty('formats');
          expect(Array.isArray(instagram.formats)).toBe(true);
        }
      }

      // Check print details
      const print = types.find(t => t.type === 'print');
      if (print && print.sizes) {
        const a4 = print.sizes.find(s => s.size === 'A4');
        if (a4) {
          expect(a4).toHaveProperty('dimensions');
          expect(a4).toHaveProperty('orientations');
        }
      }
    });

    test('should provide usage examples', async () => {
      const result = await projectTypesTool.execute({}, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('examples');
      expect(Array.isArray(parsed.examples)).toBe(true);
      expect(parsed.examples.length).toBeGreaterThan(0);

      // Check example structure
      const example = parsed.examples[0];
      expect(example).toHaveProperty('type');
      expect(example).toHaveProperty('description');
      expect(example).toHaveProperty('useCase');
    });

    test('should include recommendations', async () => {
      const result = await projectTypesTool.execute({}, mockContext);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('recommendations');
      expect(Array.isArray(parsed.recommendations)).toBe(true);
      expect(parsed.recommendations.length).toBeGreaterThan(0);

      // Check recommendation structure
      const recommendation = parsed.recommendations[0];
      expect(recommendation).toHaveProperty('scenario');
      expect(recommendation).toHaveProperty('recommendedType');
      expect(recommendation).toHaveProperty('reason');
    });
  });

  describe('Parameter Validation', () => {
    test('should allow empty parameters', () => {
      const params = projectTypesTool.parameters;
      
      expect(() => params.parse({})).not.toThrow();
    });

    test('should validate category enum values', () => {
      const params = projectTypesTool.parameters;
      
      expect(() => params.parse({ category: 'presentation' })).not.toThrow();
      expect(() => params.parse({ category: 'social-media' })).not.toThrow();
      expect(() => params.parse({ category: 'print' })).not.toThrow();
      expect(() => params.parse({ category: 'custom' })).not.toThrow();
    });

    test('should handle optional category parameter', () => {
      const params = projectTypesTool.parameters;
      
      expect(() => params.parse({})).not.toThrow();
      expect(() => params.parse({ category: 'presentation' })).not.toThrow();
    });
  });
});
