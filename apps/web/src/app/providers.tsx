"use client";

import type { ReactNode } from "react";
import { ProjectsProvider } from "../context/projects-context";
import { ProjectProvider } from "../context/project-context";
import { ChatProvider } from "../context/chat-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ProjectsProvider>
      <ProjectProvider>
        <ChatProvider>{children}</ChatProvider>
      </ProjectProvider>
    </ProjectsProvider>
  );
}
