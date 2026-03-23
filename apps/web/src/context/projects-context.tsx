"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "../types";
import { apiFetch } from "../lib/api";

type ProjectsContextValue = {
  projects: Project[];
  filteredProjects: Project[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showProjectModal: boolean;
  setShowProjectModal: (show: boolean) => void;
  statusMessage: string;
  setStatusMessage: (msg: string) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  isBusy: boolean;
  setIsBusy: (busy: boolean) => void;
  loadProjects: () => Promise<Project[]>;
  handleCreateProject: (name: string, description: string) => Promise<void>;
  handleDeleteProject: (projectId: string) => Promise<void>;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function useProjectsContext() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjectsContext must be used within ProjectsProvider");
  return ctx;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading dashboard...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    const next = await apiFetch<Project[]>("/projects");
    setProjects(next);
    return next;
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, description: string) => {
      try {
        setErrorMessage(null);
        setIsBusy(true);
        const project = await apiFetch<Project>("/projects", {
          method: "POST",
          body: JSON.stringify({ name, description: description || null }),
        });
        setProjects((current) => [...current, project]);
        setShowProjectModal(false);
        setStatusMessage(`Created "${project.name}".`);
        router.push(`/projects/${project.id}`);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to create project.");
      } finally {
        setIsBusy(false);
      }
    },
    [router],
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      const label = project?.name ?? "this project";
      if (!window.confirm(`Delete ${label}? This removes its chats and indexed sources.`)) return;
      try {
        await apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" });
        setProjects((current) => current.filter((p) => p.id !== projectId));
        setStatusMessage(`Deleted "${label}".`);
        router.push("/projects");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to delete project.");
      }
    },
    [projects, router],
  );

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        filteredProjects,
        searchQuery,
        setSearchQuery,
        showProjectModal,
        setShowProjectModal,
        statusMessage,
        setStatusMessage,
        errorMessage,
        setErrorMessage,
        isBusy,
        setIsBusy,
        loadProjects,
        handleCreateProject,
        handleDeleteProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
