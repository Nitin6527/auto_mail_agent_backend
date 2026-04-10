import { createHash } from 'node:crypto'
import { Document } from '@langchain/core/documents'
import { END, START, Annotation, StateGraph } from '@langchain/langgraph'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import type {
  GmailMessageDetail,
  GmailSearchService,
  GmailThreadDetail,
} from './gmail-search.service.js'
import type { EmbeddingVector, EmbeddingsService } from './embeddings.service.js'
import type { QdrantPayload, QdrantPoint, QdrantService } from './qdrant.service.js'
import type { RAGIndexingResult } from './rag.service.js'

type SourceType = 'message' | 'thread'

const EmailIngestionState = Annotation.Root({
  sourceId: Annotation<string>,
  sourceType: Annotation<SourceType>,
  messageId: Annotation<string | undefined>,
  threadId: Annotation<string | undefined>,
  message: Annotation<GmailMessageDetail | undefined>,
  thread: Annotation<GmailThreadDetail | undefined>,
  content: Annotation<string | undefined>,
  contentHash: Annotation<string | undefined>,
  existingContentHash: Annotation<string | undefined>,
  shouldSkip: Annotation<boolean | undefined>,
  skipReason: Annotation<string | undefined>,
  hadExistingPoints: Annotation<boolean | undefined>,
  documents: Annotation<Document[] | undefined>,
  chunks: Annotation<
    Array<{
      id: string
      text: string
      metadata: {
        sourceType: SourceType
        sourceId: string
        chunkIndex: number
        totalChunks: number
      }
    }> | undefined
  >,
  embeddings: Annotation<EmbeddingVector[] | undefined>,
  points: Annotation<QdrantPoint[] | undefined>,
})

type EmailIngestionStateType = typeof EmailIngestionState.State

type LangGraphEmailIngestionDependencies = {
  gmailSearchService: GmailSearchService
  embeddingsService: EmbeddingsService
  qdrantService: QdrantService
  chunkSize?: number
  chunkOverlap?: number
}

export class LangGraphEmailIngestionService {
  private readonly gmailSearchService: GmailSearchService
  private readonly embeddingsService: EmbeddingsService
  private readonly qdrantService: QdrantService
  private readonly splitter: RecursiveCharacterTextSplitter
  private readonly graph: any

  constructor({
    gmailSearchService,
    embeddingsService,
    qdrantService,
    chunkSize = 1000,
    chunkOverlap = 200,
  }: LangGraphEmailIngestionDependencies) {
    this.gmailSearchService = gmailSearchService
    this.embeddingsService = embeddingsService
    this.qdrantService = qdrantService
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    })

    this.graph = new StateGraph(EmailIngestionState)
      .addNode('loadSource', this.loadSource)
      .addNode('checkExistingIndex', this.checkExistingIndex)
      .addNode('deleteStalePoints', this.deleteStalePoints)
      .addNode('createDocuments', this.createDocuments)
      .addNode('splitDocuments', this.splitDocuments)
      .addNode('embedChunks', this.embedChunks)
      .addNode('createPoints', this.createPoints)
      .addNode('storePoints', this.storePoints)
      .addEdge(START, 'loadSource')
      .addEdge('loadSource', 'checkExistingIndex')
      .addConditionalEdges('checkExistingIndex', this.routeAfterIndexCheck, {
        skip: END,
        reindex: 'deleteStalePoints',
      })
      .addEdge('deleteStalePoints', 'createDocuments')
      .addEdge('createDocuments', 'splitDocuments')
      .addEdge('splitDocuments', 'embedChunks')
      .addEdge('embedChunks', 'createPoints')
      .addEdge('createPoints', 'storePoints')
      .addEdge('storePoints', END)
      .compile()
  }

  async indexMessage(messageId: string): Promise<RAGIndexingResult> {
    return this.run({
      sourceId: messageId,
      sourceType: 'message',
      messageId,
    })
  }

  async indexThreadById(threadId: string): Promise<RAGIndexingResult> {
    return this.run({
      sourceId: threadId,
      sourceType: 'thread',
      threadId,
    })
  }

  async indexThreadFromData(thread: GmailThreadDetail): Promise<RAGIndexingResult> {
    return this.run({
      sourceId: thread.id,
      sourceType: 'thread',
      threadId: thread.id,
      thread,
    })
  }

  private async run(input: Partial<EmailIngestionStateType>): Promise<RAGIndexingResult> {
    const sourceId = input.sourceId ?? ''
    const sourceType = input.sourceType ?? 'thread'

    try {
      const finalState = (await this.graph.invoke(input)) as EmailIngestionStateType
      const chunksCreated = finalState.chunks?.length ?? 0
      const vectorsUpserted = finalState.points?.length ?? 0

      return {
        success: true,
        sourceId,
        sourceType,
        chunksCreated,
        vectorsUpserted,
        skipped: finalState.shouldSkip ?? false,
        skipReason: finalState.skipReason,
        contentHash: finalState.contentHash,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`LangGraph ingestion failed for ${sourceType}:${sourceId}`, errorMessage)

      return {
        success: false,
        sourceId,
        sourceType,
        chunksCreated: 0,
        vectorsUpserted: 0,
        skipped: false,
        error: errorMessage,
      }
    }
  }

  private readonly loadSource = async (state: EmailIngestionStateType) => {
    if (state.sourceType === 'message') {
      const message = state.message ?? (await this.gmailSearchService.getMessageDetail(state.messageId ?? state.sourceId))
      const content = this.prepareMessageContent(message)

      return {
        message,
        content,
        contentHash: this.createContentHash(content),
      }
    }

    const thread = state.thread ?? (await this.gmailSearchService.getThreadDetail(state.threadId ?? state.sourceId))
    const content = this.prepareThreadContent(thread)

    return {
      thread,
      content,
      contentHash: this.createContentHash(content),
    }
  }

  private readonly checkExistingIndex = async (state: EmailIngestionStateType) => {
    const existingPoints = await this.qdrantService.getPointsBySourceId(state.sourceId, 1)
    const existingContentHash = existingPoints[0]?.payload?.contentHash
    const hadExistingPoints = existingPoints.length > 0

    if (hadExistingPoints && existingContentHash === state.contentHash) {
      return {
        existingContentHash,
        hadExistingPoints,
        shouldSkip: true,
        skipReason: 'content_hash_unchanged',
        chunks: [],
        embeddings: [],
        points: [],
      }
    }

    return {
      existingContentHash,
      hadExistingPoints,
      shouldSkip: false,
    }
  }

  private readonly routeAfterIndexCheck = (state: EmailIngestionStateType) => {
    return state.shouldSkip ? 'skip' : 'reindex'
  }

  private readonly deleteStalePoints = async (state: EmailIngestionStateType) => {
    if (state.hadExistingPoints) {
      await this.qdrantService.deletePointsBySourceId(state.sourceId)
    }

    return {}
  }

  private readonly createDocuments = async (state: EmailIngestionStateType) => {
    const content = state.content?.trim()

    if (!content) {
      return { documents: [] }
    }

    return {
      documents: [
        new Document({
          pageContent: content,
          metadata: {
            sourceId: state.sourceId,
            sourceType: state.sourceType,
            contentHash: state.contentHash,
          },
        }),
      ],
    }
  }

  private readonly splitDocuments = async (state: EmailIngestionStateType) => {
    if (!state.documents || state.documents.length === 0) {
      return { chunks: [] }
    }

    const splitDocs = await this.splitter.splitDocuments(state.documents)
    const totalChunks = splitDocs.length

    return {
      chunks: splitDocs.map((document: Document, index: number) => ({
        id: `${state.sourceId}-chunk-${index}`,
        text: document.pageContent.trim(),
        metadata: {
          sourceType: state.sourceType,
          sourceId: state.sourceId,
          chunkIndex: index,
          totalChunks,
        },
      })),
    }
  }

  private readonly embedChunks = async (state: EmailIngestionStateType) => {
    if (!state.chunks || state.chunks.length === 0) {
      return { embeddings: [] }
    }

    return {
      embeddings: await this.embeddingsService.embedBatch(
        state.chunks.map((chunk: NonNullable<EmailIngestionStateType['chunks']>[number]) => chunk.text),
      ),
    }
  }

  private readonly createPoints = async (state: EmailIngestionStateType) => {
    if (!state.chunks || !state.embeddings || state.chunks.length === 0) {
      return { points: [] }
    }

    if (state.sourceType === 'message' && state.message) {
      return {
        points: this.createQdrantPointsForMessage(
          state.chunks,
          state.embeddings,
          state.message,
          state.contentHash,
        ),
      }
    }

    if (state.thread) {
      return {
        points: this.createQdrantPointsForThread(
          state.chunks,
          state.embeddings,
          state.thread,
          state.contentHash,
        ),
      }
    }

    return { points: [] }
  }

  private readonly storePoints = async (state: EmailIngestionStateType) => {
    if (!state.points || state.points.length === 0) {
      return {}
    }

    await this.qdrantService.upsertPoints(state.points)
    return {}
  }

  private prepareMessageContent(message: GmailMessageDetail): string {
    const parts: string[] = []

    if (message.subject) parts.push(`Subject: ${message.subject}`)
    if (message.from) parts.push(`From: ${message.from}`)
    if (message.to) parts.push(`To: ${message.to}`)
    if (message.date) parts.push(`Date: ${message.date}`)

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
        parts.push('---')
      }

      if (message.subject) parts.push(`Subject: ${message.subject}`)
      if (message.from) parts.push(`From: ${message.from}`)
      if (message.to) parts.push(`To: ${message.to}`)
      if (message.date) parts.push(`Date: ${message.date}`)

      if (message.body?.text) {
        parts.push(`Body:\n${message.body.text}`)
      } else if (message.body?.html) {
        parts.push(`Body:\n${this.stripHtml(message.body.html)}`)
      }
    })

    return parts.join('\n\n')
  }

  private createQdrantPointsForMessage(
    chunks: NonNullable<EmailIngestionStateType['chunks']>,
    embeddings: EmbeddingVector[],
    message: GmailMessageDetail,
    contentHash?: string,
  ): QdrantPoint[] {
    return chunks.map((chunk: NonNullable<EmailIngestionStateType['chunks']>[number], index: number) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        text: chunk.text,
        sourceType: chunk.metadata.sourceType,
        sourceId: chunk.metadata.sourceId,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        contentHash,
        messageId: message.id,
        messageIdList: [message.id],
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        threadId: message.threadId,
        participantEmails: this.extractEmailAddresses([message.from, message.to].filter(Boolean).join(' ')),
      } as QdrantPayload,
    }))
  }

  private createQdrantPointsForThread(
    chunks: NonNullable<EmailIngestionStateType['chunks']>,
    embeddings: EmbeddingVector[],
    thread: GmailThreadDetail,
    contentHash?: string,
  ): QdrantPoint[] {
    return chunks.map((chunk: NonNullable<EmailIngestionStateType['chunks']>[number], index: number) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        text: chunk.text,
        sourceType: chunk.metadata.sourceType,
        sourceId: chunk.metadata.sourceId,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        contentHash,
        threadId: thread.id,
        messageCount: thread.messageCount,
        messageIds: thread.messages.map((message) => message.id).join(','),
        messageIdList: thread.messages.map((message) => message.id),
        participants: thread.messages.map((message) => message.from).filter(Boolean).join('; '),
        participantEmails: this.extractEmailAddresses(
          thread.messages.map((message) => [message.from, message.to].filter(Boolean).join(' ')).join(' '),
        ),
      } as QdrantPayload,
    }))
  }

  private createContentHash(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex')
  }

  private extractEmailAddresses(text: string): string[] {
    const matches = text.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? []
    return [...new Set(matches)]
  }

  private stripHtml(html: string): string {
    return html.replaceAll(/<[^>]*>/g, '').replaceAll(/&nbsp;/g, ' ').trim()
  }
}
