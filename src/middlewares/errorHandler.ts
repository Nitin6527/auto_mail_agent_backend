import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError.js'
import { fail } from '../utils/http/response.js'

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  console.error(error)

  if (error instanceof AppError) {
    response.status(error.statusCode).json(fail(error.message, error.details))
    return
  }

  response.status(500).json(fail('Internal server error'))
}
