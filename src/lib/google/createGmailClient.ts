import { google } from 'googleapis'
import type { env } from '../../config/env.js'

type GoogleEnv = Pick<
  typeof env,
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GOOGLE_REDIRECT_URI'
  | 'GOOGLE_REFRESH_TOKEN'
>

export const createGmailClient = (googleEnv: GoogleEnv) => {
  const oauthClient = new google.auth.OAuth2(
    googleEnv.GOOGLE_CLIENT_ID,
    googleEnv.GOOGLE_CLIENT_SECRET,
    googleEnv.GOOGLE_REDIRECT_URI,
  )

  oauthClient.setCredentials({
    refresh_token: googleEnv.GOOGLE_REFRESH_TOKEN,
  })

  return google.gmail({
    version: 'v1',
    auth: oauthClient,
  })
}
