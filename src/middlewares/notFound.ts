import type { Request, Response } from 'express'
import { AppError } from '../errors/AppError.js'

export const notFoundHandler = (request: Request, response: Response) => {
  const error = new AppError(
    `Route not found: ${request.method} ${request.originalUrl}`,
    404,
  )

  response.status(error.statusCode).json({
    ok: false,
    message: error.message,
  })
}
