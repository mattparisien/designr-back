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

class ImageAnalysisService {
  constructor() {
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
      console.log('is res ok', res.ok);
      if (res.ok) {
        const { input, output }  = await res.json();
        console.log('Cloudinary dimensions:', width, height);
        if (input.width && input.height) return { width: input.width, height: input.height, aspectRatio: `${input.width}:${input.height}` };
      }
    } catch {}

    // Fallback to probe-image-size
    try {
      const probe = (await import('probe-image-size')).default;
      const { width, height } = await probe(url);
      if (width && height) return { width, height, aspectRatio: `${width}:${height}` };
    } catch {}

    return null;
  }

  /* ----------------------- 2. PUBLIC API -------------------------------- */
  async analyzeImage(imageUrl, dims = null) {
    await this.initialize();

    if (!dims) dims = await this._getRemoteDims(imageUrl);

    const messages = this._buildPrompt(imageUrl);
    const raw = await this._callOpenAI(messages);
    const parsed = this._safeParseJSON(raw);

    if (!parsed.pages || !parsed.pages.length) parsed.pages = [{}];
    const page = parsed.pages[0];

    // normalise colours
    if (page.textBlocks) page.textBlocks = page.textBlocks.map(tb => ({ ...tb, color: (tb.color || '').toLowerCase() }));
    if (page.shapes) page.shapes = page.shapes.map(sh => ({ ...sh, color: (sh.color || '').toLowerCase(), borderColor: (sh.borderColor || '').toLowerCase() }));

    Object.assign(page, dims || {});

    // map to element structures
    page.elements = [
      ...(page.textBlocks || []).map(tb => this._mapTextBlockToElement(tb)),
      ...(page.shapes || []).map(sh => this._mapShapeToElement(sh))
    ];

    page.background = this._deriveBackground(page);
    page.name = page.name || 'Page 1';
    page.canvas = { width: page.width || 0, height: page.height || 0 };

    delete page.textBlocks;
    delete page.shapes;

    return { pages: [page] };
  }

  async analyzeLocalImage(filePath) {
    await this.initialize();
    const buffer = fs.readFileSync(filePath);
    const { width, height } = await sharp(buffer).metadata();
    const aspectRatio = width && height ? `${width}:${height}` : '';
    const dataUrl = `data:${this._mimeFromExt(filePath)};base64,${buffer.toString('base64')}`;
    return this.analyzeImage(dataUrl, { width, height, aspectRatio });
  }

  /* ------------------- 3. MAPPING HELPERS ------------------------------ */
  _mapTextBlockToElement(tb) {
    return {
      kind: 'text',
      id: randomUUID(),
      x: tb.x,
      y: tb.y,
      width: tb.width,
      height: tb.height,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      content: tb.text,
      fontSize: tb.fontSizeEstimate,
      fontFamily: 'inherit',
      textAlign: tb.alignment || 'left',
      bold: /bold|extra/i.test(tb.fontWeight || ''),
      italic: false,
      underline: false,
      color: tb.color || '#000000'
    };
  }

  _mapShapeToElement(sh) {
    return {
      kind: 'shape',
      id: randomUUID(),
      x: sh.x,
      y: sh.y,
      width: sh.width,
      height: sh.height,
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

  /* ---------------------- 4. PROMPT / OPENAI --------------------------- */
  _buildPrompt(imageUrl) {
    const pageSchema = `{
      description:string, objects:string[], colors:string[], themes:string[], mood:string, style:string,
      text:string, categories:string[], composition:string, lighting:string, setting:string,
      textBlocks:[{ text:string, fontSizeEstimate:number, fontWeight:string, textTransform:string, alignment:string, color:string, x:number, y:number, width:number, height:number }],
      shapes:[{ shapeType:string, color:string, borderColor:string, borderWidth:number, x:number, y:number, width:number, height:number }],
      fontFamilies:string[], fontSizes:number[]
    }`;

    const schema = `{ pages:[ ${pageSchema} ] }`;

    return [
      { role: 'system', content: 'You are a vision analysis tool that MUST return JSON strictly matching the schema.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyse the image and respond with JSON. All colour values MUST be 7‑char HEX (#rrggbb) in lowercase.\n\n${schema}` },
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
}

module.exports = new ImageAnalysisService();
