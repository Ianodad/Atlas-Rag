import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "./app-shell";
import { serverFetch } from "../lib/server-api";
import type { Project } from "../types";

export const metadata = {
  title: "AtlasRAG",
  description: "Monorepo scaffold for the AtlasRAG multimodal RAG app",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialProjects = await serverFetch<Project[]>("/projects").catch(
    () => [] as Project[],
  );

  return (
    <html lang="en">
      <body className="antialiased selection:bg-neon-accent selection:text-neon-bg bg-neon-bg">
        <Providers initialProjects={initialProjects}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
