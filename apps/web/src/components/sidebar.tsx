"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectsContext } from "../context/projects-context";
import { useProjectContext } from "../context/project-context";
import { Icon } from "./icons";

export function Sidebar() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const { projects, setShowProjectModal } = useProjectsContext();
  const { activeProjectId } = useProjectContext();

  return (
    <aside
      className={`flex flex-col shrink-0 border-r border-neon-border bg-[rgba(8,12,20,0.94)] backdrop-blur-xl py-[18px] px-[14px] transition-all duration-[160ms] ease-out ${
        collapsed ? "w-[76px]" : "w-[264px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        {!collapsed && (
          <span className="text-neon-text font-bold text-base">OpenSlate</span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
          className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted hover:text-neon-text hover:bg-neon-elevated transition-[140ms]"
        >
          <Icon name={collapsed ? "panel-open" : "panel-close"} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setShowProjectModal(true)}
          className="inline-flex items-center justify-center gap-2 px-[14px] py-3 rounded-[14px] font-bold bg-neon-accent text-neon-bg shadow-[0_0_18px_rgba(250,204,21,0.18)] hover:bg-neon-accent-hover transition-[140ms] w-full"
        >
          <Icon name="plus" />
          {!collapsed && <span>New project</span>}
        </button>

        {!collapsed && (
          <button
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-2 px-[14px] py-3 rounded-[14px] border border-neon-border bg-white/[0.03] text-neon-text font-bold hover:bg-neon-elevated transition-[140ms]"
          >
            <Icon name="briefcase" />
            <span>All projects</span>
          </button>
        )}
      </div>

      {/* Project list */}
      {!collapsed && (
        <div className="mt-[18px] overflow-auto flex-1">
          <div className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold mb-[10px]">
            Projects
          </div>
          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className={`inline-flex items-center gap-2 px-[14px] py-3 rounded-[14px] border w-full text-left transition-[140ms] ${
                  activeProjectId === project.id
                    ? "text-neon-text bg-white/[0.03] border-[rgba(167,139,250,0.3)]"
                    : "text-neon-muted bg-transparent border-transparent hover:text-neon-text hover:bg-white/[0.03] hover:border-[rgba(167,139,250,0.3)]"
                }`}
              >
                <span className="shrink-0">
                  <Icon name="briefcase" />
                </span>
                <span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="mt-auto pt-4 border-t border-neon-border flex items-center gap-3">
        <div className="w-[38px] h-[38px] rounded-full grid place-items-center bg-gradient-to-br from-neon-accent to-neon-purple text-neon-bg font-black text-sm shrink-0">
          JD
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <strong className="text-neon-text text-sm truncate">Demo User</strong>
            <span className="text-neon-muted text-[0.85rem] truncate">
              demo@atlasrag.local
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
