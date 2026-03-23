"use client";

import { useProjectsContext } from "../context/projects-context";
import { useProjectContext } from "../context/project-context";

import dynamic from "next/dynamic";
import { Sidebar } from "../components/sidebar";
import { ProjectsGrid } from "../components/projects-grid";
import { ConversationsList } from "../components/conversations-list";
import { ChatInterface } from "../components/chat-interface";
import { ProjectModal } from "../components/project-modal";
import { Icon } from "../components/icons";

const KnowledgeSidebar = dynamic(
  () =>
    import("../components/knowledge-sidebar").then((m) => ({
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
    import("../components/document-modal").then((m) => ({
      default: m.DocumentModal,
    })),
  { ssr: false },
);

export default function HomePage() {
  const { showProjectModal, setShowProjectModal, statusMessage, errorMessage, isBusy, handleCreateProject } =
    useProjectsContext();

  const { activeProject, documents, selectedDocumentId, setSelectedDocumentId, view } =
    useProjectContext();

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex flex-col flex-1 min-w-0 p-4 gap-[14px]">
          <div className="flex items-center justify-between gap-3 px-[18px] py-[14px] border border-neon-border rounded-[18px] bg-[rgba(17,24,39,0.72)] backdrop-blur-[10px]">
            <div>
              <strong className="block text-[0.98rem] text-neon-text">
                AtlasRAG Dashboard
              </strong>
              <span className="text-neon-muted text-[0.92rem]">{statusMessage}</span>
            </div>
            <div className="flex items-center gap-3">
              {errorMessage && (
                <span className="text-[#fca5a5] text-sm">{errorMessage}</span>
              )}
              {isBusy && (
                <span className="inline-flex items-center gap-1 text-neon-accent text-sm">
                  <Icon name="loader" />
                  Working...
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-4 min-h-0 flex-1">
            {view === "projects" ? (
              <ProjectsGrid />
            ) : activeProject ? (
              view === "detail" ? (
                <ConversationsList />
              ) : (
                <ChatInterface />
              )
            ) : (
              <section className="flex-1 min-w-0 overflow-auto border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                <div className="min-h-[320px] grid place-items-center text-center gap-3 p-7">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                    <Icon name="briefcase" />
                  </div>
                  <h3 className="m-0 text-base text-neon-text">No project selected</h3>
                  <p className="text-neon-muted text-[0.92rem]">
                    Create a project to start the upload flow.
                  </p>
                </div>
              </section>
            )}

            {activeProject && <KnowledgeSidebar />}
          </div>
        </main>
      </div>

      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSubmit={handleCreateProject}
          isSubmitting={isBusy}
          errorMessage={errorMessage}
        />
      )}

      {selectedDocumentId &&
        (() => {
          const selectedDocument =
            documents.find((d) => d.id === selectedDocumentId) ?? null;
          return selectedDocument ? (
            <DocumentModal
              doc={selectedDocument}
              onClose={() => setSelectedDocumentId(null)}
            />
          ) : null;
        })()}
    </>
  );
}
