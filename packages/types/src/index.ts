export type ProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "partitioning"
  | "chunking"
  | "summarising"
  | "vectorization"
  | "completed"
  | "failed";

export type SourceType = "file" | "url";
export type RetrievalStrategy = "hybrid" | "vector" | "keyword";
export type MessageRole = "system" | "user" | "assistant";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  embeddingModel: string;
  retrievalStrategy: RetrievalStrategy;
  chunksPerSearch: number;
  finalContextSize: number;
  similarityThreshold: number;
  queryVariationCount: number;
  vectorWeight: number;
  keywordWeight: number;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  sourceType: SourceType;
  sourceUrl: string | null;
  processingStatus: ProcessingStatus;
  processingDetails: Record<string, unknown>;
  pageCount: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  projectId: string;
  documentId: string;
  chunkIndex: number;
  retrievalText: string;
  originalContent: Record<string, unknown>;
  modalityFlags: string[];
  pageNumber: number | null;
  tokenCount: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  pageNumber: number | null;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  metadata: Record<string, unknown>;
  createdAt: string;
}
