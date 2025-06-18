// src/services/ImageAnalysisService.ts
import fs from 'fs';
import path from 'path';
import OpenAI, { ClientOptions } from 'openai';
import { ChatCompletion } from 'openai/resources/chat';

/* ------------------------------------------------------------------ *
 *  Types                                                             *
 * ------------------------------------------------------------------ */

export interface AnalysisResult {
  description: string;
  objects: string[];
  colors: string[];
  themes: string[];
  mood: string;
  style: string;
  text: string;
  categories: string[];
  composition: string;
  lighting: string;
  setting: string;
}

export interface IImageAnalysisService {
  initialize(): Promise<void>;
  analyzeImage(imageUrl: string): Promise<AnalysisResult | null>;
  analyzeLocalImage(filePath: string): Promise<AnalysisResult | null>;
  createSearchableText(analysis: AnalysisResult | null): string;
  extractColorPalette(analysis: AnalysisResult | null): string[];
  extractThemesAndCategories(
    analysis: AnalysisResult | null
  ): { themes: string[]; categories: string[] };
}

/* ------------------------------------------------------------------ *
 *  Service                                                           *
 * ------------------------------------------------------------------ */

class ImageAnalysisService implements IImageAnalysisService {
  private openai: OpenAI | null = null;
  private initialized = false;

  /** Call once on app bootstrap */
  public async initialize(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found. Image analysis will be disabled.');
      return;
    }

    try {
      const opts: ClientOptions = { apiKey: process.env.OPENAI_API_KEY };
      this.openai = new OpenAI(opts);
      this.initialized = true;
      console.log('✅ Image analysis service initialized');
    } catch (err) {
      console.error('Failed to initialize image analysis service:', err);
    }
  }

  /**
   * Analyze a remote or data-URL image with GPT-4o-mini vision
   */
  public async analyzeImage(imageUrl: string): Promise<AnalysisResult | null> {
    if (!this.initialized || !this.openai) {
      console.warn('Image analysis service not available');
      return null;
    }

    try {
      const completion: ChatCompletion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1_000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this image and provide detailed information about its visual content. Return a JSON object with the following structure (no markdown):

{
  "description": "",
  "objects": [],
  "colors": [],
  "themes": [],
  "mood": "",
  "style": "",
  "text": "",
  "categories": [],
  "composition": "",
  "lighting": "",
  "setting": ""
}

Focus on keywords and visual details useful for semantic search.`,
              },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
      });

      const raw = completion.choices[0].message?.content ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed: Partial<AnalysisResult> =
        jsonMatch && jsonMatch[0] ? JSON.parse(jsonMatch[0]) : { description: raw };

      const result: AnalysisResult = {
        description: '',
        objects: [],
        colors: [],
        themes: [],
        mood: '',
        style: '',
        text: '',
        categories: [],
        composition: '',
        lighting: '',
        setting: '',
        ...parsed,
      };

      return result;
    } catch (err) {
      console.error('Error analyzing image:', err);
      return null;
    }
  }

  /**
   * Analyze a local image file by absolute or relative path
   */
  public async analyzeLocalImage(filePath: string): Promise<AnalysisResult | null> {
    if (!this.initialized || !this.openai) {
      console.warn('Image analysis service not available');
      return null;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const mime = this.getMimeTypeFromFile(filePath);
      const dataUrl = `data:${mime};base64,${base64}`;
      return this.analyzeImage(dataUrl);
    } catch (err) {
      console.error('Error analyzing local image:', err);
      return null;
    }
  }

  /* -------------------------------------------------------------- *
   *  Helpers                                                       *
   * -------------------------------------------------------------- */

  private getMimeTypeFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return map[ext] ?? 'image/jpeg';
  }

  public createSearchableText(analysis: AnalysisResult | null): string {
    if (!analysis) return '';

    return [
      analysis.description,
      ...analysis.objects,
      ...analysis.colors,
      ...analysis.themes,
      analysis.mood,
      analysis.style,
      analysis.text,
      ...analysis.categories,
      analysis.composition,
      analysis.lighting,
      analysis.setting,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  public extractColorPalette(analysis: AnalysisResult | null): string[] {
    return analysis?.colors ?? [];
  }

  public extractThemesAndCategories(
    analysis: AnalysisResult | null
  ): { themes: string[]; categories: string[] } {
    return {
      themes: analysis?.themes ?? [],
      categories: analysis?.categories ?? [],
    };
  }
}

/* ------------------------------------------------------------------ *
 *  Singleton export                                                  *
 * ------------------------------------------------------------------ */

const imageAnalysisService: IImageAnalysisService = new ImageAnalysisService();
export default imageAnalysisService;
