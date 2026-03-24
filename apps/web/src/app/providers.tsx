"use client";

import type { ReactNode } from "react";
import { ProjectsProvider } from "../context/projects-context";
import type { Project } from "../types";

export function Providers({
  children,
  initialProjects,
}: {
  children: ReactNode;
  initialProjects?: Project[];
}) {
  return (
    <ProjectsProvider initialProjects={initialProjects}>
      {children}
    </ProjectsProvider>
  );
}
