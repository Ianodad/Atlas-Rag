import type { ReactNode } from "react";

export const metadata = {
  title: "AtlasRAG",
  description: "Monorepo scaffold for the AtlasRAG multimodal RAG app"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
