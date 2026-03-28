# RAG Pipeline Quick Reference

## Quick Start Checklist

### 1. Install Dependencies
```bash
npm install openai @qdrant/js-client
```

### 2. Start Qdrant
```bash
docker run -p 6333:6333 \
  -e QDRANT_API_KEY=test-key \
  qdrant/qdrant:latest
```

### 3. Configure Environment
Set these in your `.env`:
```env
EMBEDDINGS_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=test-key
QDRANT_VECTOR_SIZE=1536
```

### 4. Test Endpoints

**Index a message:**
```bash
curl -X POST http://localhost:4000/api/rag/index-message/{messageId}
```

**Search:**
```bash
curl "http://localhost:4000/api/rag/search?q=your+query&limit=5"
```

## Available Embeddings Providers

| Provider | Install Command | API Key Env Var | Vector Size | Cost | Speed |
|----------|---------------|-|---|---|---|
| **OpenAI** | `npm install openai` | `OPENAI_API_KEY` | 1536 | $0.02/M tokens | Fast |
| **Google** | `npm install @google/generative-ai` | `GOOGLE_API_KEY` | 768 | Free tier available | Fast |
| **Local** | `npm install @huggingface/transformers` | None | 384 | Free | Variable |

## File Structure

```
src/
├── services/
│   ├── text-chunking.service.ts      # Splits text into chunks
│   ├── embeddings.service.ts          # Generates embeddings
│   ├── qdrant.service.ts              # Vector database
│   └── rag.service.ts                 # Orchestrates RAG pipeline
├── controllers/
│   └── rag.controller.ts              # API handlers
└── routes/
    └── rag.route.ts                   # API routes
```

## RAG Service Flow

```
Email/Thread (Gmail API)
         ↓
    Chunk Content (TextChunkingService)
         ↓
  Generate Embeddings (EmbeddingsService)
         ↓
  Upsert to Qdrant (QdrantService)
         ↓
  Vector Database (Qdrant)
```

## Payload Structure in Qdrant

Each vector in Qdrant is stored with this metadata:

```json
{
  "id": "message-id-chunk-0",
  "vector": [0.123, 0.456, ...],
  "payload": {
    "text": "chunk content",
    "sourceType": "message|thread",
    "sourceId": "email-id",
    "chunkIndex": 0,
    "totalChunks": 5,
    "subject": "Email subject",
    "from": "sender@example.com",
    "to": "recipient@example.com",
    "date": "2024-01-01T00:00:00Z"
  }
}
```

## Chunk Size Tuning

| Setting | Value | Effect |
|---------|-------|--------|
| chunkSize | 1000 | Default - good balance |
| chunkSize | 500 | Smaller chunks, slower search |
| chunkSize | 2000 | Larger chunks, less granular |
| overlapSize | 200 | Default - maintains context |
| overlapSize | 100 | Less overlap, less latency |

## Common Issues & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Qdrant service not configured" | ENV vars missing | Set QDRANT_HOST, QDRANT_PORT |
| "OpenAI client not initialized" | Package not installed | `npm install openai` |
| "Connection refused" | Qdrant not running | `docker run qdrant/qdrant` |
| "Memory exceeded" | Local embeddings model too large | Use API provider instead |
| "Rate limited" | Too many API calls | Batch requests, add delay |

## Performance Benchmarks

- **Chunking**: ~100ms for typical email
- **OpenAI Embedding**: ~200ms per 8191 tokens (batched)
- **Qdrant Upsert**: ~50ms per vector
- **Qdrant Search**: ~10-50ms depending on collection size

## Pro Tips

1. **Batch Index**: Index multiple messages in parallel with `Promise.all()`
2. **Reindex**: Delete old vectors before upserting updated content
3. **Monitor**: Track indexing results, check for errors
4. **Cache**: Consider caching search results for common queries
5. **Scale**: For production, use Qdrant Cloud instead of Docker

## Next Steps

1. Read [RAG_SETUP_GUIDE.md](./RAG_SETUP_GUIDE.md) for detailed setup
2. Configure your preferred embeddings provider
3. Set up Qdrant (local or cloud)
4. Test with sample emails
5. Integrate into your application workflow

## Support Resources

- [Qdrant Docs](https://qdrant.tech/documentation/)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference/embeddings)
- [Google Gemini Docs](https://ai.google.dev/)
- [Transformers.js Docs](https://xenova.github.io/transformers.js/)
