import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';


class PDFProcessingService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      this.initialized = true;
      console.log('PDF Processing service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PDF processing service:', error);
    }
  }

  /**
   * Extract text content from PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Object} Extracted content with text, metadata, and structure
   */
  async extractTextFromPDF(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`PDF file not found: ${filePath}`);
      }

      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);

      // Extract basic information
      const extractedContent = {
        text: this.cleanExtractedText(data.text),
        pageCount: data.numpages,
        wordCount: this.countWords(data.text),
        extractionMethod: 'text-based',
        extractionDate: new Date(),
        extractionVersion: '1.0.0'
      };

      // Extract metadata from PDF info
      if (data.info) {
        extractedContent.title = data.info.Title || '';
        extractedContent.author = data.info.Author || '';
        extractedContent.subject = data.info.Subject || '';
        extractedContent.creator = data.info.Creator || '';
        extractedContent.producer = data.info.Producer || '';
        extractedContent.creationDate = data.info.CreationDate || null;
        extractedContent.modificationDate = data.info.ModDate || null;
      }

      // Analyze text quality
      extractedContent.textQuality = this.assessTextQuality(extractedContent.text);

      // Extract structure (basic implementation)
      extractedContent.sections = this.extractSections(extractedContent.text);

      // Detect language (basic implementation)
      extractedContent.language = this.detectLanguage(extractedContent.text);

      console.log(`PDF text extraction completed: ${extractedContent.wordCount} words, ${extractedContent.pageCount} pages`);

      return extractedContent;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }

  /**
   * Clean extracted text by removing excessive whitespace and formatting artifacts
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanExtractedText(text) {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and headers/footers (basic pattern)
      .replace(/^\d+\s*$/gm, '')
      // Remove multiple line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Count words in text
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Assess the quality of extracted text
   * @param {string} text - Extracted text
   * @returns {string} Quality assessment: 'high', 'medium', or 'low'
   */
  assessTextQuality(text) {
    if (!text || text.length < 100) return 'low';

    const wordCount = this.countWords(text);
    const averageWordLength = text.replace(/\s+/g, '').length / wordCount;
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s.,!?;:'"()-]/g) || []).length / text.length;

    // High quality: good word count, reasonable word length, low special char ratio
    if (wordCount > 500 && averageWordLength > 3 && averageWordLength < 10 && specialCharRatio < 0.05) {
      return 'high';
    }

    // Medium quality: decent extraction but some issues
    if (wordCount > 100 && specialCharRatio < 0.15) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Extract document sections based on formatting patterns
   * @param {string} text - Full document text
   * @returns {Array} Array of section objects
   */
  extractSections(text) {
    if (!text) return [];

    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;
    let sectionContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Detect potential headers (basic heuristics)
      const isHeader = this.isLikelyHeader(line, lines[i + 1]);

      if (isHeader && currentSection) {
        // Save previous section
        currentSection.content = sectionContent.join(' ').trim();
        if (currentSection.content.length > 20) { // Only add substantial sections
          sections.push(currentSection);
        }
        sectionContent = [];
      }

      if (isHeader) {
        // Start new section
        currentSection = {
          title: line,
          content: '',
          level: this.determineHeaderLevel(line),
          page: Math.ceil(i / 50) // Rough page estimation
        };
      } else if (currentSection) {
        // Add content to current section
        sectionContent.push(line);
      } else {
        // Content before first header
        if (sections.length === 0) {
          sections.push({
            title: 'Introduction',
            content: line,
            level: 1,
            page: 1
          });
        } else {
          sections[sections.length - 1].content += ' ' + line;
        }
      }
    }

    // Add final section
    if (currentSection && sectionContent.length > 0) {
      currentSection.content = sectionContent.join(' ').trim();
      if (currentSection.content.length > 20) {
        sections.push(currentSection);
      }
    }

    return sections.slice(0, 50); // Limit sections to prevent excessive data
  }

  /**
   * Determine if a line is likely a header
   * @param {string} line - Current line
   * @param {string} nextLine - Next line (for context)
   * @returns {boolean} True if likely a header
   */
  isLikelyHeader(line, nextLine) {
    if (!line || line.length > 200) return false;

    // Check for common header patterns
    const headerPatterns = [
      /^[A-Z][A-Z\s]{5,}$/, // ALL CAPS headers
      /^\d+\.?\s+[A-Z]/, // Numbered headers (1. Introduction)
      /^Chapter\s+\d+/i, // Chapter headers
      /^Section\s+\d+/i, // Section headers
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:?$/, // Title Case headers
    ];

    const matchesPattern = headerPatterns.some(pattern => pattern.test(line));
    const isShort = line.length < 100;
    const hasNextLine = nextLine && nextLine.trim().length > 0;
    const endsWithoutPunctuation = !/[.!?]$/.test(line.trim());

    return matchesPattern || (isShort && hasNextLine && endsWithoutPunctuation);
  }

  /**
   * Determine header level based on formatting
   * @param {string} line - Header line
   * @returns {number} Header level (1-6)
   */
  determineHeaderLevel(line) {
    if (/^[A-Z][A-Z\s]{5,}$/.test(line)) return 1; // ALL CAPS
    if (/^\d+\.?\s+/.test(line)) return 2; // Numbered
    if (/^Chapter\s+\d+/i.test(line)) return 1; // Chapters
    if (/^Section\s+\d+/i.test(line)) return 2; // Sections
    return 3; // Default level
  }

  /**
   * Basic language detection
   * @param {string} text - Text to analyze
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    if (!text) return 'unknown';

    // Very basic language detection based on common words
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'];
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'];
    const spanishWords = ['el', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no'];

    const words = text.toLowerCase().split(/\s+/).slice(0, 500); // Sample first 500 words

    const englishScore = englishWords.reduce((score, word) => 
      score + words.filter(w => w === word).length, 0);
    const frenchScore = frenchWords.reduce((score, word) => 
      score + words.filter(w => w === word).length, 0);
    const spanishScore = spanishWords.reduce((score, word) => 
      score + words.filter(w => w === word).length, 0);

    if (englishScore > frenchScore && englishScore > spanishScore) return 'en';
    if (frenchScore > spanishScore) return 'fr';
    if (spanishScore > 0) return 'es';

    return 'en'; // Default to English
  }

  /**
   * Validate if file is a valid PDF
   * @param {string} filePath - Path to file
   * @returns {boolean} True if valid PDF
   */
  async isValidPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // Check PDF magic number
      const header = dataBuffer.slice(0, 4).toString();
      return header === '%PDF';
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract content from PDF file or URL
   * @param {string} source - File path or URL to the PDF
   * @returns {Object} Extracted content with enhanced metadata
   */
  async extractPDFContent(source) {
    let filePath = source;
    let tempFile = null;

    try {
      // If source is a URL, download it first
      if (source.startsWith('http://') || source.startsWith('https://')) {
        tempFile = await this.downloadFile(source);
        filePath = tempFile;
      }

      // Extract content using existing method
      const content = await this.extractTextFromPDF(filePath);

      // Enhance the content with additional analysis
      const enhancedContent = {
        ...content,
        numPages: content.pageCount,
        language: this.detectLanguage(content.text),
        quality: this.assessTextQuality(content.text),
        sections: this.extractSections(content.text),
        extractionSource: source.startsWith('http') ? 'url' : 'file'
      };

      return enhancedContent;

    } catch (error) {
      console.error('Error extracting PDF content:', error);
      throw error;
    } finally {
      // Clean up temporary file if created
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError);
        }
      }
    }
  }

  /**
   * Download file from URL to temporary location
   * @param {string} url - URL to download from
   * @returns {string} Path to temporary file
   */
  async downloadFile(url) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(__dirname, '..', 'temp-uploads');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = path.join(tempDir, `temp-pdf-${Date.now()}.pdf`);
      const file = fs.createWriteStream(tempFile);

      const client = url.startsWith('https://') ? https : http;

      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(tempFile);
        });
      });

      request.on('error', (error) => {
        fs.unlink(tempFile, () => {}); // Clean up on error
        reject(error);
      });

      file.on('error', (error) => {
        fs.unlink(tempFile, () => {}); // Clean up on error
        reject(error);
      });
    });
  }
}

// Create and export singleton instance
const pdfProcessingService = new PDFProcessingService();

export default pdfProcessingService;
