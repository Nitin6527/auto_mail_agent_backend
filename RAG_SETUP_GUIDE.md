# RAG Pipeline Setup Guide

This guide will help you set up the Retrieval-Augmented Generation (RAG) pipeline in your Node.js backend. The pipeline fetches emails from Gmail, chunks them, generates vector embeddings, and stores them in Qdrant for semantic search.

## Architecture Overview

The RAG pipeline consists of 4 main steps:

1. **Fetch Email/Thread** - Retrieve data from your Gmail API
2. **Create Chunks Manually** - Split content into manageable pieces (1000 chars with 200 char overlap by default)
3. **Call Embeddings API** - Generate vector embeddings using OpenAI, Google, or local models
4. **Upsert to Qdrant** - Store vectors with metadata in Qdrant vector database

## Prerequisites

- Node.js 18+
- Docker (for running Qdrant locally)
- An embeddings provider account (OpenAI, Google, or use local embeddings)

## Installation

### 1. Install Required Dependencies

Choose based on your preferred embeddings provider:

**For OpenAI:**
```bash
npm install openai @qdrant/js-client
```

**For Google Gemini:**
```bash
npm install @google/generative-ai @qdrant/js-client
```

**For Local Embeddings (Transformers.js):**
```bash
npm install @huggingface/transformers @qdrant/js-client
```

**All providers:**
```bash
npm install openai @google/generative-ai @qdrant/js-client @huggingface/transformers
```

### 2. Set Up Qdrant Vector Database

**Option A: Docker (Recommended for Development)**

```bash
docker pull qdrant/qdrant
docker run -p 6333:6333 -p 6334:6334 \
  -e QDRANT_API_KEY=your-api-key \
  qdrant/qdrant:latest
```

**Option B: Qdrant Cloud (Production)**
1. Create account at https://cloud.qdrant.io
2. Create a cluster and get your API endpoint and API key
3. Use the endpoint URL and API key in your environment variables

## Configuration

### Environment Variables

Add the following to your `.env` file (or `secrets/.env`):

```env
# Embeddings Provider Configuration
EMBEDDINGS_PROVIDER=openai          # Options: openai, google, local
OPENAI_API_KEY=sk-...              # Required if using OpenAI
GOOGLE_API_KEY=...                 # Required if using Google

# Qdrant Configuration
QDRANT_HOST=localhost              # or your Qdrant cloud host
QDRANT_PORT=6333
QDRANT_API_KEY=your-qdrant-api-key # Optional, required for cloud
QDRANT_COLLECTION_NAME=emails      # Collection name in Qdrant
QDRANT_VECTOR_SIZE=1536            # 1536 for OpenAI, 768 for Google, vary for local
```

### Vector Size by Provider

- **OpenAI (text-embedding-3-small)**: 1536 dimensions
- **OpenAI (text-embedding-3-large)**: 3072 dimensions
- **Google (embedding-001)**: 768 dimensions
- **Local (all-MiniLM-L6-v2)**: 384 dimensions

## API Endpoints

### Index an Email Message

```http
POST /api/rag/index-message/:messageId
```

**Description**: Fetch a Gmail message, chunk it, generate embeddings, and store in Qdrant.

**Response:**
```json
{
  "message": "Message indexed successfully",
  "result": {
    "success": true,
    "sourceId": "message-id",
    "sourceType": "message",
    "chunksCreated": 5,
    "vectorsUpserted": 5
  }
}
```

### Index an Email Thread

```http
POST /api/rag/index-thread/:threadId
```

**Description**: Fetch a Gmail thread (all messages), chunk it, generate embeddings, and store in Qdrant.

**Response:**
```json
{
  "message": "Thread indexed successfully",
  "result": {
    "success": true,
    "sourceId": "thread-id",
    "sourceType": "thread",
    "chunksCreated": 12,
    "vectorsUpserted": 12
  }
}
```

### Search for Similar Content

```http
GET /api/rag/search?q=<query>&limit=<limit>
```

**Parameters:**
- `q` (required): Search query text
- `limit` (optional): Number of results to return (1-100, default: 10)

**Example:**
```http
GET /api/rag/search?q=project%20deadline&limit=5
```

**Response:**
```json
{
  "query": "project deadline",
  "limit": 5,
  "count": 3,
  "results": [
    {
      "id": "message-id-chunk-0",
      "similarity": 0.89,
      "payload": {
        "text": "The project deadline is next Friday...",
        "sourceType": "message",
        "sourceId": "message-id",
        "subject": "Project Timeline",
        "from": "boss@company.com"
      }
    }
  ]
}
```

## Usage Examples

### Using cURL

**Index a message:**
```bash
curl -X POST http://localhost:4000/api/rag/index-message/abc123def456
```

**Index a thread:**
```bash
curl -X POST http://localhost:4000/api/rag/index-thread/thread789xyz
```

**Search for content:**
```bash
curl "http://localhost:4000/api/rag/search?q=meeting%20notes&limit=5"
```

### Using JavaScript/Node.js

```javascript
import fetch from 'node-fetch'

const indexMessage = async (messageId) => {
  const response = await fetch(
    `http://localhost:4000/api/rag/index-message/${messageId}`,
    { method: 'POST' }
  )
  return response.json()
}

const searchEmails = async (query) => {
  const response = await fetch(
    `http://localhost:4000/api/rag/search?q=${encodeURIComponent(query)}`
  )
  return response.json()
}

// Index a message
const result = await indexMessage('abc123')
console.log(`Indexed ${result.result.chunksCreated} chunks`)

// Search for similar emails
const searchResults = await searchEmails('project deadline')
searchResults.results.forEach(result => {
  console.log(`Similarity: ${result.similarity.toFixed(2)}, Text: ${result.text.substring(0, 100)}...`)
})
```

## Customization

### Adjust Chunk Size

Edit [text-chunking.service.ts](./text-chunking.service.ts#L27):

```typescript
export class DefaultTextChunkingService implements TextChunkingService {
  constructor(chunkSize = 1000, overlapSize = 200) {
    // Increase chunkSize for larger chunks (e.g., 2000)
    // Increase overlapSize for more context between chunks (e.g., 400)
  }
}
```

### Switch Embeddings Provider at Runtime

Modify [routes/index.ts](./index.ts) to change the embeddings service initialization logic based on your needs.

### Add Custom Metadata

Modify [rag.service.ts](./rag.service.ts#L141) - `createQdrantPoints` method to add more metadata fields to your Qdrant payloads.

## Troubleshooting

### "Qdrant service is not configured"

Ensure all required environment variables are set:
```bash
echo $QDRANT_HOST
echo $QDRANT_PORT
echo $EMBEDDINGS_PROVIDER
```

### "Failed to generate embedding"

1. Check your API key is valid
2. Verify your API key has the right permissions
3. Check rate limits if using a cloud provider

### "OpenAI client not properly initialized"

```bash
npm install openai
npm list openai  # Verify it's installed
```

### Memory issues with local embeddings

The first run of local embeddings downloads a large model. If you run out of memory:
- Use a smaller model (modify the model name in [embeddings.service.ts](./embeddings.service.ts))
- Increase Node.js memory: `node --max-old-space-size=4096 app.js`
- Use an API-based provider instead

### Qdrant connection refused

```bash
# Check if Qdrant is running
docker ps | grep qdrant

# If not, start it
docker run -p 6333:6333 -e QDRANT_API_KEY=test-key qdrant/qdrant:latest

# Verify connection
curl http://localhost:6333/health
```

## Performance Optimization

### Batch Indexing

Index multiple messages/threads in parallel:

```javascript
const messageIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5']
const results = await Promise.all(
  messageIds.map(id => indexMessage(id))
)
```

### Embedding Batch Operations

The service automatically batches embedding generation for efficiency. Chunks from the same message/thread are embedded in a single API call.

### Qdrant Query Optimization

- Use reasonable `limit` values (10-50 for most use cases)
- Qdrant's cosine similarity is fast and cached efficiently
- For large collections, consider adding filters based on date or source

## Architecture Decisions

### Why Chunking?

Emails can be very long. Chunking allows:
- Better vector representation (each chunk covers a specific topic)
- Faster search and retrieval
- More granular metadata tracking

### Why Overlap?

The 200-character overlap between chunks ensures:
- Context preservation across chunk boundaries
- Better search results when queries span multiple chunks

### Why Store Metadata?

The Qdrant payload stores:
- Original email subject, from, to, date
- Source identification (which message/thread)
- Chunk position information
- This enables retrieval-augmented generation where you can fetch full context

## Security Considerations

1. **API Keys**: Never commit `.env` files with API keys
2. **Qdrant Access**: Use `QDRANT_API_KEY` in production
3. **Rate Limiting**: Implement rate limiting on `/rag` endpoints if public
4. **Data Privacy**: Be aware that third-party embedding services process your email content

## References

- [Phil Nash's Vector Embeddings Guide](https://philnash.com/blog/2024-09-25-how-to-create-vector-embeddings-in-nodejs/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Google Gemini API](https://ai.google.dev/docs/embeddings_guide)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Transformers.js](https://xenova.github.io/transformers.js/)
