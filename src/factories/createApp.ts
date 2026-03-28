import cors from 'cors'
import express, { type Router } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from "../config/env.js";
import { getRootController } from '../controllers/root.controller.js'
import { errorHandler } from '../middlewares/errorHandler.js'
import { notFoundHandler } from '../middlewares/notFound.js'
import { buildGoogleAuthRouter } from '../routes/google-auth.route.js'

type CreateAppOptions = {
  apiRouter: Router
  corsOrigin: string
}

export const createApp = ({ apiRouter, corsOrigin }: CreateAppOptions) => {
  const app = express()

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  )
  app.use(helmet())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan('dev'))

  app.get('/', getRootController())
  app.use('/auth/google', buildGoogleAuthRouter({ env }))
  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
