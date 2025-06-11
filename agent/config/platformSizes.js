// agent/config/platformSizes.js
// Platform-specific canvas dimensions for social media projects

const platformSizes = {
  'instagram-post': { name: "Instagram Post", width: 1080, height: 1080 },
  'instagram-story': { name: "Instagram Story", width: 1080, height: 1920 },
  'facebook-post': { name: "Facebook Post", width: 1200, height: 630 },
  'twitter-post': { name: "Twitter Post", width: 1200, height: 675 },
  'linkedin-post': { name: "LinkedIn Post", width: 1200, height: 627 },
  'youtube-thumbnail': { name: "YouTube Thumbnail", width: 1280, height: 720 },
  'tiktok-video': { name: "TikTok Video", width: 1080, height: 1920 }
};

module.exports = platformSizes;
