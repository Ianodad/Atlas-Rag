"use client";

import { ChatProvider } from "../../../../../context/chat-context";
import { ChatInterface } from "../../../../../components/chat-interface";
import type { ChatDetail } from "../../../../../types";

export function ChatPageClient({ initialChat }: { initialChat: ChatDetail }) {
  return (
    <ChatProvider initialChat={initialChat}>
      <ChatInterface />
    </ChatProvider>
  );
}
