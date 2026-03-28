import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { GmailSearchService } from '../services/gmail-search.service.js'
import { AppError } from '../errors/AppError.js'
import { ok } from '../utils/http/response.js'

const getMessageDetailSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
})

const getThreadDetailSchema = z.object({
  threadId: z.string().min(1, 'threadId is required'),
})

type GmailDetailControllerDependencies = {
  gmailSearchService: GmailSearchService
}

export const getMessageDetailController = ({
  gmailSearchService,
}: GmailDetailControllerDependencies): RequestHandler => {
  return async (request, response) => {
    const parsedRequest = getMessageDetailSchema.safeParse(request.params)

    if (!parsedRequest.success) {
      throw new AppError('Invalid message ID', 400, parsedRequest.error.flatten())
    }

    const result = await gmailSearchService.getMessageDetail(parsedRequest.data.messageId)
    response.json(ok(result))
  }
}

export const getThreadDetailController = ({
  gmailSearchService,
}: GmailDetailControllerDependencies): RequestHandler => {
  return async (request, response) => {
    const parsedRequest = getThreadDetailSchema.safeParse(request.params)

    if (!parsedRequest.success) {
      throw new AppError('Invalid thread ID', 400, parsedRequest.error.flatten())
    }

    const result = await gmailSearchService.getThreadDetail(parsedRequest.data.threadId)
    response.json(ok(result))
  }
}