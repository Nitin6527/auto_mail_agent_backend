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
  createEmbeddingsService,
} from '../services/embeddings.service.js'
import {
  DefaultQdrantService,
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

  // Create RAG service early so we can pass it to gmail router
  let ragService
  if (hasRAGConfig) {
    const embeddingsService = createEmbeddingsService()

    const qdrantService = new DefaultQdrantService(
      env.QDRANT_HOST,
      env.QDRANT_PORT,
      env.QDRANT_COLLECTION_NAME,
      env.QDRANT_VECTOR_SIZE,
      env.QDRANT_API_KEY,
    )

    ragService = new DefaultRAGService({
      gmailSearchService,
      textChunkingService: new DefaultTextChunkingService(),
      embeddingsService,
      qdrantService,
    })
  } else {
    ragService = new UnconfiguredRAGService()
  }

  apiRouter.use(
    '/gmail',
    buildGmailRouter({
      gmailSearchService,
      ragService,
    }),
  )

  // RAG Router
  const ragController = new RAGController({ ragService })
  apiRouter.use('/rag', createRAGRouter(ragController))

  return apiRouter
}
