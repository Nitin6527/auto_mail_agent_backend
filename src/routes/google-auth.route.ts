import { Router } from 'express'
import type { env as envType } from '../config/env.js'
import {
  getGoogleAuthUrlController,
  handleGoogleAuthCallbackController,
} from '../controllers/google-auth.controller.js'

type BuildGoogleAuthRouterOptions = {
  env: typeof envType
}

export const buildGoogleAuthRouter = ({ env }: BuildGoogleAuthRouterOptions) => {
  const authRouter = Router()

  authRouter.get('/login', getGoogleAuthUrlController({ env }))
  authRouter.get('/callback', handleGoogleAuthCallbackController({ env }))

  return authRouter
}
