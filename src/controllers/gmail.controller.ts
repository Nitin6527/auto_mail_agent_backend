import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { GmailSearchService } from '../services/gmail-search.service.js'
import type { RAGService } from '../services/rag.service.js'
import { AppError } from '../errors/AppError.js'
import { ok } from '../utils/http/response.js'

const gmailSearchSchema = z.object({
  query: z.string().trim().optional(),
  maxResults: z.coerce.number().int().min(1).max(25).optional(),
  pageToken: z.string().optional(),
})

type SearchGmailControllerDependencies = {
  gmailSearchService: GmailSearchService
  ragService?: RAGService
}

export const searchGmailController = ({
  gmailSearchService,
  ragService,
}: SearchGmailControllerDependencies): RequestHandler => {
  return async (request, response) => {
    const parsedRequest = gmailSearchSchema.safeParse(request.body ?? {})

    if (!parsedRequest.success) {
      throw new AppError('Invalid Gmail search payload', 400, parsedRequest.error.flatten())
    }

    if (ragService && ragService.constructor.name !== 'UnconfiguredRAGService') {
      const result = await ragService.searchAndIndexMailbox(parsedRequest.data)
      response.json(ok(result))
      return
    }

    const result = await gmailSearchService.search(parsedRequest.data)

    response.json(ok(result))
  }
}
