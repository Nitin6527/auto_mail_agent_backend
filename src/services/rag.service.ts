import { AppError } from '../errors/AppError.js'
import {
  GmailSearchService,
  GmailSearchInput,
  GmailSearchResult,
} from './gmail-search.service.js'
import { EmbeddingsService, EmbeddingVector } from './embeddings.service.js'
import { QdrantPayloadFilter, QdrantService } from './qdrant.service.js'
import { LangGraphEmailIngestionService } from './langgraph-email-ingestion.service.js'

export type RAGIndexingResult = {
  success: boolean
  sourceId: string
  sourceType: 'message' | 'thread'
  chunksCreated: number
  vectorsUpserted: number
  skipped?: boolean
  skipReason?: string
  contentHash?: string
  error?: string
}

export interface RAGService {
  indexEmailMessage(messageId: string): Promise<RAGIndexingResult>;
  indexEmailThread(threadId: string): Promise<RAGIndexingResult>;
  indexThreadFromData(thread: any): Promise<any>;
  searchAndIndexMailbox(input?: GmailSearchInput): Promise<RAGSearchSyncResult>;
  searchSimilar(query: string, limit?: number, filters?: RAGSearchFilters): Promise<any[]>;
}

export type RAGSearchFilters = {
  threadId?: string
  messageId?: string
  participantEmail?: string
}

export type RAGSearchSyncResult = {
  search: GmailSearchResult
  indexedThreads: number
  skipped: number
  succeeded: number
  failed: number
  indexingResults: RAGIndexingResult[]
}

type DefaultRAGServiceDependencies = {
  gmailSearchService: GmailSearchService
  embeddingsService: EmbeddingsService
  qdrantService: QdrantService
}

export class DefaultRAGService implements RAGService {
  private readonly gmailSearchService: GmailSearchService
  private readonly embeddingsService: EmbeddingsService
  private readonly qdrantService: QdrantService
  private readonly ingestionWorkflow: LangGraphEmailIngestionService

  constructor({
    gmailSearchService,
    embeddingsService,
    qdrantService,
  }: DefaultRAGServiceDependencies) {
    this.gmailSearchService = gmailSearchService
    this.embeddingsService = embeddingsService
    this.qdrantService = qdrantService
    this.ingestionWorkflow = new LangGraphEmailIngestionService({
      gmailSearchService,
      embeddingsService,
      qdrantService,
    })
  }

  async indexEmailMessage(messageId: string): Promise<RAGIndexingResult> {
    return this.ingestionWorkflow.indexMessage(messageId)
  }

  async indexEmailThread(threadId: string): Promise<RAGIndexingResult> {
    return this.ingestionWorkflow.indexThreadById(threadId)
  }

  async indexThreadFromData(thread: any): Promise<any> {
    return this.ingestionWorkflow.indexThreadFromData(thread)
  }

  async searchAndIndexMailbox(input: GmailSearchInput = {}): Promise<RAGSearchSyncResult> {
    const search = await this.gmailSearchService.search(input)
    const threadIds = [...new Set(search.messages.map((message) => message.threadId).filter(Boolean))]
    const indexingResults = await Promise.all(
      threadIds.map((threadId) => this.ingestionWorkflow.indexThreadById(threadId)),
    )

    return {
      search,
      indexedThreads: threadIds.length,
      skipped: indexingResults.filter((result) => result.skipped).length,
      succeeded: indexingResults.filter((result) => result.success).length,
      failed: indexingResults.filter((result) => !result.success).length,
      indexingResults,
    }
  }

  async searchSimilar(
    query: string,
    limit: number = 10,
    filters: RAGSearchFilters = {},
  ): Promise<any[]> {
    try {
      console.log(`Searching for similar content: "${query}"`)

      // Generate embedding for query
      const queryEmbedding = await this.embeddingsService.embed(query)

      // Search in Qdrant
      const results = await this.qdrantService.search(
        queryEmbedding,
        limit,
        this.createSearchFilter(filters),
      )
      console.log(`Found ${results.length} similar results`)

      return results.map((result) => ({
        id: result.id,
        similarity: this.calculateCosineSimilarity(queryEmbedding, result.vector),
        payload: result.payload,
        text: result.payload.text,
      }))
    } catch (error) {
      throw new AppError(
        'Failed to search similar content',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }
  private calculateCosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }

  private createSearchFilter(filters: RAGSearchFilters): QdrantPayloadFilter | undefined {
    const must: NonNullable<QdrantPayloadFilter['must']> = []

    if (filters.threadId) {
      must.push({
        key: 'threadId',
        match: { value: filters.threadId },
      })
    }

    if (filters.messageId) {
      must.push({
        key: 'messageIdList',
        match: { value: filters.messageId },
      })
    }

    if (filters.participantEmail) {
      must.push({
        key: 'participantEmails',
        match: { value: filters.participantEmail.toLowerCase() },
      })
    }

    return must.length > 0 ? { must } : undefined
  }
}

/**
 * Unconfigured RAG Service
 */
export class UnconfiguredRAGService implements RAGService {
  async indexEmailMessage(): Promise<RAGIndexingResult> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }

  async indexEmailThread(): Promise<RAGIndexingResult> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }

  async indexThreadFromData(): Promise<RAGIndexingResult> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }

  async searchAndIndexMailbox(): Promise<RAGSearchSyncResult> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }

  async searchSimilar(): Promise<any[]> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }
}
