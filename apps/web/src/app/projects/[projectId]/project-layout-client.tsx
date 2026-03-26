"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ProjectProvider } from "../../../context/project-context";
import { useProjectContext } from "../../../context/project-context";
import type { Chat, Project, ProjectDocument, ProjectSettings } from "../../../types";
import { apiFetch } from "../../../lib/api";

const KnowledgeSidebar = dynamic(
  () =>
    import("../../../components/knowledge-sidebar").then((m) => ({
      default: m.KnowledgeSidebar,
    })),
  {
    ssr: false,
    loading: () => (
      <aside className="w-[360px] shrink-0 flex flex-col min-h-0 border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)]">
        <div className="px-5 py-[18px] border-b border-neon-border">
          <div className="animate-pulse h-5 w-28 bg-neon-border rounded" />
        </div>
        <div className="flex-1" />
      </aside>
    ),
  },
);

const DocumentModal = dynamic(
  () =>
    import("../../../components/document-modal").then((m) => ({
      default: m.DocumentModal,
    })),
  { ssr: false },
);

type InitialData = {
  project: Project;
  documents: ProjectDocument[];
  chats: Chat[];
  settings: ProjectSettings;
};

function ProjectLayoutInner({ children }: { children: ReactNode }) {
  const { activeProjectId, documents, selectedDocumentId, setSelectedDocumentId } =
    useProjectContext();

  const selectedDocument =
    selectedDocumentId != null
      ? (documents.find((d) => d.id === selectedDocumentId) ?? null)
      : null;

  const handleReprocess = selectedDocument && activeProjectId
    ? () => {
        apiFetch(`/projects/${activeProjectId}/files/${selectedDocument.id}/reprocess`, { method: "POST" })
          .then(() => setSelectedDocumentId(null))
          .catch(() => {});
      }
    : undefined;

  return (
    <>
      {children}
      <KnowledgeSidebar />
      {selectedDocument && (
        <DocumentModal
          doc={selectedDocument}
          onClose={() => setSelectedDocumentId(null)}
          onReprocess={handleReprocess}
        />
      )}
    </>
  );
}

export function ProjectLayoutClient({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: InitialData;
}) {
  return (
    <ProjectProvider initialData={initialData}>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectProvider>
  );
}
