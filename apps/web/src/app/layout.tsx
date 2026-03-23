import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "./app-shell";

export const metadata = {
  title: "AtlasRAG",
  description: "Monorepo scaffold for the AtlasRAG multimodal RAG app"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-neon-accent selection:text-neon-bg bg-neon-bg">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
