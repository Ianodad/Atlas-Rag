export type ProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "partitioning"
  | "chunking"
  | "summarising"
  | "vectorization"
  | "completed";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  sourceType: "file" | "url";
  processingStatus: ProcessingStatus;
  createdAt: string;
}
