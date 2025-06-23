const PROJECT_PRESETS = {
  // Social Media Presets
  social: {
    'instagram-post': {
      name: 'Instagram Post',
      canvasSize: { name: 'Instagram Post', width: 1080, height: 1080 },
      type: 'social',
      category: 'Instagram',
      tags: ['instagram', 'social', 'square']
    },
    'instagram-story': {
      name: 'Instagram Story',
      canvasSize: { name: 'Instagram Story', width: 1080, height: 1920 },
      type: 'social',
      category: 'Instagram',
      tags: ['instagram', 'story', 'vertical']
    },
    'instagram-reel': {
      name: 'Instagram Reel',
      canvasSize: { name: 'Instagram Reel', width: 1080, height: 1920 },
      type: 'social',
      category: 'Instagram',
      tags: ['instagram', 'reel', 'video']
    },
    'facebook-post': {
      name: 'Facebook Post',
      canvasSize: { name: 'Facebook Post', width: 1200, height: 630 },
      type: 'social',
      category: 'Facebook',
      tags: ['facebook', 'social', 'horizontal']
    },
    'facebook-cover': {
      name: 'Facebook Cover',
      canvasSize: { name: 'Facebook Cover', width: 1640, height: 859 },
      type: 'social',
      category: 'Facebook',
      tags: ['facebook', 'cover', 'banner']
    },
    'twitter-post': {
      name: 'Twitter Post',
      canvasSize: { name: 'Twitter Post', width: 1200, height: 675 },
      type: 'social',
      category: 'Twitter',
      tags: ['twitter', 'social', 'horizontal']
    },
    'linkedin-post': {
      name: 'LinkedIn Post',
      canvasSize: { name: 'LinkedIn Post', width: 1200, height: 627 },
      type: 'social',
      category: 'LinkedIn',
      tags: ['linkedin', 'professional', 'social']
    },
    'youtube-thumbnail': {
      name: 'YouTube Thumbnail',
      canvasSize: { name: 'YouTube Thumbnail', width: 1280, height: 720 },
      type: 'social',
      category: 'YouTube',
      tags: ['youtube', 'thumbnail', 'video']
    }
  },

  // Print Presets
  print: {
    'business-card': {
      name: 'Business Card',
      canvasSize: { name: 'Business Card', width: 1050, height: 600 },
      type: 'print',
      category: 'Business',
      tags: ['business-card', 'print', 'professional']
    },
    'poster-a4': {
      name: 'A4 Poster',
      canvasSize: { name: 'A4 Poster', width: 2480, height: 3508 },
      type: 'print',
      category: 'Poster',
      tags: ['poster', 'a4', 'print']
    },
    'flyer-letter': {
      name: 'Letter Flyer',
      canvasSize: { name: 'Letter Flyer', width: 2550, height: 3300 },
      type: 'print',
      category: 'Marketing',
      tags: ['flyer', 'marketing', 'print']
    },
    'brochure-trifold': {
      name: 'Tri-fold Brochure',
      canvasSize: { name: 'Tri-fold Brochure', width: 3300, height: 2550 },
      type: 'print',
      category: 'Marketing',
      tags: ['brochure', 'marketing', 'print']
    }
  },

  // Presentation Presets
  presentation: {
    'slide-16-9': {
      name: '16:9 Presentation',
      canvasSize: { name: '16:9 Slide', width: 1920, height: 1080 },
      type: 'presentation',
      category: 'Presentation',
      tags: ['presentation', 'slide', 'widescreen']
    },
    'slide-4-3': {
      name: '4:3 Presentation',
      canvasSize: { name: '4:3 Slide', width: 1024, height: 768 },
      type: 'presentation',
      category: 'Presentation',
      tags: ['presentation', 'slide', 'standard']
    }
  },

  // Custom/Web Presets
  custom: {
    'web-banner': {
      name: 'Web Banner',
      canvasSize: { name: 'Web Banner', width: 728, height: 90 },
      type: 'custom',
      category: 'Web',
      tags: ['banner', 'web', 'advertising']
    },
    'blog-header': {
      name: 'Blog Header',
      canvasSize: { name: 'Blog Header', width: 1200, height: 400 },
      type: 'custom',
      category: 'Blog',
      tags: ['blog', 'header', 'web']
    },
    'email-header': {
      name: 'Email Header',
      canvasSize: { name: 'Email Header', width: 600, height: 200 },
      type: 'custom',
      category: 'Email',
      tags: ['email', 'header', 'marketing']
    }
  }
};

// Helper functions
const getPresetsByCategory = (category) => {
  return PROJECT_PRESETS[category] || {};
};

const getPresetByKey = (category, key) => {
  return PROJECT_PRESETS[category]?.[key] || null;
};

const getAllPresets = () => {
  return PROJECT_PRESETS;
};

const searchPresets = (searchTerm) => {
  const results = [];
  Object.entries(PROJECT_PRESETS).forEach(([category, presets]) => {
    Object.entries(presets).forEach(([key, preset]) => {
      if (
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
        results.push({ category, key, ...preset });
      }
    });
  });
  return results;
};

const getPresetsList = () => {
  const list = [];
  Object.entries(PROJECT_PRESETS).forEach(([category, presets]) => {
    Object.entries(presets).forEach(([key, preset]) => {
      list.push({
        id: `${category}:${key}`,
        category,
        key,
        ...preset
      });
    });
  });
  return list;
};

export {
  PROJECT_PRESETS,
  getPresetsByCategory,
  getPresetByKey,
  getAllPresets,
  searchPresets,
  getPresetsList
};
