import { Router } from 'express'
import { RAGController } from '../controllers/rag.controller.js'

export const createRAGRouter = (ragController: RAGController): Router => {
  const router = Router()

  /**
   * Index an email message
   * POST /rag/index-message/:messageId
   */
  router.post('/index-message/:messageId', (req, res, next) => {
    ragController.indexMessage(req, res, next)
  })

  /**
   * Index an email thread
   * POST /rag/index-thread/:threadId
   */
  router.post('/index-thread/:threadId', (req, res, next) => {
    ragController.indexThread(req, res, next)
  })

  /**
   * Search for similar content
   * GET /rag/search?q=<query>&limit=<limit>
   */
  router.get('/search', (req, res, next) => {
    ragController.search(req, res, next)
  })

  return router
}
