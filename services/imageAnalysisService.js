// imageAnalysisService.js – outputs Mongo‑friendly Page & Element layout
// ---------------------------------------------------------------------------------
//  Fixed duplicate function definition causing syntax error. Remote dimension
//  detection for Cloudinary + probe-image-size now integrated cleanly.
// ---------------------------------------------------------------------------------

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const OCR = require('./ocrService'); // Assuming OCR service is defined in ocrService.js

class ImageAnalysisService {
  constructor(ocr = OCR) {
    this.ocr = ocr;
    this.openai = null;
    this.initialized = false;
    this.model = 'gpt-4o-mini';
    this.maxTokens = 1100;
    this.temperature = 0.3;
  }

  /* ------------------------- 1. INIT ------------------------------------ */
  async initialize() {
    if (this.initialized) return true;
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing – analysis disabled');
    this.openai = new OpenAI({ apiKey: key });
    this.initialized = true;
    return true;
  }

  /* ------------------- helper to fetch remote dimensions --------------- */
  async _getRemoteDims(url) {
    // Try Cloudinary fl_getinfo
    try {
      const infoUrl = url.replace(/\/upload\//, '/upload/fl_getinfo/');
      const res = await fetch(infoUrl);
      if (res.ok) {
        const { input, output } = await res.json();
        console.log('input', input);

        if (input.width && input.height) return { width: input.width, height: input.height, aspectRatio: `${input.width}:${input.height}` };
      }
    } catch { }

    // Fallback to probe-image-size
    try {
      const probe = (await import('probe-image-size')).default;
      const { width, height } = await probe(url);
      if (width && height) return { width, height, aspectRatio: `${width}:${height}` };
    } catch { }

    return null;
  }

  /* ----------------------- 2. PUBLIC API -------------------------------- */
  async analyzeImage(imageUrl, dims = null) {
    await this.initialize();

    /* ---------- 1.  Dimensions -------------------------------------------- */
    if (!dims) dims = await this._getRemoteDims(imageUrl);

    /* ---------- 2.  Kick off GPT-Vision & OCR in parallel ----------------- */
    const llmPromise = this._callOpenAI(this._buildPrompt(imageUrl, dims));

    const ocrPromise = (this.ocr && typeof this.ocr.detectLines === 'function')
      ? this.ocr.detectLines(imageUrl).catch(e => {         // swallow OCR errors
        console.warn('[OCR] failed => continue without:', e.message);
        return [];                                        // <- must be array
      })
      : Promise.resolve([]);                                // OCR disabled

    const [ocrLinesRaw, llmRaw] = await Promise.all([ocrPromise, llmPromise]);

    /* ---------- 3.  Parse GPT answer safely ------------------------------- */
    const parsed = this._safeParseJSON(llmRaw) ?? {};
    const pages = Array.isArray(parsed.pages) ? parsed.pages : [];

    if (!pages.length) {                                    // still nothing?
      throw new Error('GPT-Vision did not return a pages[] array');
    }

    const page = pages[0];

    /* ---------- 4.  Normalise/defend arrays ------------------------------- */
    page.textBlocks = Array.isArray(page.textBlocks) ? page.textBlocks : [];
    page.shapes = Array.isArray(page.shapes) ? page.shapes : [];

    const ocrLines = Array.isArray(ocrLinesRaw) ? ocrLinesRaw : [];

    /* ---------- 5.  Lower-case colours & merge OCR positioning data ------- */
    const toHex = c => (c || '').toLowerCase();
    page.textBlocks = page.textBlocks.map(tb => ({ ...tb, color: toHex(tb.color) }));
    page.shapes = page.shapes.map(sh => ({
      ...sh,
      color: toHex(sh.color),
      borderColor: toHex(sh.borderColor)
    }));

    /* ---------- 5.  Build textBlocks purely from OCR ---------------------- */
    if (ocrLines.length) {
      // Simple helper for fuzzy string overlap
      const fuzzy = (a = '', b = '') =>
        a && b && a.toLowerCase().replace(/\s+/g, '')
          .includes(b.toLowerCase().replace(/\s+/g, '').slice(0, 30));

      const textBlocksFromOCR = ocrLines
        .filter(line => line.text?.trim())
        .map(line => {
          // find any GPT block with similar text – purely to pick up style attrs
          const gpt = page.textBlocks.find(tb => fuzzy(line.text, tb.text));
          
          const ret =  {
            text: line.text.trim(),
            x: line.x,                // ← OCR wins
            y: line.y,                // ← OCR wins
            width: line.w || this._estimateTextWidth(line.text.trim(), line.fontPx || 16),
            height: line.h || Math.round((line.fontPx || 16) * 1.2),
            fontSizeEstimate: line.fontPx || gpt?.fontSizeEstimate || 16,
            alignment: gpt?.alignment || 'left',
            fontWeight: gpt?.fontWeight || 'normal',
            color: toHex(gpt?.color) || '#000000'
          };

          console.log('ret', ret);

          return ret;
        });

      page.textBlocks = textBlocksFromOCR;
    } else {
      // No OCR → keep whatever GPT gave, but clear its x/y so they get normalised
      page.textBlocks.forEach(tb => { tb.x = undefined; tb.y = undefined; });
    }


    /* ---------- 6.  Assign dimensions & normalize positioning ------------- */
    Object.assign(page, dims || {});

    // Normalize positioning to ensure elements fit within canvas
    // if (page.width && page.height) {
    //   page.textBlocks = this._normalizeElementPositions(page.textBlocks, page.width, page.height);
    //   page.shapes = this._normalizeElementPositions(page.shapes, page.width, page.height);
    // }

    /* ---------- 7.  Map to element schema --------------------------------- */
    page.elements = [
      ...page.textBlocks.map(tb => this._mapTextBlockToElement(tb)),
      ...page.shapes.map(sh => this._mapShapeToElement(sh))
    ];

    page.background = this._deriveBackground(page);
    page.name = page.name || 'Page 1';
    page.canvas = { width: page.width || 0, height: page.height || 0 };

    /* ---------- 7.  Clean-up & return ------------------------------------- */
    delete page.textBlocks;
    delete page.shapes;

    return { pages: [page] };
  }



  async analyzeLocalImage(filePath) {
    await this.initialize();
    const buffer = fs.readFileSync(filePath);
    const { width, height } = await sharp(buffer).metadata();
    const aspectRatio = width && height ? `${width}:${height}` : '';
    const dimensions = { width, height, aspectRatio };
    const dataUrl = `data:${this._mimeFromExt(filePath)};base64,${buffer.toString('base64')}`;
    return this.analyzeImage(dataUrl, dimensions);
  }

  /* ------------------- 3. MAPPING HELPERS ------------------------------ */
  _mapTextBlockToElement(tb) {
    // Ensure valid width and height - estimate if not provided
    const estimatedWidth = tb.width || this._estimateTextWidth(tb.text || '', tb.fontSizeEstimate || 16);
    const estimatedHeight = tb.height || Math.round((tb.fontSizeEstimate || 16) * 1.2);

    return {
      kind: 'text',
      id: randomUUID(),
      x: tb.x || 0,
      y: tb.y || 0,
      width: Math.max(estimatedWidth, 20), // Minimum width of 20px
      height: Math.max(estimatedHeight, 16), // Minimum height of 16px
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      content: tb.text || '',
      fontSize: tb.fontSizeEstimate || 16,
      fontFamily: 'inherit',
      textAlign: tb.alignment || 'left',
      bold: /bold|extra/i.test(tb.fontWeight || ''),
      italic: false,
      underline: false,
      color: tb.color || '#000000'
    };
  }

  _mapShapeToElement(sh) {
    // Ensure valid width and height for shapes
    const shapeWidth = Math.max(sh.width || 100, 10); // Minimum width of 10px, default 100px
    const shapeHeight = Math.max(sh.height || 100, 10); // Minimum height of 10px, default 100px

    return {
      kind: 'shape',
      id: randomUUID(),
      x: sh.x || 0,
      y: sh.y || 0,
      width: shapeWidth,
      height: shapeHeight,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      shapeType: sh.shapeType === 'background' ? 'rect' : (sh.shapeType || 'rect'),
      backgroundColor: sh.color || '#ffffff',
      borderColor: sh.borderColor || '#000000',
      borderWidth: sh.borderWidth || 0
    };
  }

  _deriveBackground(page) {
    const bg = (page.elements || []).find(e => e.kind === 'shape' && e.shapeType === 'rect' && e.x === 0 && e.y === 0 && e.width >= page.width - 1 && e.height >= page.height - 1);
    return bg ? { type: 'color', value: bg.backgroundColor } : { type: 'color', value: '#ffffff' };
  }

  /* ------------------- 4. POSITIONING HELPERS -------------------------- */
  _normalizeElementPositions(elements, canvasWidth, canvasHeight) {
    if (!elements || !Array.isArray(elements) || !canvasWidth || !canvasHeight) {
      return elements || [];
    }

    // Sort elements by their original y position to maintain reading order
    const sortedElements = [...elements].sort((a, b) => (a.y || 0) - (b.y || 0));

    return sortedElements.map((element, index) => {
      const normalized = { ...element };

      // Basic bounds checking
      if (normalized.x < 0) normalized.x = 20;
      if (normalized.y < 0) normalized.y = 20;

      // Handle elements positioned way outside canvas
      if (normalized.x > canvasWidth * 0.9) {
        console.log(`📍 Element "${normalized.text || normalized.shapeType}" positioned outside canvas (x:${normalized.x})`);
        normalized.x = canvasWidth * 0.1; // Move to 10% from left
      }

      if (normalized.y > canvasHeight * 0.9) {
        console.log(`📍 Element "${normalized.text || normalized.shapeType}" positioned outside canvas (y:${normalized.y})`);
        normalized.y = canvasHeight * 0.1; // Move to 10% from top
      }

      // Special handling for text elements
      if (normalized.text) {
        // Detect and fix common poor positioning patterns
        this._applyTextPositioningRules(normalized, canvasWidth, canvasHeight, index, sortedElements.length);
      }

      // Special handling for shape elements
      if (normalized.shapeType && normalized.shapeType !== 'background') {
        this._applyShapePositioningRules(normalized, canvasWidth, canvasHeight);
      }

      return normalized;
    });
  }

  _applyTextPositioningRules(textElement, canvasWidth, canvasHeight, elementIndex, totalElements) {
    const minPadding = Math.max(20, Math.min(canvasWidth, canvasHeight) * 0.02); // 2% of smallest dimension, min 20px

    // Rule 1: Fix origin positioning (common AI mistake)
    if (textElement.x <= 5 && textElement.y <= 5) {
      console.log(`📍 Moving text "${textElement.text}" from origin to proper position`);

      // For headlines (larger font), center horizontally and place near top
      if ((textElement.fontSizeEstimate || 16) > canvasHeight * 0.05) {
        textElement.x = canvasWidth * 0.1; // 10% from left for headlines
        textElement.y = canvasHeight * 0.15; // 15% from top
      } else {
        // For body text, place with more margin
        textElement.x = canvasWidth * 0.1;
        textElement.y = canvasHeight * 0.25 + (elementIndex * canvasHeight * 0.1);
      }
    }

    // Rule 2: Ensure minimum padding from edges
    if (textElement.x < minPadding) textElement.x = minPadding;
    if (textElement.y < minPadding) textElement.y = minPadding;

    // Rule 3: Prevent text overflow on the right
    const estimatedTextWidth = this._estimateTextWidth(textElement.text, textElement.fontSizeEstimate || 16);
    if (textElement.x + estimatedTextWidth > canvasWidth - minPadding) {
      const newX = Math.max(minPadding, canvasWidth - estimatedTextWidth - minPadding);
      console.log(`📍 Adjusted text "${textElement.text}" x position from ${textElement.x} to ${newX} to prevent overflow`);
      textElement.x = newX;
    }

    // Rule 4: Prevent text from going off bottom
    const estimatedTextHeight = (textElement.fontSizeEstimate || 16) * 1.2; // Line height approximation
    if (textElement.y + estimatedTextHeight > canvasHeight - minPadding) {
      const newY = Math.max(minPadding, canvasHeight - estimatedTextHeight - minPadding);
      console.log(`📍 Adjusted text "${textElement.text}" y position from ${textElement.y} to ${newY} to prevent bottom overflow`);
      textElement.y = newY;
    }

    // Rule 5: Apply layout patterns based on text characteristics
    const isHeadline = (textElement.fontSizeEstimate || 16) > canvasHeight * 0.04;
    const isShortText = textElement.text.length < 20;

    if (isHeadline && isShortText) {
      // Center short headlines horizontally
      const textWidth = this._estimateTextWidth(textElement.text, textElement.fontSizeEstimate || 16);
      const centeredX = (canvasWidth - textWidth) / 2;
      if (centeredX > minPadding && centeredX + textWidth < canvasWidth - minPadding) {
        textElement.x = centeredX;
        console.log(`📍 Centered headline "${textElement.text}" horizontally`);
      }
    }
  }

  _applyShapePositioningRules(shapeElement, canvasWidth, canvasHeight) {
    const minPadding = 10;

    // Ensure shapes are within bounds
    if (shapeElement.x < 0) shapeElement.x = minPadding;
    if (shapeElement.y < 0) shapeElement.y = minPadding;

    // If shape dimensions extend beyond canvas, adjust
    const shapeWidth = shapeElement.width || 100;
    const shapeHeight = shapeElement.height || 100;

    if (shapeElement.x + shapeWidth > canvasWidth) {
      shapeElement.x = Math.max(minPadding, canvasWidth - shapeWidth - minPadding);
    }

    if (shapeElement.y + shapeHeight > canvasHeight) {
      shapeElement.y = Math.max(minPadding, canvasHeight - shapeHeight - minPadding);
    }
  }

  _estimateTextWidth(text, fontSize) {
    if (!text || !fontSize) return 0;
    // Simple text width estimation: average character is about 0.6x the font size
    return text.length * fontSize * 0.6;
  }

  /* ---------------------- 4. PROMPT / OPENAI --------------------------- */
  _buildPrompt(imageUrl, dimensions = null) {

    const pageSchema = `{
      description:string, objects:string[], colors:string[], themes:string[], mood:string, style:string,
      text:string, categories:string[], composition:string, lighting:string, setting:string,
      textBlocks:[{ text:string, fontSizeEstimate:number, fontWeight:string, textTransform:string, alignment:string, color:string, x:number, y:number, width:number, height:number }],
      shapes:[{ shapeType:string, color:string, borderColor:string, borderWidth:number, x:number, y:number, width:number, height:number }],
      fontFamilies:string[], fontSizes:number[]
    }`;

    const schema = `{ pages:[ ${pageSchema} ] }`;

    // Build dimension context for the AI
    const dimensionContext = dimensions
      ? `The image dimensions are ${dimensions.width}x${dimensions.height} pixels. Please ensure all fontSizeEstimate values are relative to these dimensions (e.g., a large headline might be 4-6% of the image height, body text might be 1-3% of the image height).`
      : 'Please estimate font sizes relative to the image dimensions.';

    return [
      { role: 'system', content: 'You are a vision analysis tool that MUST return JSON strictly matching the schema. When estimating font sizes, consider them relative to the image dimensions.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyse the image and respond with JSON. All colour values MUST be 7‑char HEX (#rrggbb) in lowercase. ${dimensionContext}\n\n${schema}` },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
        ]
      }
    ];
  }

  async _callOpenAI(messages) {
    const res = await this.openai.chat.completions.create({ model: this.model, messages, max_tokens: this.maxTokens, temperature: this.temperature });
    return res.choices?.[0]?.message?.content || '';
  }

  _safeParseJSON(raw) {
    try {
      return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch {
      return { pages: [{}] };
    }
  }

  _mimeFromExt(fp) {
    return {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }[path.extname(fp).toLowerCase()] || 'image/jpeg';
  }

  /* ------------------- GPT COLOR & STYLE ANALYSIS -------------------- */
  async analyzeImageColors(imagePath) {
    await this.initialize();
    
    try {
      // Convert image to base64 for GPT analysis
      let base64Image;
      let imageBuffer;
      
      if (imagePath.startsWith('http')) {
        // Handle remote URL
        const response = await fetch(imagePath);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // Handle local file
        imageBuffer = fs.readFileSync(imagePath);
      }
      
      // Optimize image size for GPT (max 20MB, but smaller is better for speed)
      const optimizedBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      base64Image = optimizedBuffer.toString('base64');
      
      const prompt = `Analyze this image and provide detailed color and styling information in JSON format. Focus on:

1. Background Colors: What are the dominant background colors? Include gradients if present.
2. Text Colors: What colors are used for text elements?
3. Accent Colors: What accent or highlight colors are present?
4. Overall Color Scheme: Describe the color palette (warm, cool, monochromatic, complementary, etc.)
5. Styling Characteristics: Modern, vintage, professional, playful, etc.

IMPORTANT: Return ONLY a valid JSON object WITHOUT any markdown formatting, code blocks, or backticks.
Just return the raw JSON data in this exact structure:

{
  "backgroundColor": "hex color or gradient description",
  "backgroundStyle": "solid/gradient/pattern/image",
  "dominantColors": ["#hex1", "#hex2", "#hex3"],
  "textColors": ["#hex1", "#hex2"],
  "accentColors": ["#hex1", "#hex2"],
  "colorScheme": "description of overall palette",
  "styleCharacteristics": ["modern", "clean", "professional"],
  "hasBackgroundImage": true/false,
  "backgroundDescription": "detailed description of background",
  "contrastLevel": "high/medium/low",
  "colorTemperature": "warm/cool/neutral"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'low' // Use 'low' for faster processing
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.1 // Low temperature for consistent results
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT');
      }

      // Clean content - sometimes GPT adds markdown code blocks
      let cleanedContent = content.trim();
      
      // Check if the content starts with a markdown code block and remove it
      if (cleanedContent.startsWith('```')) {
        // Find the first occurrence of JSON content
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
        } else {
          // If we can't find JSON properly, log and throw
          console.error('Could not find valid JSON in GPT response:', cleanedContent);
          throw new Error('Invalid JSON format in GPT response');
        }
      }
      
      // Additional safeguard - make sure we only have JSON content
      cleanedContent = cleanedContent.replace(/^```json\s*/, '')
                                   .replace(/^```\s*/, '')
                                   .replace(/\s*```$/, '');
                                   
      console.log('Cleaned JSON content for parsing:', cleanedContent.substring(0, 100) + '...');
      
      // Parse the cleaned JSON response
      let colorAnalysis;
      try {
        colorAnalysis = JSON.parse(cleanedContent);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError.message);
        console.error('Content that failed to parse:', cleanedContent);
        throw new Error(`Failed to parse color analysis JSON: ${jsonError.message}`);
      }
      
      // Validate and ensure we have the expected structure
      const validatedAnalysis = {
        backgroundColor: colorAnalysis.backgroundColor || '#ffffff',
        backgroundStyle: colorAnalysis.backgroundStyle || 'solid',
        dominantColors: Array.isArray(colorAnalysis.dominantColors) ? colorAnalysis.dominantColors : ['#000000'],
        textColors: Array.isArray(colorAnalysis.textColors) ? colorAnalysis.textColors : ['#000000'],
        accentColors: Array.isArray(colorAnalysis.accentColors) ? colorAnalysis.accentColors : [],
        colorScheme: colorAnalysis.colorScheme || 'neutral',
        styleCharacteristics: Array.isArray(colorAnalysis.styleCharacteristics) ? colorAnalysis.styleCharacteristics : ['modern'],
        hasBackgroundImage: !!colorAnalysis.hasBackgroundImage,
        backgroundDescription: colorAnalysis.backgroundDescription || '',
        contrastLevel: colorAnalysis.contrastLevel || 'medium',
        colorTemperature: colorAnalysis.colorTemperature || 'neutral',
        timestamp: new Date().toISOString()
      };

      console.log('🎨 Color analysis completed:', validatedAnalysis);
      return validatedAnalysis;

    } catch (error) {
      console.error('Color analysis error:', error);
      
      // Provide more diagnostic information
      let errorDetails = error.message;
      
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        errorDetails = 'JSON parsing error: Invalid format from GPT response. Check prompt and response handling.';
      } else if (error.message.includes('fetch')) {
        errorDetails = 'Network error while contacting OpenAI API. Check connectivity and API key.';
      }
      
      console.log('Detailed error diagnostics:', {
        errorType: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Return default values if analysis fails
      return {
        backgroundColor: '#ffffff',
        backgroundStyle: 'solid',
        dominantColors: ['#000000', '#ffffff'],
        textColors: ['#000000'],
        accentColors: [],
        colorScheme: 'neutral',
        styleCharacteristics: ['modern'],
        hasBackgroundImage: false,
        backgroundDescription: 'Analysis failed',
        contrastLevel: 'medium',
        colorTemperature: 'neutral',
        error: errorDetails,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new ImageAnalysisService();
