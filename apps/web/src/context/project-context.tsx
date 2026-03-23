"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  Chat,
  KnowledgeTab,
  Project,
  ProjectDocument,
  ProjectSettings,
  UploadUrlResponse,
} from "../types";
import { ACTIVE_STATUSES } from "../types";
import { apiFetch } from "../lib/api";
import { useProjectsContext } from "./projects-context";

type ProjectContextValue = {
  activeProjectId: string | null;
  activeProject: Project | null;
  documents: ProjectDocument[];
  chats: Chat[];
  settings: ProjectSettings | null;
  settingsDraft: ProjectSettings | null;
  setSettingsDraft: (s: ProjectSettings | null) => void;
  knowledgeTab: KnowledgeTab;
  setKnowledgeTab: (tab: KnowledgeTab) => void;
  urlValue: string;
  setUrlValue: (v: string) => void;
  selectedFileName: string;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
  isSavingSettings: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  loadProjectContext: (projectId: string) => Promise<void>;
  updateChatInList: (chatId: string, title: string) => void;
  handleNewChat: () => Promise<{ chatId: string } | null>;
  handleDeleteChat: (chatId: string) => Promise<void>;
  handleDeleteDocument: (documentId: string) => Promise<void>;
  handleSelectedFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddUrl: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleSaveSettings: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const activeProjectId =
    typeof params.projectId === "string" ? params.projectId : null;

  const { loadProjects, setStatusMessage, setErrorMessage, setIsBusy } =
    useProjectsContext();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ProjectSettings | null>(null);
  const [knowledgeTab, setKnowledgeTab] = useState<KnowledgeTab>("documents");
  const [urlValue, setUrlValue] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadProjectContext = useCallback(async (projectId: string) => {
    const [project, docs, chatList, cfg] = await Promise.all([
      apiFetch<Project>(`/projects/${projectId}`),
      apiFetch<ProjectDocument[]>(`/projects/${projectId}/files`),
      apiFetch<Chat[]>(`/projects/${projectId}/chats`),
      apiFetch<ProjectSettings>(`/projects/${projectId}/settings`),
    ]);
    setActiveProject(project);
    setDocuments(docs);
    setChats(chatList);
    setSettings(cfg);
    setSettingsDraft(cfg);
  }, []);

  // Load projects list on mount and validate the route project ID
  useEffect(() => {
    void (async () => {
      try {
        const list = await loadProjects();
        if (activeProjectId && !list.some((p) => p.id === activeProjectId)) {
          router.replace("/projects");
        }
        setStatusMessage("Dashboard ready.");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load projects.");
        setStatusMessage("Dashboard failed to load.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Load project data when URL project changes
  useEffect(() => {
    if (!activeProjectId) {
      setActiveProject(null);
      setDocuments([]);
      setChats([]);
      setSettings(null);
      setSettingsDraft(null);
      return;
    }
    void loadProjectContext(activeProjectId).catch((err) => {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load project context.");
    });
  }, [activeProjectId, loadProjectContext]);

  // Document status polling — auto-cleans when component unmounts or project changes
  useEffect(() => {
    if (!activeProjectId || !documents.some((d) => ACTIVE_STATUSES.has(d.processingStatus))) {
      return;
    }
    const id = window.setInterval(() => {
      void loadProjectContext(activeProjectId).catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Failed to refresh document statuses.");
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [activeProjectId, documents, loadProjectContext]);

  const updateChatInList = useCallback((chatId: string, title: string) => {
    setChats((current) =>
      current.map((c) => (c.id === chatId ? { ...c, title } : c)),
    );
  }, []);

  const handleNewChat = useCallback(async (): Promise<{ chatId: string } | null> => {
    if (!activeProjectId) return null;
    try {
      const chat = await apiFetch<Chat>(`/projects/${activeProjectId}/chats`, {
        method: "POST",
        body: JSON.stringify({ title: "New conversation" }),
      });
      await loadProjectContext(activeProjectId);
      setStatusMessage("Conversation created.");
      return { chatId: chat.id };
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create conversation.");
      return null;
    }
  }, [activeProjectId, loadProjectContext, setStatusMessage, setErrorMessage]);

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      try {
        await apiFetch<void>(`/chats/${chatId}`, { method: "DELETE" });
        if (activeProjectId) await loadProjectContext(activeProjectId);
        setStatusMessage("Conversation deleted.");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to delete conversation.");
      }
    },
    [activeProjectId, loadProjectContext, setStatusMessage, setErrorMessage],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
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
    },
    [activeProjectId, loadProjectContext, setStatusMessage, setErrorMessage],
  );

  const handleSelectedFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
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
    },
    [activeProjectId, loadProjectContext, setStatusMessage, setErrorMessage, setIsBusy],
  );

  const handleAddUrl = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [activeProjectId, urlValue, loadProjectContext, setStatusMessage, setErrorMessage, setIsBusy],
  );

  const handleSaveSettings = useCallback(async () => {
    if (!activeProjectId || !settingsDraft) return;
    try {
      setIsSavingSettings(true);
      const updated = await apiFetch<ProjectSettings>(
        `/projects/${activeProjectId}/settings`,
        {
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
        },
      );
      setSettings(updated);
      setSettingsDraft(updated);
      setStatusMessage("Settings updated.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }, [activeProjectId, settingsDraft, setStatusMessage, setErrorMessage]);

  return (
    <ProjectContext.Provider
      value={{
        activeProjectId,
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
        fileInputRef,
        loadProjectContext,
        updateChatInList,
        handleNewChat,
        handleDeleteChat,
        handleDeleteDocument,
        handleSelectedFile,
        handleAddUrl,
        handleSaveSettings,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
