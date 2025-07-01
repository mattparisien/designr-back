// services/OcrService.js
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const { JSDOM } = require('jsdom');              // npm i jsdom

class OcrService {
  constructor() {
    this._workerPromise = null;                         // lazy-init once
    this._dpi = 96;                           // sane fallback
  }

  /* ──────────────────────────────────────────────────────────── *
   * Initialise a single worker, handling API differences
   * ──────────────────────────────────────────────────────────── */
  async _getWorker() {
    if (this._workerPromise) return this._workerPromise;

    this._workerPromise = (async () => {
      /* v5.x: createWorker(lang, options) – already loaded        *
       * v4.x: createWorker(options)      – must load/initialise   */
      const worker = await createWorker('eng');

      /* Older API still needs initialise(lang) */
      if (typeof worker.initialize === 'function') {
        await worker.initialize('eng');
      }

      // /* Some builds expose setParameters, some expose setParameter */
      // const setParamsFn = worker.setParameters || worker.setParameter;
      // if (typeof setParamsFn === 'function') {
      //   await setParamsFn({
      //     tessjs_create_hocr: '1',          // JS-specific flag for hOCR
      //     hocr_font_info: '1',          // include x_size metrics
      //     user_defined_dpi: '96'         // lock DPI for pt→px math
      //   });
      // }

      return worker;
    })();

    return this._workerPromise;
  }

  /* ──────────────────────────────────────────────────────────── *
   * Public: detect text lines and return [{ text,x,y,w,h,fontPx }]
   * Accepts Buffer, URL, or data-URI
   * ──────────────────────────────────────────────────────────── */
  async detectLines(image) {
    const worker = await this._getWorker();

    /* ---------- run OCR --------------------------------------- */
    const { data } = await worker.recognize(image, {}, {
      hocr: true
    });

    console.log('data', data);
    
    if (!data || !data.hocr) {
      console.warn('[OCR] No hOCR returned; got only plain text.');
      return [];                                         // bail gracefully
    }

    /* ---------- find real DPI if present ---------------------- */
    try {
      const { density } = await sharp(image).metadata(); // works for Buffer|URL
      if (density && density > 10) this._dpi = density;
    } catch { /* ignore all metadata errors */ }

    /* ---------- parse hOCR ------------------------------------ */
    const doc = new JSDOM(data.hocr).window.document;
    const lines = [...doc.querySelectorAll('.ocr_line')];
    if (!lines.length) return [];

    const pt2px = pt => Math.round((pt * this._dpi) / 72);

    return lines.map(node => {
      
      const title = node.getAttribute('title') || '';
      const bbox = /bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(title);
      const xSize = /x_size\s+(\d+)/.exec(title);        // pt

      const x1 = +bbox[1], y1 = +bbox[2], x2 = +bbox[3], y2 = +bbox[4];
      const h = y2 - y1;
      const text = node.textContent.trim();
      const fontPx = xSize ? pt2px(+xSize[1]) : Math.round(h / 1.2);
      
      return {
        text,
        x: x1,
        y: y1,
        w: x2 - x1,
        h,
        fontPx
      };
    });
  }
}

module.exports = new OcrService();
