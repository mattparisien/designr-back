# AI Agent Branding Integration

This document explains how the AI agent can now use user branding information to create brand-consistent projects.

## New Tools Added

### 1. `getBranding` Tool

Fetches user branding information including color palettes, fonts, logos, and brand voice.

**Usage:**
```javascript
const branding = await getBrandingTool.invoke({
    userId: "user123",           // Optional: defaults to test user
    brandId: "brand456"          // Optional: gets active brand if not specified
});
```

**Returns:**
```javascript
{
    success: true,
    data: {
        brandId: "...",
        brandName: "Company Name",
        tagline: "Company Tagline",
        industry: "Technology",
        colors: {
            primary: "#3366cc",
            secondary: ["#66cc99", "#cc6699"],
            accent: ["#ffcc00"],
            palette: { /* full palette object */ },
            allPalettes: [ /* all available palettes */ ]
        },
        fonts: {
            heading: "Montserrat",
            body: "Open Sans",
            pairings: [ /* font pairings */ ]
        },
        logos: {
            primary: { /* primary logo object */ },
            all: [ /* all logos */ ]
        },
        voice: { /* brand voice/tone */ },
        guidelines: "Brand guidelines text..."
    }
}
```

### 2. `createBrandedProject` Tool

Creates a new project with automatic brand styling applied based on user's branding.

**Usage:**
```javascript
const project = await createBrandedProjectTool.invoke({
    projectRequest: {
        title: "My Branded Project",
        description: "A project with brand colors",
        type: "social",
        layout: {
            pages: [{
                name: "Page 1",
                canvas: { width: 1080, height: 1080 },
                elements: [
                    {
                        id: "text1",
                        kind: "text",
                        x: 50, y: 50,
                        width: 300, height: 50,
                        content: "Brand Headline",
                        fontSize: 24
                        // color will be auto-applied from brand
                    }
                ]
            }]
        }
    },
    userId: "user123",           // Optional
    brandId: "brand456"          // Optional
});
```

**Returns:**
```javascript
{
    success: true,
    data: {
        project: { /* created project data */ },
        brandingApplied: true,
        brandInfo: {
            brandId: "...",
            brandName: "Company Name",
            colorsUsed: { /* colors applied */ },
            fontsUsed: { /* fonts applied */ }
        }
    }
}
```

### 3. Enhanced `createProject` Tool

The original `createProject` tool now also accepts a `brandColors` parameter:

```javascript
const project = await createProjectTool.invoke({
    project: { /* project data */ },
    preset: "social:instagram-post",
    brandColors: {
        primary: "#3366cc",
        secondary: ["#66cc99"],
        accent: ["#ffcc00"]
    }
});
```

## Brand Styling Rules

### Colors
1. **Text Elements:**
   - Primary color used for main headlines
   - Secondary colors used for variety in multiple text elements
   - Accent colors used for special emphasis

2. **Shape Elements:**
   - Brand colors applied with reduced opacity (50%)
   - Border colors use secondary brand colors

3. **Backgrounds:**
   - Automatically selects contrasting background color
   - Light background if brand primary is dark, dark if primary is light

### Fonts
1. **Text Elements:**
   - Heading font used for text with fontSize > 18px
   - Body font used for smaller text
   - Falls back to existing fontFamily if already specified

## Agent Workflow Integration

The agent can now:

1. **Fetch User Branding:** Use `getBranding` to understand user's brand identity
2. **Create Consistent Projects:** Use `createBrandedProject` for automatic brand application
3. **Apply Selective Branding:** Use enhanced `createProject` with specific brand colors

## Example Agent Conversation Flow

```
User: "Create a social media post for my company"

Agent Process:
1. Calls getBranding() to fetch user's brand colors and fonts
2. Calls createBrandedProject() with:
   - Social media canvas size (1080x1080)
   - Text elements using brand fonts
   - Colors automatically applied from brand palette
   - Background color optimized for brand contrast

Result: Brand-consistent social media post
```

## Benefits

1. **Brand Consistency:** All projects automatically follow brand guidelines
2. **Time Saving:** No need to manually specify colors and fonts
3. **Professional Results:** Projects look cohesive with brand identity
4. **Flexibility:** Can override brand styling when needed
5. **Multi-Brand Support:** Works with multiple brands per user

## API Integration

The tools integrate with existing API endpoints:
- `GET /api/brands` - Fetch user brands
- `GET /api/brands/:id` - Fetch specific brand
- `POST /api/projects` - Create projects (with brand styling applied)

## Testing

Run the branding tools test:
```bash
node test-branding-tools.js
```

This will test both the brand fetching and branded project creation functionality.
