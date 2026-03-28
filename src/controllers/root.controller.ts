import type { RequestHandler } from 'express'
import { ok } from '../utils/http/response.js'

export const getRootController = (): RequestHandler => {
  return (_request, response) => {
    response.json(
      ok({
        message: 'Auto Email Handler backend is running.',
      }),
    )
  }
}
