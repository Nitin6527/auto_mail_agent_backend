import { Router } from 'express'
import { env, hasGoogleMailConfig, hasRAGConfig } from '../config/env.js'
import { createGmailClient } from '../lib/google/createGmailClient.js'
import {
  DefaultGmailSearchService,
  UnconfiguredGmailSearchService,
} from '../services/gmail-search.service.js'
import { DefaultHealthService } from '../services/health.service.js'
import { DefaultTextChunkingService } from '../services/text-chunking.service.js'
import {
  OpenAIEmbeddingsService,
  GoogleEmbeddingsService,
  LocalEmbeddingsService,
  UnconfiguredEmbeddingsService,
} from '../services/embeddings.service.js'
import {
  DefaultQdrantService,
  UnconfiguredQdrantService,
} from '../services/qdrant.service.js'
import { DefaultRAGService, UnconfiguredRAGService } from '../services/rag.service.js'
import { RAGController } from '../controllers/rag.controller.js'
import { buildGmailRouter } from './gmail.route.js'
import { buildHealthRouter } from './health.route.js'
import { createRAGRouter } from './rag.route.js'

export const buildApiRouter = () => {
  const apiRouter = Router()
  const healthService = new DefaultHealthService({
    serviceName: 'auto-email-handler-backend',
  })

  apiRouter.use('/health', buildHealthRouter({ healthService }))

  const gmailSearchService = hasGoogleMailConfig
    ? new DefaultGmailSearchService({
        gmailClient: createGmailClient(env),
      })
    : new UnconfiguredGmailSearchService()

  apiRouter.use(
    '/gmail',
    buildGmailRouter({
      gmailSearchService,
    }),
  )

  // RAG Router
  if (hasRAGConfig) {
    // Create embeddings service based on configuration
    let embeddingsService
    switch (env.EMBEDDINGS_PROVIDER) {
      case 'openai':
        embeddingsService = new OpenAIEmbeddingsService(env.OPENAI_API_KEY!)
        break
      case 'google':
        embeddingsService = new GoogleEmbeddingsService(env.GOOGLE_API_KEY!)
        break
      case 'local':
        embeddingsService = new LocalEmbeddingsService()
        break
      default:
        embeddingsService = new UnconfiguredEmbeddingsService()
    }

    const qdrantService = new DefaultQdrantService(
      env.QDRANT_HOST,
      env.QDRANT_PORT,
      env.QDRANT_COLLECTION_NAME,
      env.QDRANT_VECTOR_SIZE,
      env.QDRANT_API_KEY,
    )

    const ragService = new DefaultRAGService({
      gmailSearchService,
      textChunkingService: new DefaultTextChunkingService(),
      embeddingsService,
      qdrantService,
    })

    const ragController = new RAGController({ ragService })

    apiRouter.use('/rag', createRAGRouter(ragController))
  } else {
    // Create unconfigured RAG service
    const ragService = new UnconfiguredRAGService()
    const ragController = new RAGController({ ragService })
    apiRouter.use('/rag', createRAGRouter(ragController))
  }

  return apiRouter
}
