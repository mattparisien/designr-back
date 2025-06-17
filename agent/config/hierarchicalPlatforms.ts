// Updated platform sizes configuration using hierarchical types

/* ------------------------------------------------------------------ *
 * Types                                                              *
 * ------------------------------------------------------------------ */
interface PlatformSize {
  name: string;
  width: number;
  height: number;
  aspectRatio?: string;
}

interface PlatformCategory {
  [format: string]: PlatformSize;
}

interface MainTypeCategory {
  [platform: string]: PlatformCategory | PlatformSize;
}

interface HierarchicalPlatforms {
  [mainType: string]: MainTypeCategory;
}

/* ------------------------------------------------------------------ *
 * Legacy platform sizes for backward compatibility                  *
 * ------------------------------------------------------------------ */
const legacyPlatformSizes: Record<string, PlatformSize> = {
  'instagram-post': { name: "Instagram Post", width: 1080, height: 1080 },
  'instagram-story': { name: "Instagram Story", width: 1080, height: 1920 },
  'facebook-post': { name: "Facebook Post", width: 1200, height: 630 },
  'twitter-post': { name: "Twitter Post", width: 1200, height: 675 },
  'linkedin-post': { name: "LinkedIn Post", width: 1200, height: 627 },
  'youtube-thumbnail': { name: "YouTube Thumbnail", width: 1280, height: 720 },
  'tiktok-video': { name: "TikTok Video", width: 1080, height: 1920 }
};

/* ------------------------------------------------------------------ *
 * New hierarchical platform configuration                           *
 * ------------------------------------------------------------------ */
const hierarchicalPlatforms: HierarchicalPlatforms = {
  social: {
    instagram: {
      post: { name: "Instagram Post", width: 1080, height: 1080, aspectRatio: '1:1' },
      story: { name: "Instagram Story", width: 1080, height: 1920, aspectRatio: '9:16' },
      reel: { name: "Instagram Reel", width: 1080, height: 1920, aspectRatio: '9:16' },
    },
    facebook: {
      post: { name: "Facebook Post", width: 1200, height: 630, aspectRatio: '1.91:1' },
      story: { name: "Facebook Story", width: 1080, height: 1920, aspectRatio: '9:16' },
      cover: { name: "Facebook Cover", width: 1640, height: 856, aspectRatio: '1.91:1' },
    },
    twitter: {
      post: { name: "Twitter Post", width: 1200, height: 675, aspectRatio: '16:9' },
      header: { name: "Twitter Header", width: 1500, height: 500, aspectRatio: '3:1' },
    },
    linkedin: {
      post: { name: "LinkedIn Post", width: 1200, height: 627, aspectRatio: '1.91:1' },
      banner: { name: "LinkedIn Banner", width: 1584, height: 396, aspectRatio: '4:1' },
    },
    youtube: {
      thumbnail: { name: "YouTube Thumbnail", width: 1280, height: 720, aspectRatio: '16:9' },
      banner: { name: "YouTube Banner", width: 2560, height: 1440, aspectRatio: '16:9' },
    },
    tiktok: {
      video: { name: "TikTok Video", width: 1080, height: 1920, aspectRatio: '9:16' },
    },
  },
  presentation: {
    widescreen: { name: "Widescreen (16:9)", width: 1920, height: 1080, aspectRatio: '16:9' },
    standard: { name: "Standard (4:3)", width: 1024, height: 768, aspectRatio: '4:3' },
    square: { name: "Square", width: 1080, height: 1080, aspectRatio: '1:1' },
  },
  print: {
    document: {
      a4: { name: "A4", width: 794, height: 1123, aspectRatio: '√2:1' },
      a5: { name: "A5", width: 559, height: 794, aspectRatio: '√2:1' },
      letter: { name: "Letter", width: 816, height: 1056, aspectRatio: '1.29:1' },
      legal: { name: "Legal", width: 816, height: 1344, aspectRatio: '1.65:1' },
    },
    marketing: {
      poster: { name: "Poster", width: 1654, height: 2339, aspectRatio: '√2:1' },
      flyer: { name: "Flyer", width: 794, height: 1123, aspectRatio: '√2:1' },
      brochure: { name: "Brochure", width: 1123, height: 794, aspectRatio: '√2:1' },
      banner: { name: "Banner", width: 3000, height: 1000, aspectRatio: '3:1' },
    },
    stationery: {
      'business-card': { name: "Business Card", width: 354, height: 212, aspectRatio: '1.67:1' },
      letterhead: { name: "Letterhead", width: 816, height: 1056, aspectRatio: '1.29:1' },
      envelope: { name: "Envelope", width: 462, height: 324, aspectRatio: '1.43:1' },
    },
  },
};

/* ------------------------------------------------------------------ *
 * Functions                                                          *
 * ------------------------------------------------------------------ */

/**
 * Get platform dimensions using hierarchical lookup
 * @param mainType - Main design type (social, presentation, print)
 * @param platform - Platform/category (instagram, facebook, document, etc.)
 * @param format - Specific format (post, story, a4, etc.)
 * @returns Canvas dimensions
 */
export function getHierarchicalDimensions(mainType: string, platform: string, format: string): PlatformSize {
  try {
    const mainTypeObj = hierarchicalPlatforms[mainType];
    if (mainTypeObj && mainTypeObj[platform]) {
      const platformObj = mainTypeObj[platform];
      // Check if it's a PlatformCategory (has nested formats) or direct PlatformSize
      if ((platformObj as PlatformCategory)[format]) {
        return (platformObj as PlatformCategory)[format];
      }
      // If it's a direct PlatformSize (like presentation.widescreen)
      if ((platformObj as PlatformSize).name && format === platform) {
        return platformObj as PlatformSize;
      }
    }
  } catch (error) {
    console.warn('Error in hierarchical lookup:', error);
  }
  
  // Fallback to default
  return { name: "Custom", width: 1920, height: 1080, aspectRatio: '16:9' };
}

/**
 * Get platform dimensions with legacy compatibility
 * @param platformKey - Platform key (legacy or hierarchical)
 * @returns Canvas dimensions
 */
export function getPlatformDimensions(platformKey: string): PlatformSize {
  // Check if it's a legacy platform key
  if (legacyPlatformSizes[platformKey]) {
    return legacyPlatformSizes[platformKey];
  }
  
  // Try to parse hierarchical format: mainType.platform.format
  const parts = platformKey.split('.');
  if (parts.length === 3) {
    return getHierarchicalDimensions(parts[0], parts[1], parts[2]);
  }
  
  // Fallback
  return { name: "Custom", width: 1920, height: 1080, aspectRatio: '16:9' };
}

/**
 * Get all available platforms for a main type
 * @param mainType - Main design type
 * @returns Available platforms
 */
export function getAvailablePlatforms(mainType: string): string[] {
  if (hierarchicalPlatforms[mainType]) {
    return Object.keys(hierarchicalPlatforms[mainType]);
  }
  return [];
}

/**
 * Get all available formats for a platform
 * @param mainType - Main design type
 * @param platform - Platform name
 * @returns Available formats
 */
export function getAvailableFormats(mainType: string, platform: string): string[] {
  const mainTypeObj = hierarchicalPlatforms[mainType];
  if (mainTypeObj && mainTypeObj[platform]) {
    const platformObj = mainTypeObj[platform];
    // Check if it's a PlatformCategory (has nested formats)
    if ((platformObj as PlatformCategory) && typeof platformObj === 'object' && !(platformObj as PlatformSize).name) {
      return Object.keys(platformObj as PlatformCategory);
    }
    // If it's a direct PlatformSize, return the platform name as the format
    if ((platformObj as PlatformSize).name) {
      return [platform];
    }
  }
  return [];
}

/* ------------------------------------------------------------------ *
 * Exports                                                            *
 * ------------------------------------------------------------------ */
export {
  hierarchicalPlatforms,
  legacyPlatformSizes
};

// Legacy default export for backward compatibility
const legacyExports = {
  // Legacy export for backward compatibility
  ...legacyPlatformSizes,
  
  // New hierarchical functions
  getHierarchicalDimensions,
  getPlatformDimensions,
  getAvailablePlatforms,
  getAvailableFormats,
  hierarchicalPlatforms,
  legacyPlatformSizes
};

export default legacyExports;
