import { Request, Response, NextFunction } from 'express'
import { RAGService } from '../services/rag.service.js'

export type RAGControllerDependencies = {
  ragService: RAGService
}

export class RAGController {
  private readonly ragService: RAGService

  constructor({ ragService }: RAGControllerDependencies) {
    this.ragService = ragService
  }

  indexMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { messageId } = req.params

      if (!messageId || Array.isArray(messageId)) {
        res.status(400).json({ error: 'messageId is required and must be a string' })
        return
      }

      const result = await this.ragService.indexEmailMessage(messageId)

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          result,
        })
        return
      }

      res.status(200).json({
        message: 'Message indexed successfully',
        result,
      })
    } catch (error) {
      next(error)
    }
  }

  indexThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { threadId } = req.params

      if (!threadId || Array.isArray(threadId)) {
        res.status(400).json({ error: 'threadId is required and must be a string' })
        return
      }

      const result = await this.ragService.indexEmailThread(threadId)

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          result,
        })
        return
      }

      res.status(200).json({
        message: 'Thread indexed successfully',
        result,
      })
    } catch (error) {
      next(error)
    }
  }

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, limit, threadId, messageId, participantEmail } = req.query

      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Query parameter "q" is required and must be a string' })
        return
      }

      const limitNumber = limit ? Number.parseInt(limit as string, 10) : 10
      if (limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' })
        return
      }

      const results = await this.ragService.searchSimilar(q, limitNumber, {
        threadId: typeof threadId === 'string' ? threadId : undefined,
        messageId: typeof messageId === 'string' ? messageId : undefined,
        participantEmail: typeof participantEmail === 'string' ? participantEmail : undefined,
      })

      res.status(200).json({
        query: q,
        limit: limitNumber,
        filters: {
          threadId: typeof threadId === 'string' ? threadId : undefined,
          messageId: typeof messageId === 'string' ? messageId : undefined,
          participantEmail: typeof participantEmail === 'string' ? participantEmail : undefined,
        },
        count: results.length,
        results,
      })
    } catch (error) {
      next(error)
    }
  }
}
