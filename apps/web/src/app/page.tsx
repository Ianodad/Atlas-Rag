"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type {
  Chat,
  ChatDetail,
  Project,
  ProjectDocument,
  ProjectSettings,
  UploadUrlResponse,
  View,
  KnowledgeTab,
} from "../types";
import { ACTIVE_STATUSES } from "../types";
import { apiFetch } from "../lib/api";
import { Sidebar } from "../components/sidebar";
import { ProjectsGrid } from "../components/projects-grid";
import { ConversationsList } from "../components/conversations-list";
import { ChatInterface } from "../components/chat-interface";
import { KnowledgeSidebar } from "../components/knowledge-sidebar";
import { ProjectModal } from "../components/project-modal";
import { DocumentModal } from "../components/document-modal";
import { Icon } from "../components/icons";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<View>("projects");
  const [knowledgeTab, setKnowledgeTab] = useState<KnowledgeTab>("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [projectDetail, setProjectDetail] = useState<Project | null>(null);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ProjectSettings | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("Loading dashboard...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const routeProjectId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "projects" && parts[1]) {
      return decodeURIComponent(parts[1]);
    }
    return null;
  }, [pathname]);

  const activeProject = projectDetail ?? projects.find((project) => project.id === activeProjectId) ?? null;

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) ||
        (project.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  async function loadProjects() {
    const next = await apiFetch<Project[]>("/projects");
    setProjects(next);

    if (routeProjectId && next.some((project) => project.id === routeProjectId)) {
      setActiveProjectId(routeProjectId);
      return;
    }

    if (routeProjectId && !next.some((project) => project.id === routeProjectId)) {
      setActiveProjectId(null);
      setProjectDetail(null);
      setActiveChatId(null);
      setActiveChat(null);
      setView("projects");
      router.replace("/projects");
      return;
    }

    if (activeProjectId && !next.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(null);
      setProjectDetail(null);
      setActiveChatId(null);
      setActiveChat(null);
    }
  }

  async function loadProjectContext(projectId: string) {
    const [project, docs, chatList, cfg] = await Promise.all([
      apiFetch<Project>(`/projects/${projectId}`),
      apiFetch<ProjectDocument[]>(`/projects/${projectId}/files`),
      apiFetch<Chat[]>(`/projects/${projectId}/chats`),
      apiFetch<ProjectSettings>(`/projects/${projectId}/settings`),
    ]);
    setProjectDetail(project);
    setDocuments(docs);
    setChats(chatList);
    setSettings(cfg);
    setSettingsDraft(cfg);
  }

  async function loadChat(chatId: string) {
    const chat = await apiFetch<ChatDetail>(`/chats/${chatId}`);
    setActiveChat(chat);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadProjects();
        setStatusMessage("Dashboard ready.");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load projects.");
        setStatusMessage("Dashboard failed to load.");
      }
    })();
  }, [routeProjectId]);

  useEffect(() => {
    if (routeProjectId) {
      setActiveProjectId(routeProjectId);
      setView("detail");
      return;
    }

    setActiveProjectId(null);
    setProjectDetail(null);
    setActiveChatId(null);
    setActiveChat(null);
    setView("projects");
  }, [routeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setProjectDetail(null);
      setDocuments([]);
      setChats([]);
      setSettings(null);
      setSettingsDraft(null);
      return;
    }

    void (async () => {
      try {
        setErrorMessage(null);
        await loadProjectContext(activeProjectId);
        setStatusMessage("Project context refreshed.");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load project context.");
      }
    })();
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeChatId) {
      setActiveChat(null);
      return;
    }

    void (async () => {
      try {
        await loadChat(activeChatId);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load chat.");
      }
    })();
  }, [activeChatId]);

  useEffect(() => {
    if (!activeProjectId || !documents.some((document) => ACTIVE_STATUSES.has(document.processingStatus))) {
      return;
    }

    const id = window.setInterval(() => {
      void loadProjectContext(activeProjectId).catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Failed to refresh document statuses.");
      });
    }, 5000);

    return () => window.clearInterval(id);
  }, [activeProjectId, documents]);

  async function handleCreateProject(name: string, description: string) {
    try {
      setErrorMessage(null);
      setIsBusy(true);
      const project = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      });
      setProjects((current) => [...current, project]);
      setActiveProjectId(project.id);
      setProjectDetail(project);
      setDocuments([]);
      setChats([]);
      setSettings(null);
      setSettingsDraft(null);
      setActiveChatId(null);
      setActiveChat(null);
      setView("detail");
      setShowProjectModal(false);
      setStatusMessage(`Created "${project.name}".`);
      router.push(`/projects/${project.id}`);
      void loadProjects().catch(() => {});
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleNewChat() {
    if (!activeProjectId) return;
    try {
      const chat = await apiFetch<Chat>(`/projects/${activeProjectId}/chats`, {
        method: "POST",
        body: JSON.stringify({ title: `Conversation ${chats.length + 1}` }),
      });
      await loadProjectContext(activeProjectId);
      setActiveChatId(chat.id);
      setView("chat");
      setStatusMessage("Conversation created.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create conversation.");
    }
  }

  async function handleDeleteChat(chatId: string) {
    try {
      await apiFetch<void>(`/chats/${chatId}`, { method: "DELETE" });
      if (activeProjectId) await loadProjectContext(activeProjectId);
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setActiveChat(null);
        setView("detail");
      }
      setStatusMessage("Conversation deleted.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete conversation.");
    }
  }

  async function handleDeleteProject(projectId: string) {
    const project = projects.find((entry) => entry.id === projectId) ?? activeProject;
    const label = project?.name ?? "this project";

    if (!window.confirm(`Delete ${label}? This removes its chats and indexed sources.`)) {
      return;
    }

    try {
      await apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" });
      setProjects((current) => current.filter((entry) => entry.id !== projectId));

      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        setProjectDetail(null);
        setActiveChatId(null);
        setActiveChat(null);
        setDocuments([]);
        setChats([]);
        setSettings(null);
        setSettingsDraft(null);
        setView("projects");
        router.push("/projects");
      }

      setStatusMessage(`Deleted "${label}".`);
      void loadProjects().catch(() => {});
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete project.");
    }
  }

  async function handleSendMessage() {
    if (!activeChatId || !draftMessage.trim()) return;
    const content = draftMessage.trim();
    setDraftMessage("");
    setIsSendingMessage(true);
    setStreamingContent("");
    setStreamingStatus("Thinking...");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/chats/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content, citations: [], metadata: {} }),
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice("event:".length).trim();
          const data = JSON.parse(dataLine.slice("data:".length).trim());

          if (event === "status") {
            setStreamingStatus(String(data.status ?? ""));
          } else if (event === "token") {
            setStreamingContent((prev) => prev + String(data.content ?? ""));
          } else if (event === "error") {
            setErrorMessage(String(data.message ?? "Unknown error"));
          } else if (event === "done") {
            await loadChat(activeChatId);
            setStatusMessage("Answer complete.");
            // Auto-rename on first message
            const isFirstMessage = !activeChat?.messages?.length;
            if (isFirstMessage) {
              const title = content.length > 50 ? content.slice(0, 50).trimEnd() + "…" : content;
              try {
                await apiFetch<Chat>(`/chats/${activeChatId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ title }),
                });
                if (activeProjectId) await loadProjectContext(activeProjectId);
              } catch {
                // non-fatal, title stays as default
              }
            }
          }
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
      setStreamingContent("");
      setStreamingStatus("");
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!activeProjectId) return;
    try {
      await apiFetch<void>(`/projects/${activeProjectId}/files/${documentId}`, {
        method: "DELETE",
      });
      await loadProjectContext(activeProjectId);
      setStatusMessage("Document deleted.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete document.");
    }
  }

  async function handleSelectedFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!activeProjectId || !file) return;

    setSelectedFileName(file.name);
    setErrorMessage(null);

    try {
      setIsBusy(true);
      const upload = await apiFetch<UploadUrlResponse>(
        `/projects/${activeProjectId}/files/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
          }),
        },
      );

      const storageResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!storageResponse.ok) {
        throw new Error(`Storage upload failed with status ${storageResponse.status}`);
      }

      await apiFetch<ProjectDocument>(`/projects/${activeProjectId}/files/confirm`, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || null,
          storageBucket: upload.storageBucket,
          storagePath: upload.storagePath,
          sizeBytes: file.size,
          metadata: { lastModified: file.lastModified },
        }),
      });

      await loadProjectContext(activeProjectId);
      setStatusMessage(`Queued "${file.name}" for ingestion.`);
      setSelectedFileName("");
      event.target.value = "";
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId || !urlValue.trim()) return;
    try {
      setIsBusy(true);
      await apiFetch<ProjectDocument>(`/projects/${activeProjectId}/urls`, {
        method: "POST",
        body: JSON.stringify({ url: urlValue.trim(), title: null }),
      });
      setUrlValue("");
      await loadProjectContext(activeProjectId);
      setStatusMessage("Website queued for ingestion.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to add website.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveSettings() {
    if (!activeProjectId || !settingsDraft) return;
    try {
      setIsSavingSettings(true);
      const updated = await apiFetch<ProjectSettings>(`/projects/${activeProjectId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          retrievalStrategy: settingsDraft.retrievalStrategy,
          chunksPerSearch: settingsDraft.chunksPerSearch,
          finalContextSize: settingsDraft.finalContextSize,
          similarityThreshold: settingsDraft.similarityThreshold,
          queryVariationCount: settingsDraft.queryVariationCount,
          vectorWeight: settingsDraft.vectorWeight,
          keywordWeight: settingsDraft.keywordWeight,
        }),
      });
      setSettings(updated);
      setSettingsDraft(updated);
      setStatusMessage("Settings updated.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          projects={projects}
          activeProjectId={activeProjectId}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onProject={(id) => {
            setActiveProjectId(id);
            setActiveChatId(null);
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
              <strong className="block text-[0.98rem] text-neon-text">AtlasRAG Dashboard</strong>
              <span className="text-neon-muted text-[0.92rem]">{statusMessage}</span>
            </div>
            <div className="flex items-center gap-3">
              {errorMessage && <span className="text-[#fca5a5] text-sm">{errorMessage}</span>}
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
                  onNewChat={() => void handleNewChat()}
                  onChat={(id) => {
                    setActiveChatId(id);
                    setView("chat");
                  }}
                  onDeleteChat={(id) => void handleDeleteChat(id)}
                  onDeleteProject={() => void handleDeleteProject(activeProject.id)}
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
                />
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

      <input ref={fileInputRef} type="file" hidden onChange={handleSelectedFile} />

      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSubmit={handleCreateProject}
          isSubmitting={isBusy}
          errorMessage={errorMessage}
        />
      )}

      {selectedDocumentId && (() => {
        const selectedDocument = documents.find((d) => d.id === selectedDocumentId) ?? null;
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
