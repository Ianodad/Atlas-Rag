"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useProjectsContext } from "../context/projects-context";
import { useProjectContext } from "../context/project-context";
import { useChatContext } from "../context/chat-context";

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
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    filteredProjects,
    searchQuery,
    setSearchQuery,
    showProjectModal,
    setShowProjectModal,
    statusMessage,
    errorMessage,
    isBusy,
    handleCreateProject,
    handleDeleteProject,
  } = useProjectsContext();

  const {
    activeProjectId,
    setActiveProjectId,
    activeProject,
    documents,
    chats,
    settings,
    settingsDraft,
    setSettingsDraft,
    knowledgeTab,
    setKnowledgeTab,
    urlValue,
    setUrlValue,
    selectedFileName,
    selectedDocumentId,
    setSelectedDocumentId,
    isSavingSettings,
    view,
    setView,
    fileInputRef,
    handleNewChat,
    handleDeleteChat,
    handleDeleteDocument,
    handleSelectedFile,
    handleAddUrl,
    handleSaveSettings,
  } = useProjectContext();

  const {
    activeChatId,
    setActiveChatId,
    activeChat,
    setActiveChat,
    draftMessage,
    setDraftMessage,
    isSendingMessage,
    streamingContent,
    streamingStatus,
    handleSendMessage,
    handleFeedback,
  } = useChatContext();

  // Navigation coordinators: couple data handlers to view/chat state
  async function onNewChat() {
    const result = await handleNewChat();
    if (result) {
      setActiveChatId(result.chatId);
      setView("chat");
    }
  }

  async function onDeleteChat(chatId: string) {
    const result = await handleDeleteChat(chatId, activeChatId);
    if (result.clearedChat) {
      setActiveChatId(null);
      setActiveChat(null);
      setView("detail");
    }
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          projects={filteredProjects}
          activeProjectId={activeProjectId}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          onProject={(id) => {
            setActiveProjectId(id);
            setActiveChatId(null);
            setActiveChat(null);
            setView("detail");
            router.push(`/projects/${id}`);
          }}
          onOpenProjects={() => {
            setView("projects");
            router.push("/projects");
          }}
          onNewProject={() => setShowProjectModal(true)}
        />

        <main className="flex flex-col flex-1 min-w-0 p-4 gap-[14px]">
          <div className="flex items-center justify-between gap-3 px-[18px] py-[14px] border border-neon-border rounded-[18px] bg-[rgba(17,24,39,0.72)] backdrop-blur-[10px]">
            <div>
              <strong className="block text-[0.98rem] text-neon-text">
                AtlasRAG Dashboard
              </strong>
              <span className="text-neon-muted text-[0.92rem]">
                {statusMessage}
              </span>
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
              <ProjectsGrid
                projects={filteredProjects}
                query={searchQuery}
                setQuery={setSearchQuery}
                onProject={(id) => {
                  setActiveProjectId(id);
                  setView("detail");
                  router.push(`/projects/${id}`);
                }}
                onNewProject={() => setShowProjectModal(true)}
                onDeleteProject={(id) => void handleDeleteProject(id)}
              />
            ) : activeProject ? (
              view === "detail" ? (
                <ConversationsList
                  project={activeProject}
                  chats={chats}
                  onNewChat={() => void onNewChat()}
                  onChat={(id) => {
                    setActiveChatId(id);
                    setView("chat");
                  }}
                  onDeleteChat={(id) => void onDeleteChat(id)}
                  onDeleteProject={() =>
                    void handleDeleteProject(activeProject.id)
                  }
                />
              ) : (
                <ChatInterface
                  chat={activeChat}
                  draft={draftMessage}
                  setDraft={setDraftMessage}
                  onBack={() => setView("detail")}
                  onSend={() => void handleSendMessage()}
                  isSending={isSendingMessage}
                  streamingContent={streamingContent}
                  streamingStatus={streamingStatus}
                  onFeedback={(id, rating) => void handleFeedback(id, rating)}
                />
              )
            ) : (
              <section className="flex-1 min-w-0 overflow-auto border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                <div className="min-h-[320px] grid place-items-center text-center gap-3 p-7">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                    <Icon name="briefcase" />
                  </div>
                  <h3 className="m-0 text-base text-neon-text">
                    No project selected
                  </h3>
                  <p className="text-neon-muted text-[0.92rem]">
                    Create a project to start the upload flow.
                  </p>
                </div>
              </section>
            )}

            {activeProject && (
              <KnowledgeSidebar
                activeTab={knowledgeTab}
                setActiveTab={setKnowledgeTab}
                documents={documents}
                selectedFileName={selectedFileName}
                urlValue={urlValue}
                setUrlValue={setUrlValue}
                onFilePicker={() => fileInputRef.current?.click()}
                onAddUrl={handleAddUrl}
                onDeleteDocument={(id) => void handleDeleteDocument(id)}
                onViewDocument={(id) => setSelectedDocumentId(id)}
                settings={settings}
                settingsDraft={settingsDraft}
                setSettingsDraft={setSettingsDraft}
                onSaveSettings={() => void handleSaveSettings()}
                isSavingSettings={isSavingSettings}
              />
            )}
          </div>
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleSelectedFile}
      />

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
