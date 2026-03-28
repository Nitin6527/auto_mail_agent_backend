import { Router } from 'express'
import { getHealthController } from '../controllers/health.controller.js'
import type { HealthService } from '../services/health.service.js'

type BuildHealthRouterOptions = {
  healthService: HealthService
}

export const buildHealthRouter = ({
  healthService,
}: BuildHealthRouterOptions) => {
  const healthRouter = Router()

  healthRouter.get('/', getHealthController({ healthService }))

  return healthRouter
}
