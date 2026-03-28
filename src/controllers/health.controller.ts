import type { RequestHandler } from 'express'
import type { HealthService } from '../services/health.service.js'
import { ok } from '../utils/http/response.js'

type HealthControllerDependencies = {
  healthService: HealthService
}

export const getHealthController = ({
  healthService,
}: HealthControllerDependencies): RequestHandler => {
  return (_request, response) => {
    response.json(ok(healthService.getStatus()))
  }
}
