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
export type RetrievalStrategy =
  | "vector"               // basic cosine similarity on embeddings
  | "keyword"              // full-text search (tsvector / BM25-style)
  | "hybrid"               // vector + keyword merged with RRF
  | "multi_query_vector"   // generate N query variants, run vector search for each, fuse results
  | "multi_query_hybrid";  // generate N query variants, run hybrid search for each, fuse results
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

// ─── Notebook types ──────────────────────────────────────────────────────────
// Notebooks are a developer tool for testing retrieval and agent pipelines.
// They are separate from chats (which are the user-facing conversation history).

export type NotebookCellType = "query" | "agent_run" | "markdown" | "comparison";
export type NotebookCellStatus = "idle" | "running" | "done" | "error";

export interface Notebook {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input shapes per cell type
export interface QueryCellInput {
  query: string;
  retrievalStrategy?: RetrievalStrategy;
  chunksPerSearch?: number;
  similarityThreshold?: number;
}

export interface AgentRunCellInput {
  query: string;
  retrievalStrategy?: RetrievalStrategy;
  chunksPerSearch?: number;
}

export interface ComparisonCellInput {
  query: string;
  configA: Partial<Pick<ProjectSettings, "retrievalStrategy" | "chunksPerSearch" | "vectorWeight" | "keywordWeight">>;
  configB: Partial<Pick<ProjectSettings, "retrievalStrategy" | "chunksPerSearch" | "vectorWeight" | "keywordWeight">>;
}

export interface MarkdownCellInput {
  text: string;
}

// Output shapes per cell type
export interface ChunkResult {
  id: string;
  retrievalText: string;
  score: number;
  pageNumber: number | null;
  documentId: string;
  chunkIndex: number;
}

export interface QueryCellOutput {
  chunks: ChunkResult[];
  latencyMs: number;
}

export interface AgentStep {
  step: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface AgentRunCellOutput {
  answer: string;
  citations: Citation[];
  agentSteps: AgentStep[];
  latencyMs: number;
}

export interface ComparisonCellOutput {
  resultA: QueryCellOutput;
  resultB: QueryCellOutput;
}

export interface NotebookCell {
  id: string;
  notebookId: string;
  cellIndex: number;
  cellType: NotebookCellType;
  input: QueryCellInput | AgentRunCellInput | ComparisonCellInput | MarkdownCellInput | Record<string, unknown>;
  output: QueryCellOutput | AgentRunCellOutput | ComparisonCellOutput | Record<string, unknown>;
  status: NotebookCellStatus;
  errorMessage: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
