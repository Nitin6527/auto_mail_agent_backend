import { Router } from 'express'
import { searchGmailController } from '../controllers/gmail.controller.js'
import { getMessageDetailController, getThreadDetailController } from '../controllers/gmail-detail.controller.js'
import type { GmailSearchService } from '../services/gmail-search.service.js'

type BuildGmailRouterOptions = {
  gmailSearchService: GmailSearchService
}

export const buildGmailRouter = ({
  gmailSearchService,
}: BuildGmailRouterOptions) => {
  const gmailRouter = Router()

  gmailRouter.post('/search', searchGmailController({ gmailSearchService }))
  gmailRouter.get('/message/:messageId', getMessageDetailController({ gmailSearchService }))
  gmailRouter.get('/thread/:threadId', getThreadDetailController({ gmailSearchService }))

  return gmailRouter
}
