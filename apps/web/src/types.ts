export type Project = {
  id: string;
  userId?: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Chat = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Citation = {
  chunk_id?: string | null;
  filename?: string;
  page?: number | null;
  source_type?: "file" | "url";
  source_url?: string | null;
  document_id?: string | null;
  chunk_index?: number | null;
  has_images?: boolean;
};

export type MessageFeedback = {
  id: string;
  messageId: string;
  rating: "thumbs_up" | "thumbs_down";
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  role: "system" | "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
  feedback?: MessageFeedback | null;
};

export type ChatDetail = Chat & {
  messages: Message[];
};

export type ProjectDocument = {
  id: string;
  projectId: string;
  taskId: string | null;
  filename: string;
  mimeType: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  sourceType: "file" | "url";
  sourceUrl: string | null;
  processingStatus: string;
  processingDetails: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSettings = {
  id: string;
  projectId: string;
  embeddingModel: string;
  llmProvider: "openai" | "google_gemini";
  llmModel: string;
  retrievalStrategy:
    | "vector"
    | "keyword"
    | "hybrid"
    | "multi_query_vector"
    | "multi_query_hybrid";
  chunksPerSearch: number;
  finalContextSize: number;
  similarityThreshold: number;
  queryVariationCount: number;
  vectorWeight: number;
  keywordWeight: number;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  storageBucket: string;
  storagePath: string;
  token: string;
};

export type View = "projects" | "detail" | "chat";
export type KnowledgeTab = "documents" | "settings";

export const ACTIVE_STATUSES = new Set([
  "queued",
  "processing",
  "partitioning",
  "chunking",
  "summarising",
  "embedding",
  "vectorization",
]);
