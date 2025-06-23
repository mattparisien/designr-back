# Template Vector Store Integration

This document describes the template vector store functionality that enables intelligent template discovery through semantic search capabilities.

## Overview

The template vector store system automatically vectorizes templates when they are created, updated, or deleted. This enables:

- **Semantic Search**: Find templates based on meaning, not just keyword matching
- **Hybrid Search**: Combine traditional text search with vector similarity
- **Similar Template Discovery**: Find templates with similar visual or content characteristics
- **Intelligent Recommendations**: Suggest relevant templates based on user intent

## Architecture

### Components

1. **TemplateVectorService** (`/services/templateVectorService.js`)
   - Manages Pinecone vector database for templates
   - Handles embedding generation using OpenAI
   - Provides search and similarity functions

2. **ProjectController Integration** (`/controllers/projectController.js`)
   - Automatically vectorizes templates on creation
   - Updates vectors when templates are modified
   - Removes vectors when templates are deleted
   - Handles template/project conversion scenarios

3. **Search Endpoints** (`/routes/projects.js`)
   - `/api/projects/templates/search` - Vector-based template search
   - `/api/projects/templates/hybrid-search` - Combined text + vector search
   - `/api/projects/:id/similar` - Find similar templates

4. **Migration Script** (`/scripts/template-vector-migrator.js`)
   - Batch process existing templates
   - Clear and re-index vectors
   - Test search functionality

## Features

### Template Vectorization

When a project is marked as a template (`isTemplate: true`), the system:

1. **Extracts searchable content**:
   - Title, description, type, category, tags
   - Canvas size and dimensions
   - Text content from elements
   - Visual style information (fonts, colors, shapes)
   - Template complexity metrics

2. **Generates embedding**:
   - Uses OpenAI text-embedding-ada-002 model
   - 1536-dimensional vectors
   - Stored in dedicated Pinecone index

3. **Enriches metadata**:
   - Template characteristics (element counts, page count)
   - Visual properties (colors, fonts, complexity)
   - Categorization and tagging information

### Search Capabilities

#### Vector Search
```javascript
// Search templates by semantic meaning
GET /api/projects/templates/search?query=business presentation&limit=10&threshold=0.7
```

Parameters:
- `query` (required): Search query
- `limit` (optional): Maximum results (default: 20)
- `threshold` (optional): Similarity threshold (default: 0.7)
- `type`, `category`, `featured`, `popular`: Filtering options
- `canvasWidth`, `canvasHeight`: Canvas size filtering

#### Hybrid Search
```javascript
// Combine text and vector search with weighted scoring
GET /api/projects/templates/hybrid-search?query=modern design&vectorWeight=0.7&textWeight=0.3
```

Parameters:
- `query` (required): Search query
- `vectorWeight` (optional): Vector search weight (default: 0.7)
- `textWeight` (optional): Text search weight (default: 0.3)
- All vector search parameters also supported

#### Similar Templates
```javascript
// Find templates similar to a specific template
GET /api/projects/12345/similar?limit=5&type=presentation
```

Parameters:
- `limit` (optional): Maximum results (default: 10)
- `type`, `category`: Filtering options

### Response Format

All search endpoints return:

```json
{
  "results": [
    {
      // Full template/project object
      "_id": "template_id",
      "title": "Template Title",
      "description": "Template description",
      "type": "presentation",
      "category": "business",
      "tags": ["business", "professional"],
      // ... other template fields
      
      // Search-specific fields
      "vectorScore": 0.85,           // Vector similarity score
      "textScore": 0.72,             // Text search score (hybrid only)
      "totalScore": 0.81,            // Combined score (hybrid only)
      "similarityScore": 0.78,       // Similarity score (similar endpoint)
      "searchRelevance": 0.85        // General relevance score
    }
  ],
  "searchType": "vector",           // "vector", "hybrid", or "similarity"
  "totalResults": 15,
  "query": "business presentation",
  "weights": {                      // Hybrid search only
    "vector": 0.7,
    "text": 0.3
  }
}
```

## Integration Points

### Automatic Vectorization

The system automatically handles vectorization in these scenarios:

1. **Template Creation**:
   ```javascript
   // When isTemplate: true, template is automatically vectorized
   POST /api/projects
   {
     "title": "New Template",
     "isTemplate": true,
     // ... other fields
   }
   ```

2. **Template Updates**:
   ```javascript
   // Vector is updated when template is modified
   PUT /api/projects/:id
   {
     "title": "Updated Template Title",
     // ... other updates
   }
   ```

3. **Template Deletion**:
   ```javascript
   // Vector is automatically removed
   DELETE /api/projects/:id
   ```

4. **Template Conversion**:
   ```javascript
   // Handles project ↔ template conversion
   PUT /api/projects/:id/toggle-template
   {
     "isTemplate": true
   }
   ```

### Frontend Integration

Templates can be discovered through enhanced search:

```javascript
// Basic vector search
const searchTemplates = async (query) => {
  const response = await fetch(`/api/projects/templates/search?query=${encodeURIComponent(query)}`);
  return response.json();
};

// Hybrid search with custom weights
const hybridSearch = async (query, vectorWeight = 0.7) => {
  const response = await fetch(
    `/api/projects/templates/hybrid-search?query=${encodeURIComponent(query)}&vectorWeight=${vectorWeight}`
  );
  return response.json();
};

// Find similar templates
const getSimilarTemplates = async (templateId) => {
  const response = await fetch(`/api/projects/${templateId}/similar`);
  return response.json();
};
```

## Configuration

### Environment Variables

```bash
# Required for vector functionality
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key

# Optional: Customize vector settings
TEMPLATE_VECTOR_DIMENSION=1536
TEMPLATE_INDEX_NAME=canva-templates
```

### Pinecone Setup

The system automatically creates a Pinecone index with these specifications:
- **Name**: `canva-templates`
- **Dimension**: 1536 (OpenAI text-embedding-ada-002)
- **Metric**: Cosine similarity
- **Cloud**: AWS us-east-1 (serverless)

## Migration and Maintenance

### Initial Setup

1. **Migrate Existing Templates**:
   ```bash
   node scripts/template-vector-migrator.js migrate
   ```

2. **Check Statistics**:
   ```bash
   node scripts/template-vector-migrator.js stats
   ```

3. **Test Search**:
   ```bash
   node scripts/template-vector-migrator.js test "business presentation"
   ```

### Maintenance Commands

```bash
# Full reset (clear and re-migrate)
node scripts/template-vector-migrator.js full-reset

# Clear vector store
node scripts/template-vector-migrator.js clear

# Re-index all templates
node scripts/template-vector-migrator.js migrate
```

### Monitoring

The system provides logging for:
- Template vectorization events
- Search performance
- Vector store operations
- Error handling

Monitor logs for:
```
Template 12345 (Business Presentation) added to vector store
Template vector search for "modern design" returned 8 results
Template vector service initialized successfully
```

## Error Handling

The system is designed to be resilient:

- **Graceful Degradation**: Template operations continue even if vector store is unavailable
- **Non-blocking**: Vector operations don't block template CRUD operations
- **Retry Logic**: Automatic retry for transient failures
- **Fallback**: Falls back to traditional search when vector search fails

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Large migrations process templates in batches
2. **Rate Limiting**: Respects OpenAI API rate limits
3. **Caching**: Vector embeddings are cached in Pinecone
4. **Selective Updates**: Only re-vectorizes when template content changes

### Scaling

- **Index Capacity**: Pinecone serverless scales automatically
- **Search Performance**: Sub-second search response times
- **Embedding Generation**: Async processing for large batches
- **Memory Usage**: Efficient vector storage and retrieval

## Testing

### Unit Tests

Run the template vectorization test:
```bash
node test-template-vectorization.js
```

### Integration Tests

The system includes comprehensive tests for:
- Template creation with vectorization
- Search functionality
- Similarity matching
- Error handling scenarios

## Future Enhancements

Planned improvements:
- **Visual Similarity**: Integrate image-based embeddings for visual template matching
- **User Preferences**: Personalized template recommendations
- **A/B Testing**: Compare vector vs traditional search performance
- **Analytics**: Track search patterns and template popularity
- **Multilingual**: Support for non-English template content

## Troubleshooting

### Common Issues

1. **Vector Store Not Available**:
   - Check PINECONE_API_KEY environment variable
   - Verify Pinecone service status
   - Check network connectivity

2. **Embedding Generation Fails**:
   - Verify OPENAI_API_KEY is valid
   - Check OpenAI API quota and rate limits
   - Monitor API response times

3. **Search Returns No Results**:
   - Verify templates are vectorized (run stats command)
   - Check search threshold (try lower values)
   - Ensure query is meaningful

4. **Performance Issues**:
   - Monitor embedding generation time
   - Check Pinecone index statistics
   - Review batch processing logs

### Debug Commands

```bash
# Check vector store health
node scripts/template-vector-migrator.js stats

# Test specific search query
node scripts/template-vector-migrator.js test "your search query"

# Verify template vectorization
node test-template-vectorization.js
```
