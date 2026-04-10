import { gmail_v1 } from 'googleapis'
import { AppError } from '../errors/AppError.js'

export type GmailSearchInput = {
  query?: string
  maxResults?: number
  pageToken?: string
}

export type GmailMessageSummary = {
  id: string
  threadId: string
  snippet: string
  subject: string | null
  from: string | null
  to: string | null
  date: string | null
  labelIds: string[]
}

export type GmailSearchResult = {
  query: string
  count: number
  messages: GmailMessageSummary[]
  nextPageToken?: string
  totalResults?: number
}

export type GmailMessageDetail = {
  id: string
  threadId: string
  snippet: string
  subject: string | null
  from: string | null
  to: string | null
  date: string | null
  labelIds: string[]
  body?: {
    text?: string
    html?: string
  }
  attachments?: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
}

export type GmailThreadDetail = {
  id: string
  messages: GmailMessageDetail[]
  messageCount: number
}

export interface GmailSearchService {
  search(input: GmailSearchInput): Promise<GmailSearchResult>
  getMessageDetail(messageId: string): Promise<GmailMessageDetail>
  getThreadDetail(threadId: string): Promise<GmailThreadDetail>
}

type GmailApi = gmail_v1.Gmail

type DefaultGmailSearchServiceDependencies = {
  gmailClient: GmailApi
}

const getHeader = (
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | null => {
  const header = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return header?.value ?? null
}

const toMessageSummary = (message: gmail_v1.Schema$Message): GmailMessageSummary => {
  const headers = message.payload?.headers

  return {
    id: message.id ?? '',
    threadId: message.threadId ?? '',
    snippet: message.snippet ?? '',
    subject: getHeader(headers, 'subject'),
    from: getHeader(headers, 'from'),
    to: getHeader(headers, 'to'),
    date: getHeader(headers, 'date'),
    labelIds: message.labelIds ?? [],
  }
}

export class DefaultGmailSearchService implements GmailSearchService {
  private readonly gmailClient: GmailApi

  constructor({ gmailClient }: DefaultGmailSearchServiceDependencies) {
    this.gmailClient = gmailClient
  }

  async search({ query, maxResults = 10, pageToken }: GmailSearchInput = {}): Promise<GmailSearchResult> {
    try {
      console.log("query", query);
      const listResponse = await this.gmailClient.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken,
      })

      const messages = listResponse.data.messages ?? []

      if (messages.length === 0) {
        return {
          query: query ?? '',
          count: 0,
          messages: [],
          nextPageToken: listResponse.data.nextPageToken ?? undefined,
          totalResults: listResponse.data.resultSizeEstimate ?? undefined,
        }
      }

      const messageResponses = await Promise.all(
        messages.map(async (message) => {
          return this.gmailClient.users.messages.get({
            userId: 'me',
            id: message.id ?? '',
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date'],
          })
        }),
      )

      return {
        query: query ?? '',
        count: messageResponses.length,
        messages: messageResponses.map((messageResponse) => toMessageSummary(messageResponse.data)),
        nextPageToken: listResponse.data.nextPageToken ?? undefined,
        totalResults: listResponse.data.resultSizeEstimate ?? undefined,
      }
    } catch (error) {
      console.log("error",error)
      throw new AppError(
        'Failed to fetch matching Gmail messages',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async getMessageDetail(messageId: string): Promise<GmailMessageDetail> {
    try {
      const messageResponse = await this.gmailClient.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const message = messageResponse.data
      const headers = message.payload?.headers

      // Extract body content
      const body = this.extractMessageBody(message.payload)

      // Extract attachments
      const attachments = this.extractAttachments(message.payload)

      return {
        id: message.id ?? '',
        threadId: message.threadId ?? '',
        snippet: message.snippet ?? '',
        subject: getHeader(headers, 'subject'),
        from: getHeader(headers, 'from'),
        to: getHeader(headers, 'to'),
        date: getHeader(headers, 'date'),
        labelIds: message.labelIds ?? [],
        body,
        attachments,
      }
    } catch (error) {
      console.log("error", error)
      throw new AppError(
        'Failed to fetch Gmail message details',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  async getThreadDetail(threadId: string): Promise<GmailThreadDetail> {
    try {
      const threadResponse = await this.gmailClient.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      })

      const thread = threadResponse.data
      const messages = thread.messages ?? []

      const detailedMessages = await Promise.all(
        messages.map(async (message) => {
          const headers = message.payload?.headers
          const body = this.extractMessageBody(message.payload)
          const attachments = this.extractAttachments(message.payload)

          return {
            id: message.id ?? '',
            threadId: message.threadId ?? '',
            snippet: message.snippet ?? '',
            subject: getHeader(headers, 'subject'),
            from: getHeader(headers, 'from'),
            to: getHeader(headers, 'to'),
            date: getHeader(headers, 'date'),
            labelIds: message.labelIds ?? [],
            body,
            attachments,
          }
        })
      )

      return {
        id: thread.id ?? '',
        messages: detailedMessages,
        messageCount: messages.length,
      }
    } catch (error) {
      console.log("error", error)
      throw new AppError(
        'Failed to fetch Gmail thread details',
        502,
        error instanceof Error ? error.message : error,
      )
    }
  }

  private extractMessageBody(payload?: gmail_v1.Schema$MessagePart): { text?: string; html?: string } | undefined {
    if (!payload) return undefined

    const body: { text?: string; html?: string } = {}

    // Handle simple body
    if (payload.body?.data) {
      const mimeType = payload.mimeType
      const data = Buffer.from(payload.body.data, 'base64').toString()

      if (mimeType === 'text/plain') {
        body.text = data
      } else if (mimeType === 'text/html') {
        body.html = data
      }
    }

    // Handle multipart messages
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body.text = Buffer.from(part.body.data, 'base64').toString()
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body.html = Buffer.from(part.body.data, 'base64').toString()
        }
      }
    }

    return Object.keys(body).length > 0 ? body : undefined
  }

  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }> | undefined {
    if (!payload?.parts) return undefined

    const attachments: Array<{
      filename: string
      mimeType: string
      size: number
      attachmentId: string
    }> = []

    const extractFromParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType ?? 'application/octet-stream',
            size: part.body.size ?? 0,
            attachmentId: part.body.attachmentId,
          })
        }

        if (part.parts) {
          extractFromParts(part.parts)
        }
      }
    }

    extractFromParts(payload.parts)
    return attachments.length > 0 ? attachments : undefined
  }
}

export class UnconfiguredGmailSearchService implements GmailSearchService {
  async search(): Promise<GmailSearchResult> {
    throw new AppError(
      'Google Mail is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_REFRESH_TOKEN.',
      503,
    )
  }

  async getMessageDetail(): Promise<GmailMessageDetail> {
    throw new AppError(
      'Google Mail is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_REFRESH_TOKEN.',
      503,
    )
  }

  async getThreadDetail(): Promise<GmailThreadDetail> {
    throw new AppError(
      'Google Mail is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_REFRESH_TOKEN.',
      503,
    )
  }
}
