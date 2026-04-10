import { Router } from 'express'
import { searchGmailController } from '../controllers/gmail.controller.js'
import { getMessageDetailController, getThreadDetailController } from '../controllers/gmail-detail.controller.js'
import type { GmailSearchService } from '../services/gmail-search.service.js'
import type { RAGService } from '../services/rag.service.js'

type BuildGmailRouterOptions = {
  gmailSearchService: GmailSearchService
  ragService?: RAGService
}

export const buildGmailRouter = ({
  gmailSearchService,
  ragService,
}: BuildGmailRouterOptions) => {
  const gmailRouter = Router()

  gmailRouter.post('/search', searchGmailController({ gmailSearchService, ragService }))
  gmailRouter.get('/message/:messageId', getMessageDetailController({ gmailSearchService }))
  gmailRouter.get(
    '/thread/:threadId',
    getThreadDetailController({
      gmailSearchService
    }),
  )

  return gmailRouter
}
