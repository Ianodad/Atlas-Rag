import { notFound } from "next/navigation";
import { serverFetch } from "../../../../../lib/server-api";
import { ChatPageClient } from "./chat-page-client";
import type { ChatDetail } from "../../../../../types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  try {
    const initialChat = await serverFetch<ChatDetail>(`/chats/${chatId}`);
    return <ChatPageClient key={chatId} initialChat={initialChat} />;
  } catch {
    notFound();
  }
}
