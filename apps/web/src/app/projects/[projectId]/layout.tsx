import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { serverFetch } from "../../../lib/server-api";
import { ProjectLayoutClient } from "./project-layout-client";
import type { Chat, Project, ProjectDocument, ProjectSettings } from "../../../types";

export default async function ProjectIdLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [project, documents, chats, settings] = await Promise.all([
      serverFetch<Project>(`/projects/${projectId}`),
      serverFetch<ProjectDocument[]>(`/projects/${projectId}/files`),
      serverFetch<Chat[]>(`/projects/${projectId}/chats`),
      serverFetch<ProjectSettings>(`/projects/${projectId}/settings`),
    ]);

    return (
      <ProjectLayoutClient initialData={{ project, documents, chats, settings }}>
        {children}
      </ProjectLayoutClient>
    );
  } catch {
    notFound();
  }
}
