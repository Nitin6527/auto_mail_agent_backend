import { AppError } from '../errors/AppError.js'
import { GmailSearchService, GmailMessageDetail, GmailThreadDetail } from './gmail-search.service.js'
import { TextChunkingService, TextChunk } from './text-chunking.service.js'
import { EmbeddingsService, EmbeddingVector } from './embeddings.service.js'
import { QdrantService, QdrantPoint, QdrantPayload } from './qdrant.service.js'

export type RAGIndexingResult = {
  success: boolean
  sourceId: string
  sourceType: 'message' | 'thread'
  chunksCreated: number
  vectorsUpserted: number
  error?: string
}

export interface RAGService {
  indexEmailMessage(messageId: string): Promise<RAGIndexingResult>
  indexEmailThread(threadId: string): Promise<RAGIndexingResult>
  searchSimilar(query: string, limit?: number): Promise<any[]>
}

type DefaultRAGServiceDependencies = {
  gmailSearchService: GmailSearchService
  textChunkingService: TextChunkingService
  embeddingsService: EmbeddingsService
  qdrantService: QdrantService
}

export class DefaultRAGService implements RAGService {
  private readonly gmailSearchService: GmailSearchService
  private readonly textChunkingService: TextChunkingService
  private readonly embeddingsService: EmbeddingsService
  private readonly qdrantService: QdrantService

  constructor({
    gmailSearchService,
    textChunkingService,
    embeddingsService,
    qdrantService,
  }: DefaultRAGServiceDependencies) {
    this.gmailSearchService = gmailSearchService
    this.textChunkingService = textChunkingService
    this.embeddingsService = embeddingsService
    this.qdrantService = qdrantService
  }

  async indexEmailMessage(messageId: string): Promise<RAGIndexingResult> {
    try {
      console.log(`Starting RAG indexing for message: ${messageId}`)

      // Step 1: Fetch email message from Gmail API
      const message = await this.gmailSearchService.getMessageDetail(messageId)
      console.log(`Fetched message: ${message.subject}`)

      // Step 2: Prepare content for chunking
      const content = this.prepareMessageContent(message)
      console.log(`Message content length: ${content.length} characters`)

      // Step 3: Create chunks manually
      const chunks = this.textChunkingService.chunkText(content, messageId, 'message')
      console.log(`Created ${chunks.length} chunks from message`)

      if (chunks.length === 0) {
        return {
          success: true,
          sourceId: messageId,
          sourceType: 'message',
          chunksCreated: 0,
          vectorsUpserted: 0,
        }
      }

      // Step 4: Generate embeddings for all chunks
      const embeddings = await this.embeddingsService.embedBatch(
        chunks.map((chunk) => chunk.text),
      )
      console.log(`Generated ${embeddings.length} embeddings`)

      // Step 5: Prepare and upsert to Qdrant with payload
      const points = this.createQdrantPoints(chunks, embeddings, message)
      await this.qdrantService.upsertPoints(points)
      console.log(`Upserted ${points.length} vectors to Qdrant`)

      return {
        success: true,
        sourceId: messageId,
        sourceType: 'message',
        chunksCreated: chunks.length,
        vectorsUpserted: points.length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Error indexing message ${messageId}:`, errorMessage)

      return {
        success: false,
        sourceId: messageId,
        sourceType: 'message',
        chunksCreated: 0,
        vectorsUpserted: 0,
        error: errorMessage,
      }
    }
  }

  async indexEmailThread(threadId: string): Promise<RAGIndexingResult> {
    try {
      console.log(`Starting RAG indexing for thread: ${threadId}`)

      // Step 1: Fetch thread from Gmail API
      const thread = await this.gmailSearchService.getThreadDetail(threadId)
      console.log(`Fetched thread with ${thread.messages.length} messages`)

      // Step 2: Prepare content from all messages in thread
      const content = this.prepareThreadContent(thread)
      console.log(`Thread content length: ${content.length} characters`)

      // Step 3: Create chunks manually
      const chunks = this.textChunkingService.chunkText(content, threadId, 'thread')
      console.log(`Created ${chunks.length} chunks from thread`)

      if (chunks.length === 0) {
        return {
          success: true,
          sourceId: threadId,
          sourceType: 'thread',
          chunksCreated: 0,
          vectorsUpserted: 0,
        }
      }

      // Step 4: Generate embeddings for all chunks
      const embeddings = await this.embeddingsService.embedBatch(
        chunks.map((chunk) => chunk.text),
      )
      console.log(`Generated ${embeddings.length} embeddings`)

      // Step 5: Prepare and upsert to Qdrant with payload
      const points = this.createQdrantPointsForThread(chunks, embeddings, thread)
      await this.qdrantService.upsertPoints(points)
      console.log(`Upserted ${points.length} vectors to Qdrant`)

      return {
        success: true,
        sourceId: threadId,
        sourceType: 'thread',
        chunksCreated: chunks.length,
        vectorsUpserted: points.length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Error indexing thread ${threadId}:`, errorMessage)

      return {
        success: false,
        sourceId: threadId,
        sourceType: 'thread',
        chunksCreated: 0,
        vectorsUpserted: 0,
        error: errorMessage,
      }
    }
  }

  async searchSimilar(query: string, limit: number = 10): Promise<any[]> {
    try {
      console.log(`Searching for similar content: "${query}"`)

      // Generate embedding for query
      const queryEmbedding = await this.embeddingsService.embed(query)

      // Search in Qdrant
      const results = await this.qdrantService.search(queryEmbedding, limit)
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

  private prepareMessageContent(message: GmailMessageDetail): string {
    const parts: string[] = []

    if (message.subject) {
      parts.push(`Subject: ${message.subject}`)
    }

    if (message.from) {
      parts.push(`From: ${message.from}`)
    }

    if (message.to) {
      parts.push(`To: ${message.to}`)
    }

    if (message.date) {
      parts.push(`Date: ${message.date}`)
    }

    if (message.body?.text) {
      parts.push(`Body:\n${message.body.text}`)
    } else if (message.body?.html) {
      parts.push(`Body:\n${this.stripHtml(message.body.html)}`)
    }

    return parts.join('\n\n')
  }

  private prepareThreadContent(thread: GmailThreadDetail): string {
    const parts: string[] = []

    thread.messages.forEach((message, index) => {
      if (index > 0) {
        parts.push('---')  // Separator between messages
      }

      if (message.subject) {
        parts.push(`Subject: ${message.subject}`)
      }

      if (message.from) {
        parts.push(`From: ${message.from}`)
      }

      if (message.date) {
        parts.push(`Date: ${message.date}`)
      }

      if (message.body?.text) {
        parts.push(`Body:\n${message.body.text}`)
      } else if (message.body?.html) {
        parts.push(`Body:\n${this.stripHtml(message.body.html)}`)
      }
    })

    return parts.join('\n\n')
  }

  private createQdrantPoints(
    chunks: TextChunk[],
    embeddings: EmbeddingVector[],
    message: GmailMessageDetail,
  ): QdrantPoint[] {
    return chunks.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        text: chunk.text,
        sourceType: chunk.metadata.sourceType,
        sourceId: chunk.metadata.sourceId,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        messageId: message.id,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        threadId: message.threadId,
      } as QdrantPayload,
    }))
  }

  private createQdrantPointsForThread(
    chunks: TextChunk[],
    embeddings: EmbeddingVector[],
    thread: GmailThreadDetail,
  ): QdrantPoint[] {
    return chunks.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        text: chunk.text,
        sourceType: chunk.metadata.sourceType,
        sourceId: chunk.metadata.sourceId,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        threadId: thread.id,
        messageCount: thread.messageCount,
        messageIds: thread.messages.map((m) => m.id).join(','),
        participants: thread.messages.map((m) => m.from).filter(Boolean).join('; '),
      } as QdrantPayload,
    }))
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
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

  async searchSimilar(): Promise<any[]> {
    throw new AppError(
      'RAG service is not configured. Ensure all dependencies (Gmail, embeddings, Qdrant) are properly set up.',
      503,
    )
  }
}
