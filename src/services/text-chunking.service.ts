export type TextChunk = {
  id: string
  text: string
  metadata: {
    sourceType: 'message' | 'thread'
    sourceId: string
    chunkIndex: number
    totalChunks: number
  }
}

export interface TextChunkingService {
  chunkText(text: string, sourceId: string, sourceType: 'message' | 'thread'): TextChunk[]
}

export class DefaultTextChunkingService implements TextChunkingService {
  private readonly chunkSize: number
  private readonly overlapSize: number

  constructor(chunkSize = 1000, overlapSize = 200) {
    this.chunkSize = chunkSize
    this.overlapSize = overlapSize
  }

  chunkText(text: string, sourceId: string, sourceType: 'message' | 'thread'): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    // Split by sentences/lines to avoid breaking mid-word
    const sentences = this.splitIntoSentences(text)
    const chunks: TextChunk[] = []
    let currentChunk = ''
    let chunkIndex = 0

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence

      if (potentialChunk.length <= this.chunkSize) {
        currentChunk = potentialChunk
      } else {
        // Save current chunk if not empty
        if (currentChunk.trim().length > 0) {
          chunks.push({
            id: `${sourceId}-chunk-${chunkIndex}`,
            text: currentChunk.trim(),
            metadata: {
              sourceType,
              sourceId,
              chunkIndex,
              totalChunks: 0, // Will be set later
            },
          })
          chunkIndex++
        }

        // Start new chunk, with overlap
        currentChunk = this.getOverlappingText(currentChunk, this.overlapSize) + ' ' + sentence
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          sourceType,
          sourceId,
          chunkIndex,
          totalChunks: 0,
        },
      })
    }

    // Update totalChunks for all chunks
    const totalChunks = chunks.length
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = totalChunks
    })

    return chunks
  }

  private splitIntoSentences(text: string): string[] {
    // Split by common sentence endings, but preserve the punctuation
    const sentenceRegex = /[^.!?]*[.!?]+/g
    const matches = text.match(sentenceRegex) || []

    if (matches.length === 0) {
      // If no sentences found, split by newlines or return whole text
      return text.split('\n').filter((line) => line.trim().length > 0)
    }

    return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0)
  }

  private getOverlappingText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text
    }
    return text.substring(text.length - overlapSize)
  }
}
