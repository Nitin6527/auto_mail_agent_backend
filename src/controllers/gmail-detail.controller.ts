import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { GmailSearchService } from '../services/gmail-search.service.js'
import type { RAGService } from '../services/rag.service.js'
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
  ragService?: RAGService
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
  ragService,
}: GmailDetailControllerDependencies): RequestHandler => {
  return async (request, response) => {
    const parsedRequest = getThreadDetailSchema.safeParse(request.params)

    if (!parsedRequest.success) {
      throw new AppError('Invalid thread ID', 400, parsedRequest.error.flatten())
    }

    console.log(`\n========== API CALL: /api/gmail/thread/${parsedRequest.data.threadId} ==========`)
    console.log(`Fetching thread details...`)

    const result = await gmailSearchService.getThreadDetail(parsedRequest.data.threadId)
    console.log(`Thread fetched successfully with ${result.messages.length} messages`)

    // Send response immediately
    response.json(ok(result))

    // Trigger RAG indexing asynchronously if ragService is available
    if (ragService) {
      console.log(`\n========== TRIGGERING ASYNC RAG INDEXING ==========`)
      console.log(`Starting RAG indexing for thread in background...`,result)
      
   if (
     !ragService ||
     ragService.constructor.name === "UnconfiguredRAGService"
   ) {
     console.log(`RAG service not available, skipping indexing`);
     return;
   }

   void ragService
     .indexThreadFromData(result)
     .then((indexingResult) => {
       console.log(
         `\n========== RAG INDEXING BACKGROUND TASK COMPLETED ==========`,
       );

       console.log(`Indexing Result:`, {
         success: indexingResult.success,
         sourceId: indexingResult.sourceId,
         sourceType: indexingResult.sourceType,
         chunksCreated: indexingResult.chunksCreated,
         vectorsUpserted: indexingResult.vectorsUpserted,
         error: indexingResult.error,
       });
     })
     .catch((error) => {
       console.error(
         `\n========== RAG INDEXING BACKGROUND TASK FAILED ==========`,
       );
       console.error(
         `Error during background indexing:`,
         error instanceof Error ? error.message : error,
       );
     });
    } else {
      console.log(`RAG service not available, skipping indexing`)
    }
  }
}
