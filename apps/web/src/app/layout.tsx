import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "AtlasRAG",
  description: "Monorepo scaffold for the AtlasRAG multimodal RAG app"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-neon-accent selection:text-neon-bg bg-neon-bg">
        {children}
      </body>
    </html>
  );
}
