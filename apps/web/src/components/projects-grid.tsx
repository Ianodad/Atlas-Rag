"use client";

import { useRouter } from "next/navigation";
import { useProjectsContext } from "../context/projects-context";
import { useProjectContext } from "../context/project-context";
import { Icon } from "./icons";

export function ProjectsGrid() {
  const router = useRouter();
  const {
    filteredProjects,
    searchQuery,
    setSearchQuery,
    setShowProjectModal,
    handleDeleteProject,
  } = useProjectsContext();
  const { setActiveProjectId, setView } = useProjectContext();

  return (
    <section className="flex-1 min-w-0 overflow-auto border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-[26px] p-7">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
              Workspace
            </p>
            <h1 className="text-[1.8rem] font-bold tracking-[-0.03em] my-[6px] mb-[10px] text-neon-text">
              Projects
            </h1>
            <p className="text-neon-muted text-[0.92rem] max-w-[720px] leading-relaxed m-0">
              {filteredProjects.length} active projects across ingestion and chat workflows.
            </p>
          </div>
          <button
            onClick={() => setShowProjectModal(true)}
            className="inline-flex items-center gap-2 px-[14px] py-3 rounded-[14px] font-bold bg-neon-accent text-neon-bg shadow-[0_0_18px_rgba(250,204,21,0.18)] hover:bg-neon-accent-hover transition-[140ms] shrink-0"
          >
            <Icon name="plus" />
            <span>New Project</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-[14px] rounded-[18px] border border-neon-border bg-white/[0.03]">
          <span className="inline-flex items-center text-neon-muted">
            <Icon name="search" />
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects"
            className="flex-1 bg-transparent border-0 outline-none text-neon-text placeholder:text-neon-disabled"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col items-start gap-4 p-[22px] rounded-[22px] border border-neon-border bg-white/[0.02] text-left text-neon-text hover:border-[rgba(250,204,21,0.35)] hover:bg-[rgba(250,204,21,0.05)] transition-[140ms]"
            >
              <div className="flex items-start justify-between w-full gap-3">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                  <Icon name="briefcase" />
                </div>
                <button
                  onClick={() => void handleDeleteProject(project.id)}
                  aria-label={`Delete ${project.name}`}
                  className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted hover:text-neon-error hover:border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.08)] transition-[140ms]"
                >
                  <Icon name="trash" />
                </button>
              </div>
              <button
                onClick={() => {
                  setActiveProjectId(project.id);
                  setView("detail");
                  router.push(`/projects/${project.id}`);
                }}
                className="flex flex-col items-start gap-4 p-0 bg-transparent border-0 text-left text-inherit w-full"
              >
                <strong className="text-[1.02rem]">{project.name}</strong>
                <p className="m-0 text-neon-muted text-sm leading-[1.55]">
                  {project.description || "No description yet."}
                </p>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
