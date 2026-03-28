import { AppError } from '../errors/AppError.js'

export type QdrantPayload = {
  text: string
  sourceType: string
  sourceId: string
  chunkIndex: number
  totalChunks: number
  [key: string]: any // Allow additional metadata
}

export type QdrantPoint = {
  id: string | number
  vector: number[]
  payload: QdrantPayload
}

export interface QdrantService {
  upsertPoint(point: QdrantPoint): Promise<void>
  upsertPoints(points: QdrantPoint[]): Promise<void>
  search(vector: number[], limit: number): Promise<QdrantPoint[]>
  deletePoints(pointIds: (string | number)[]): Promise<void>
}

/**
 * Qdrant Vector Database Service
 * 
 * Install: npm install @qdrant/js-client
 * 
 * Environment variables:
 * - QDRANT_HOST: Qdrant server host (default: localhost)
 * - QDRANT_PORT: Qdrant server port (default: 6333)
 * - QDRANT_API_KEY: Optional API key if using Qdrant Cloud
 * - QDRANT_COLLECTION_NAME: Collection name for storing vectors
 * - QDRANT_VECTOR_SIZE: Vector size (e.g., 1536 for OpenAI, 768 for some others)
 */
export class DefaultQdrantService implements QdrantService {
  private readonly client!: any
  private readonly collectionName!: string
  private readonly vectorSize!: number

  constructor(
    host: string = 'localhost',
    port: number = 6333,
    collectionName: string = 'emails',
    vectorSize: number = 1536,
    apiKey?: string,
  ) {
    try {
      const { QdrantClient } = require('@qdrant/js-client')

      ;(this as any).client = new QdrantClient({
        host,
        port,
        ...(apiKey && { api_key: apiKey }),
      })

      ;(this as any).collectionName = collectionName
      ;(this as any).vectorSize = vectorSize
    } catch (error) {
      throw new AppError(
        'Qdrant client not properly initialized. Ensure @qdrant/js-client package is installed.',
        500,
        error,
      )
    }
  }

  async ensureCollectionExists(): Promise<void> {
    try {
      const collections = await this.client.getCollections()
      const collectionExists = collections.collections.some(
        (c: any) => c.name === this.collectionName,
      )

      if (!collectionExists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        })
        console.log(`Created Qdrant collection: ${this.collectionName}`)
      }
    } catch (error) {
      throw new AppError(
        'Failed to ensure Qdrant collection exists',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async upsertPoint(point: QdrantPoint): Promise<void> {
    await this.upsertPoints([point])
  }

  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    try {
      await this.ensureCollectionExists()

      // Convert point IDs to strings if they're not already
      const qdrantPoints = points.map((point) => ({
        id: typeof point.id === 'string' ? this.hashStringToNumber(point.id) : point.id,
        vector: point.vector,
        payload: point.payload,
      }))

      await this.client.upsert(this.collectionName, {
        points: qdrantPoints,
      })

      console.log(`Upserted ${points.length} points to Qdrant`)
    } catch (error) {
      throw new AppError(
        'Failed to upsert points to Qdrant',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async search(vector: number[], limit: number = 10): Promise<QdrantPoint[]> {
    try {
      await this.ensureCollectionExists()

      const results = await this.client.search(this.collectionName, {
        vector,
        limit,
        with_payload: true,
        with_vectors: true,
      })

      return results.map((result: any) => ({
        id: result.id,
        vector: result.vector || [],
        payload: result.payload,
      }))
    } catch (error) {
      throw new AppError(
        'Failed to search in Qdrant',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async deletePoints(pointIds: (string | number)[]): Promise<void> {
    try {
      const numericIds = pointIds.map((id) =>
        typeof id === 'string' ? this.hashStringToNumber(id) : id,
      )

      await this.client.delete(this.collectionName, {
        points_selector: {
          points: numericIds,
        },
      })

      console.log(`Deleted ${pointIds.length} points from Qdrant`)
    } catch (error) {
      throw new AppError(
        'Failed to delete points from Qdrant',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * Simple hash function to convert string IDs to numbers for Qdrant
   * In production, consider using a proper ID mapping system
   */
  private hashStringToNumber(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      // Use codePointAt for better Unicode support
      const codePoint = str.codePointAt(i) || 0
      hash = (hash << 5) - hash + codePoint
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }
}

/**
 * Unconfigured Qdrant Service (for when Qdrant is not set up)
 */
export class UnconfiguredQdrantService implements QdrantService {
  private throwConfigError(): never {
    throw new AppError(
      'Qdrant service is not configured. Set QDRANT_HOST and related environment variables.',
      503,
    )
  }

  async upsertPoint(): Promise<void> {
    this.throwConfigError()
  }

  async upsertPoints(): Promise<void> {
    this.throwConfigError()
  }

  async search(): Promise<QdrantPoint[]> {
    this.throwConfigError()
  }

  async deletePoints(): Promise<void> {
    this.throwConfigError()
  }
}
