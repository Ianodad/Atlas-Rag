"use client";

import type { ReactNode } from "react";
import { useProjectsContext } from "../context/projects-context";
import { Sidebar } from "../components/sidebar";
import { ProjectModal } from "../components/project-modal";
import { Icon } from "../components/icons";

export function AppShell({ children }: { children: ReactNode }) {
  const {
    showProjectModal,
    setShowProjectModal,
    statusMessage,
    errorMessage,
    isBusy,
    handleCreateProject,
  } = useProjectsContext();

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex flex-col flex-1 min-w-0 p-4 gap-[14px]">
        {/* Status bar */}
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

        {/* Route content */}
        <div className="flex gap-4 min-h-0 flex-1">{children}</div>
      </main>

      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSubmit={handleCreateProject}
          isSubmitting={isBusy}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
