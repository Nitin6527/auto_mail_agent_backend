import { createApp } from './factories/createApp.js'
import { env } from './config/env.js'
import { buildApiRouter } from './routes/index.js'

export const app = createApp({
  corsOrigin: env.FRONTEND_URL,
  apiRouter: buildApiRouter(),
})
