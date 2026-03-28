import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { GmailSearchService } from '../services/gmail-search.service.js'
import { AppError } from '../errors/AppError.js'
import { ok } from '../utils/http/response.js'

const gmailSearchSchema = z.object({
  query: z.string().trim().min(1, 'query is required'),
  maxResults: z.coerce.number().int().min(1).max(25).optional(),
  pageToken: z.string().optional(),
})

type SearchGmailControllerDependencies = {
  gmailSearchService: GmailSearchService
}

export const searchGmailController = ({
  gmailSearchService,
}: SearchGmailControllerDependencies): RequestHandler => {
  return async (request, response) => {
    const parsedRequest = gmailSearchSchema.safeParse(request.body)

    if (!parsedRequest.success) {
      throw new AppError('Invalid Gmail search payload', 400, parsedRequest.error.flatten())
    }

    const result = await gmailSearchService.search(parsedRequest.data)

    response.json(ok(result))
  }
}
