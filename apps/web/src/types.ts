export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type Chat = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Citation = {
  filename?: string;
  page?: number | null;
};

export type Message = {
  id: string;
  chatId: string;
  role: "system" | "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

export type ChatDetail = Chat & {
  messages: Message[];
};

export type ProjectDocument = {
  id: string;
  projectId: string;
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
  "vectorization",
]);
