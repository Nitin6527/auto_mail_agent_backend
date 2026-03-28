import type { RequestHandler } from 'express'
import type { env as envType } from '../config/env.js'
import { getAuthUrl, exchangeCodeForTokens } from '../lib/google/oauth.js'
import { AppError } from '../errors/AppError.js'
import { ok } from '../utils/http/response.js'

type GoogleAuthControllerDependencies = {
  env: typeof envType
}

export const getGoogleAuthUrlController = ({
  env,
}: GoogleAuthControllerDependencies): RequestHandler => {
  return (request, response) => {
    try {
      const authUrl = getAuthUrl({
        GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || '',
        GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || '',
        GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI || '',
      })

      response.json(ok({ authUrl }))
    } catch (error) {
      throw new AppError(
        'Failed to generate Google auth URL',
        500,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

export const handleGoogleAuthCallbackController = ({
  env,
}: GoogleAuthControllerDependencies): RequestHandler => {
  return async (request, response) => {
    try {
      const { code } = request.query

      if (!code || typeof code !== 'string') {
        throw new AppError('Authorization code is missing', 400)
      }

      const tokens = await exchangeCodeForTokens(
        {
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || '',
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || '',
          GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI || '',
        },
        code,
      )
      // Store refresh token in environment or database
      // For now, return it to the client to configure
      response.json(
        ok({
          message: 'Authorization successful',
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiresIn: tokens.expiry_date,
        }),
      )
    } catch (error) {
      throw new AppError(
        'Failed to handle Google callback',
        500,
        error instanceof Error ? error.message : error,
      )
    }
  }
}
