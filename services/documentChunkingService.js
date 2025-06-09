class DocumentChunkingService {
  constructor() {
    this.defaultChunkSize = 1000; // characters
    this.defaultOverlap = 200; // characters
    this.maxChunks = 100; // Limit chunks per document
  }

  /**
   * Chunk document using multiple strategies
   * @param {Object} document - Document with extracted content
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks with metadata
   */
  chunkDocument(document, options = {}) {
    const {
      strategy = 'hybrid',
      chunkSize = this.defaultChunkSize,
      overlap = this.defaultOverlap,
      preserveSections = true
    } = options;

    if (!document.text) {
      return [];
    }

    let chunks = [];

    switch (strategy) {
      case 'semantic':
        chunks = this.semanticChunking(document, { chunkSize, overlap, preserveSections });
        break;
      case 'fixed':
        chunks = this.fixedSizeChunking(document.text, { chunkSize, overlap });
        break;
      case 'section':
        chunks = this.sectionBasedChunking(document, { chunkSize });
        break;
      case 'hybrid':
      default:
        chunks = this.hybridChunking(document, { chunkSize, overlap, preserveSections });
        break;
    }

    // Add metadata and limit chunks
    return chunks
      .map((chunk, index) => ({
        ...chunk,
        index,
        assetId: document.assetId,
        strategy,
        createdAt: new Date()
      }))
      .slice(0, this.maxChunks);
  }

  /**
   * Hybrid chunking combining semantic and fixed-size approaches
   * @param {Object} document - Document with extracted content
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  hybridChunking(document, options) {
    const chunks = [];

    // 1. Create a document summary chunk (always first)
    chunks.push(this.createSummaryChunk(document));

    // 2. Process sections if available
    if (document.sections && document.sections.length > 0) {
      for (const section of document.sections) {
        const sectionChunks = this.chunkSection(section, options);
        chunks.push(...sectionChunks);
      }
    } else {
      // 3. Fall back to semantic chunking of full text
      const textChunks = this.semanticChunking(document, options);
      chunks.push(...textChunks.slice(1)); // Skip summary, already added
    }

    return chunks;
  }

  /**
   * Create a summary chunk for the entire document
   * @param {Object} document - Document with extracted content
   * @returns {Object} Summary chunk
   */
  createSummaryChunk(document) {
    const summaryParts = [];

    // Add document metadata
    if (document.title) summaryParts.push(`Title: ${document.title}`);
    if (document.author) summaryParts.push(`Author: ${document.author}`);
    if (document.subject) summaryParts.push(`Subject: ${document.subject}`);

    // Add section titles for overview
    if (document.sections && document.sections.length > 0) {
      const sectionTitles = document.sections
        .map(s => s.title)
        .filter(Boolean)
        .slice(0, 10); // Limit to first 10 sections
      
      if (sectionTitles.length > 0) {
        summaryParts.push(`Sections: ${sectionTitles.join(', ')}`);
      }
    }

    // Add beginning of document text
    const textPreview = document.text.substring(0, 500);
    summaryParts.push(textPreview);

    return {
      text: summaryParts.join('\n\n'),
      type: 'summary',
      title: 'Document Summary',
      page: 1,
      level: 0,
      wordCount: this.countWords(summaryParts.join(' '))
    };
  }

  /**
   * Chunk a single section
   * @param {Object} section - Section object
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks for the section
   */
  chunkSection(section, options) {
    const { chunkSize = this.defaultChunkSize, overlap = this.defaultOverlap } = options;
    const chunks = [];

    // If section is small enough, return as single chunk
    if (section.content.length <= chunkSize) {
      return [{
        text: `${section.title}\n\n${section.content}`,
        type: 'section',
        title: section.title,
        page: section.page || 1,
        level: section.level || 1,
        wordCount: this.countWords(section.content)
      }];
    }

    // Split large sections into paragraphs first
    const paragraphs = this.splitIntoParagraphs(section.content);
    let currentChunk = section.title + '\n\n';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, start new chunk
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > section.title.length + 2) {
        chunks.push({
          text: currentChunk.trim(),
          type: 'section_part',
          title: `${section.title} (Part ${chunkIndex + 1})`,
          page: section.page || 1,
          level: section.level || 1,
          wordCount: this.countWords(currentChunk)
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = `${section.title}\n\n${overlapText}${paragraph}\n\n`;
        chunkIndex++;
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    // Add final chunk if there's content
    if (currentChunk.length > section.title.length + 10) {
      chunks.push({
        text: currentChunk.trim(),
        type: chunkIndex > 0 ? 'section_part' : 'section',
        title: chunkIndex > 0 ? `${section.title} (Part ${chunkIndex + 1})` : section.title,
        page: section.page || 1,
        level: section.level || 1,
        wordCount: this.countWords(currentChunk)
      });
    }

    return chunks;
  }

  /**
   * Semantic chunking based on paragraph boundaries
   * @param {Object} document - Document with extracted content
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  semanticChunking(document, options) {
    const { chunkSize = this.defaultChunkSize, overlap = this.defaultOverlap } = options;
    const chunks = [];

    // Create summary chunk
    chunks.push(this.createSummaryChunk(document));

    // Split text into paragraphs
    const paragraphs = this.splitIntoParagraphs(document.text);
    let currentChunk = '';
    let chunkIndex = 1;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, finalize current chunk
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          type: 'content',
          title: `Content Part ${chunkIndex}`,
          page: Math.ceil(chunkIndex * chunkSize / 1000), // Rough page estimation
          level: 2,
          wordCount: this.countWords(currentChunk)
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + paragraph + '\n\n';
        chunkIndex++;
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        type: 'content',
        title: `Content Part ${chunkIndex}`,
        page: Math.ceil(chunkIndex * chunkSize / 1000),
        level: 2,
        wordCount: this.countWords(currentChunk)
      });
    }

    return chunks;
  }

  /**
   * Fixed-size chunking with overlap
   * @param {string} text - Text to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  fixedSizeChunking(text, options) {
    const { chunkSize = this.defaultChunkSize, overlap = this.defaultOverlap } = options;
    const chunks = [];
    
    let start = 0;
    let chunkIndex = 1;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // Try to break at sentence or word boundary
      if (end < text.length) {
        const lastSentence = text.lastIndexOf('.', end);
        const lastWord = text.lastIndexOf(' ', end);
        
        if (lastSentence > start + chunkSize * 0.7) {
          end = lastSentence + 1;
        } else if (lastWord > start + chunkSize * 0.8) {
          end = lastWord;
        }
      }

      const chunkText = text.substring(start, end).trim();
      
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          type: 'fixed',
          title: `Fixed Chunk ${chunkIndex}`,
          page: Math.ceil(start / 1000),
          level: 2,
          wordCount: this.countWords(chunkText)
        });
      }

      // Move start position accounting for overlap
      start = Math.max(start + chunkSize - overlap, end);
      chunkIndex++;

      // Safety break
      if (chunkIndex > this.maxChunks) break;
    }

    return chunks;
  }

  /**
   * Section-based chunking
   * @param {Object} document - Document with extracted content
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  sectionBasedChunking(document, options) {
    const chunks = [];

    // Create summary chunk
    chunks.push(this.createSummaryChunk(document));

    // Process each section as a separate chunk
    if (document.sections && document.sections.length > 0) {
      for (const section of document.sections) {
        chunks.push({
          text: `${section.title}\n\n${section.content}`,
          type: 'section',
          title: section.title,
          page: section.page || 1,
          level: section.level || 1,
          wordCount: this.countWords(section.content)
        });
      }
    } else {
      // No sections, fall back to semantic chunking
      const semanticChunks = this.semanticChunking(document, options);
      chunks.push(...semanticChunks.slice(1)); // Skip duplicate summary
    }

    return chunks;
  }

  /**
   * Split text into paragraphs
   * @param {string} text - Text to split
   * @returns {Array} Array of paragraphs
   */
  splitIntoParagraphs(text) {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Get overlap text from the end of a chunk
   * @param {string} text - Text to get overlap from
   * @param {number} overlapSize - Size of overlap in characters
   * @returns {string} Overlap text
   */
  getOverlapText(text, overlapSize) {
    if (overlapSize <= 0 || text.length <= overlapSize) return '';
    
    const overlapStart = text.length - overlapSize;
    let overlap = text.substring(overlapStart);
    
    // Try to start overlap at sentence boundary
    const sentenceStart = overlap.indexOf('. ');
    if (sentenceStart > 0 && sentenceStart < overlapSize * 0.5) {
      overlap = overlap.substring(sentenceStart + 2);
    }
    
    return overlap.trim() + '\n\n';
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Create hierarchical chunks with different levels
   * @param {Object} document - Document with extracted content
   * @returns {Object} Hierarchical chunk structure
   */
  createHierarchicalChunks(document) {
    return {
      document: this.createSummaryChunk(document),
      sections: document.sections ? document.sections.map(section => 
        this.chunkSection(section, { chunkSize: 800, overlap: 150 })
      ).flat() : [],
      paragraphs: this.semanticChunking(document, { chunkSize: 400, overlap: 100 })
    };
  }
}

// Create and export singleton instance
const documentChunkingService = new DocumentChunkingService();

module.exports = documentChunkingService;
