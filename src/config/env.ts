import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { z } from 'zod'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirectoryPath = path.dirname(currentFilePath)

dotenv.config({
  path: path.resolve(currentDirectoryPath, '../../../secrets/.env'),
})

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  // Embeddings configuration
  EMBEDDINGS_PROVIDER: z.enum(["openai", "google", "local"]).default("local"),
  GOOGLE_API_KEY: z.string().optional(),
  // Qdrant configuration
  QDRANT_HOST: z.string().default("localhost"),
  QDRANT_PORT: z.coerce.number().default(6333),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION_NAME: z.string().default("emails"),
  QDRANT_VECTOR_SIZE: z.coerce.number().optional(),
})

const parsedEnv = envSchema.parse(process.env)
const defaultQdrantVectorSize =
  parsedEnv.EMBEDDINGS_PROVIDER === 'local'
    ? 384
    : 1536

export const env = {
  ...parsedEnv,
  QDRANT_VECTOR_SIZE: parsedEnv.QDRANT_VECTOR_SIZE ?? defaultQdrantVectorSize,
}


export const hasGoogleMailConfig = Boolean(
  env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_REDIRECT_URI
)

export const hasRAGConfig = Boolean(
  env.QDRANT_HOST &&
    ((env.EMBEDDINGS_PROVIDER === 'google' && env.GOOGLE_API_KEY) ||
      (env.EMBEDDINGS_PROVIDER === 'openai' && env.OPENAI_API_KEY) ||
      env.EMBEDDINGS_PROVIDER === 'local'),
)
