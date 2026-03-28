import { AppError } from '../errors/AppError.js'

export type EmbeddingVector = number[]

export type EmbeddingResult = {
  text: string
  embedding: EmbeddingVector
  model: string
}

export interface EmbeddingsService {
  embed(text: string): Promise<EmbeddingVector>
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>
}

/**
 * OpenAI Embeddings Service
 * Uses OpenAI's text-embedding-3-small or text-embedding-3-large model
 * 
 * Install: npm install openai
 * 
 * Environment variables:
 * - OPENAI_API_KEY: Your OpenAI API key
 */
export class OpenAIEmbeddingsService implements EmbeddingsService {
  private readonly client!: any
  private readonly model!: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    try {
      const { OpenAI } = require('openai')
      ;(this as any).client = new OpenAI({ apiKey })
      ;(this as any).model = model
    } catch (error) {
      throw new AppError(
        'OpenAI client not properly initialized. Ensure openai package is installed.',
        500,
        error,
      )
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const embedding = await this.client.embeddings.create({
        model: this.model,
        input: text,
      })

      return embedding.data[0].embedding as EmbeddingVector
    } catch (error) {
      throw new AppError(
        'Failed to generate embedding via OpenAI',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    try {
      const embedding = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      })

      // Sort by index to maintain order
      const sortedEmbeddings = embedding.data.sort((a: any, b: any) => a.index - b.index)
      return sortedEmbeddings.map((item: any) => item.embedding as EmbeddingVector)
    } catch (error) {
      throw new AppError(
        'Failed to generate batch embeddings via OpenAI',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

/**
 * Google Gemini Embeddings Service
 * Uses Google's embedding-001 or other available models
 * 
 * Install: npm install @google/generative-ai
 * 
 * Environment variables:
 * - GOOGLE_API_KEY: Your Google API key
 */
export class GoogleEmbeddingsService implements EmbeddingsService {
  private readonly client!: any
  private readonly model!: string

  constructor(apiKey: string, model = 'embedding-001') {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      ;(this as any).client = new GoogleGenerativeAI(apiKey)
      ;(this as any).model = model
    } catch (error) {
      throw new AppError(
        'Google GenerativeAI client not properly initialized. Ensure @google/generative-ai package is installed.',
        500,
        error,
      )
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const result = await this.client.embedContent({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      })

      return result.embedding.values as EmbeddingVector
    } catch (error) {
      throw new AppError(
        'Failed to generate embedding via Google',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    try {
      const embeddings = await Promise.all(
        texts.map((text) =>
          this.client.embedContent({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          }),
        ),
      )

      return embeddings.map((result: any) => result.embedding.values as EmbeddingVector)
    } catch (error) {
      throw new AppError(
        'Failed to generate batch embeddings via Google',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

/**
 * Local Embeddings Service
 * Uses Hugging Face Transformers.js for local embedding generation
 * Good for privacy, but requires more compute
 * 
 * Install: npm install @huggingface/transformers
 * 
 * First run will download the model (can be large)
 */
export class LocalEmbeddingsService implements EmbeddingsService {
  private extractor: any | null = null

  private async initializeExtractor(): Promise<void> {
    if (this.extractor) return

    try {
      const { pipeline } = require('@huggingface/transformers')
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    } catch (error) {
      throw new AppError(
        'Failed to initialize local embeddings model. Ensure @huggingface/transformers is installed.',
        500,
        error,
      )
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    await this.initializeExtractor()

    try {
      const response = await this.extractor([text], {
        pooling: 'mean',
        normalize: true,
      })

      return Array.from(response.data) as EmbeddingVector
    } catch (error) {
      throw new AppError(
        'Failed to generate local embedding',
        500,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    await this.initializeExtractor()

    try {
      const response = await this.extractor(texts, {
        pooling: 'mean',
        normalize: true,
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return response.tolist() as EmbeddingVector[]
    } catch (error) {
      throw new AppError(
        'Failed to generate local embeddings batch',
        500,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

/**
 * Unconfigured Embeddings Service (for when no embeddings provider is set up)
 */
export class UnconfiguredEmbeddingsService implements EmbeddingsService {
  async embed(): Promise<EmbeddingVector> {
    throw new AppError(
      'Embeddings service is not configured. Set up an embeddings provider (OpenAI, Google, or Local).',
      503,
    )
  }

  async embedBatch(): Promise<EmbeddingVector[]> {
    throw new AppError(
      'Embeddings service is not configured. Set up an embeddings provider (OpenAI, Google, or Local).',
      503,
    )
  }
}
