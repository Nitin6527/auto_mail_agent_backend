import { google } from 'googleapis'
import type { env } from '../../config/env.js'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

type GoogleEnv = Pick<
  typeof env,
  'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_REDIRECT_URI'
>

export const createOAuthClient = (googleEnv: GoogleEnv) => {
  return new google.auth.OAuth2(
    googleEnv.GOOGLE_CLIENT_ID,
    googleEnv.GOOGLE_CLIENT_SECRET,
    googleEnv.GOOGLE_REDIRECT_URI,
  )
}

export const getAuthUrl = (googleEnv: GoogleEnv): string => {
  const oauth2Client = createOAuthClient(googleEnv)

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
}

export const exchangeCodeForTokens = async (
  googleEnv: GoogleEnv,
  code: string,
) => {
  const oauth2Client = createOAuthClient(googleEnv)
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}
