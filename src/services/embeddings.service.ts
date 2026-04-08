import { createRequire } from 'node:module'
import { AppError } from "../errors/AppError.js";

const require = createRequire(import.meta.url)

export type EmbeddingVector = number[];

export type EmbeddingResult = {
  text: string;
  embedding: EmbeddingVector;
  model: string;
};

export interface EmbeddingsService {
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
}

/**
 * OpenAI Embeddings Service
 */
export class OpenAIEmbeddingsService implements EmbeddingsService {
  private readonly client!: any;
  private readonly model!: string;

  constructor(apiKey: string, model = "text-embedding-3-small") {
    try {
      const { OpenAI } = require("openai");
      (this as any).client = new OpenAI({ apiKey });
      (this as any).model = model;
    } catch (error) {
      throw new AppError(
        "OpenAI client not properly initialized. Ensure openai package is installed.",
        500,
        error,
      );
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const embedding = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      return embedding.data[0].embedding as EmbeddingVector;
    } catch (error) {
      throw new AppError(
        "Failed to generate embedding via OpenAI",
        502,
        error instanceof Error ? error.message : error,
      );
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    try {
      const embedding = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      const sortedEmbeddings = embedding.data.sort(
        (a: any, b: any) => a.index - b.index,
      );
      return sortedEmbeddings.map(
        (item: any) => item.embedding as EmbeddingVector,
      );
    } catch (error) {
      throw new AppError(
        "Failed to generate batch embeddings via OpenAI",
        502,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Google Gemini Embeddings Service
 */
export class GoogleEmbeddingsService implements EmbeddingsService {
  private readonly client!: any;
  private readonly model!: string;

  constructor(apiKey: string, model = "gemini-embedding-001") {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      (this as any).client = new GoogleGenerativeAI(apiKey);
      (this as any).model = model;
    } catch (error) {
      throw new AppError(
        "Google GenerativeAI client not properly initialized. Ensure @google/generative-ai package is installed.",
        500,
        error,
      );
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    try {
      const result = await this.client.embedContent({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      });

      return result.embedding.values as EmbeddingVector;
    } catch (error) {
      throw new AppError(
        "Failed to generate embedding via Google",
        502,
        error instanceof Error ? error.message : error,
      );
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
      );

      return embeddings.map(
        (result: any) => result.embedding.values as EmbeddingVector,
      );
    } catch (error) {
      throw new AppError(
        "Failed to generate batch embeddings via Google",
        502,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Local Embeddings Service
 * Free local embeddings for Node.js
 */
export class LocalEmbeddingsService implements EmbeddingsService {
  private extractor: any | null = null;
  private readonly modelName: string;

  constructor(modelName = "Xenova/all-MiniLM-L6-v2") {
    this.modelName = modelName;
  }

  private async initializeExtractor(): Promise<void> {
    if (this.extractor) return;

    try {
      const { pipeline } = require("@huggingface/transformers");
      this.extractor = await pipeline("feature-extraction", this.modelName);
    } catch (error) {
      throw new AppError(
        `Failed to initialize local embeddings model (${this.modelName}). Ensure @huggingface/transformers is installed.`,
        500,
        error,
      );
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    await this.initializeExtractor();

    try {
      const response = await this.extractor([text], {
        pooling: "mean",
        normalize: true,
      });

      return Array.from(response.data) as EmbeddingVector;
    } catch (error) {
      throw new AppError(
        "Failed to generate local embedding",
        500,
        error instanceof Error ? error.message : error,
      );
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    await this.initializeExtractor();

    try {
      const response = await this.extractor(texts, {
        pooling: "mean",
        normalize: true,
      });

      return response.tolist() as EmbeddingVector[];
    } catch (error) {
      throw new AppError(
        "Failed to generate local embeddings batch",
        500,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Factory
 * Default to local free embeddings if no cloud key is configured.
 */
export const createEmbeddingsService = (): EmbeddingsService => {
  const provider = process.env.EMBEDDINGS_PROVIDER?.toLowerCase();

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new AppError(
        "OPENAI_API_KEY is required when EMBEDDINGS_PROVIDER=openai",
        500,
      );
    }
    return new OpenAIEmbeddingsService(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    );
  }

  if (provider === "google") {
    if (!process.env.GOOGLE_API_KEY) {
      throw new AppError(
        "GOOGLE_API_KEY is required when EMBEDDINGS_PROVIDER=google",
        500,
      );
    }
    return new GoogleEmbeddingsService(
      process.env.GOOGLE_API_KEY,
      process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-001",
    );
  }

  return new LocalEmbeddingsService(
    process.env.LOCAL_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2",
  );
};
