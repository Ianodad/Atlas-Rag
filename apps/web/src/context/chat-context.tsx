"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import type { Chat, ChatDetail } from "../types";
import { apiFetch } from "../lib/api";
import { useProjectContext } from "./project-context";
import { useProjectsContext } from "./projects-context";

type ChatContextValue = {
  activeChatId: string | null;
  activeChat: ChatDetail | null;
  draftMessage: string;
  setDraftMessage: (msg: string) => void;
  isSendingMessage: boolean;
  streamingContent: string;
  streamingStatus: string;
  loadChat: (chatId: string) => Promise<void>;
  updateActiveChatTitle: (title: string) => void;
  handleSendMessage: () => Promise<void>;
  handleFeedback: (
    messageId: string,
    rating: "thumbs_up" | "thumbs_down",
  ) => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

function buildDraftChatTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 60) return normalized;
  return `${normalized.slice(0, 60).trimEnd()}…`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const activeChatId =
    typeof params.chatId === "string" ? params.chatId : null;

  const { activeProjectId, loadProjectContext, updateChatInList } =
    useProjectContext();
  const { setStatusMessage, setErrorMessage } = useProjectsContext();

  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");

  const loadChat = useCallback(async (chatId: string) => {
    const chat = await apiFetch<ChatDetail>(`/chats/${chatId}`);
    setActiveChat(chat);
  }, []);

  // Auto-load (or clear) active chat when URL chatId changes
  useEffect(() => {
    if (!activeChatId) {
      setActiveChat(null);
      setDraftMessage("");
      return;
    }
    void loadChat(activeChatId).catch((err) => {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load chat.");
    });
  }, [activeChatId, loadChat]);

  const updateActiveChatTitle = useCallback((title: string) => {
    setActiveChat((current) => (current ? { ...current, title } : current));
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!activeChatId || !draftMessage.trim()) return;
    const content = draftMessage.trim();
    const isFirstMessage = !activeChat?.messages?.length;
    const fallbackTitle = buildDraftChatTitle(content);

    setDraftMessage("");
    setIsSendingMessage(true);
    setStreamingContent("");
    setStreamingStatus("Thinking...");
    setErrorMessage(null);

    try {
      if (isFirstMessage) {
        updateActiveChatTitle(fallbackTitle);
        updateChatInList(activeChatId, fallbackTitle);
        void apiFetch<Chat>(`/chats/${activeChatId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: fallbackTitle }),
        }).catch(() => {});
      }

      const response = await fetch(`/api/chats/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content, citations: [], metadata: {} }),
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice("event:".length).trim();
          const data = JSON.parse(dataLine.slice("data:".length).trim());

          if (event === "status") {
            setStreamingStatus(String(data.status ?? ""));
          } else if (event === "token") {
            setStreamingContent((prev) => prev + String(data.content ?? ""));
          } else if (event === "error") {
            setErrorMessage(String(data.message ?? "Unknown error"));
          } else if (event === "done") {
            await loadChat(activeChatId);
            setStatusMessage("Answer complete.");
            if (isFirstMessage) {
              const semanticTitle =
                typeof data.title === "string" && data.title.trim()
                  ? data.title.trim()
                  : fallbackTitle;
              try {
                updateActiveChatTitle(semanticTitle);
                updateChatInList(activeChatId, semanticTitle);
                await apiFetch<Chat>(`/chats/${activeChatId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ title: semanticTitle }),
                });
                if (activeProjectId) await loadProjectContext(activeProjectId);
              } catch {
                // non-fatal
              }
            }
          }
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
      setStreamingContent("");
      setStreamingStatus("");
    }
  }, [
    activeChatId,
    activeChat,
    draftMessage,
    activeProjectId,
    loadProjectContext,
    loadChat,
    updateActiveChatTitle,
    updateChatInList,
    setStatusMessage,
    setErrorMessage,
  ]);

  const handleFeedback = useCallback(
    async (messageId: string, rating: "thumbs_up" | "thumbs_down") => {
      if (!activeChatId) return;
      const msg = activeChat?.messages.find((m) => m.id === messageId);
      if (msg?.feedback?.rating === rating) {
        await apiFetch<void>(
          `/chats/${activeChatId}/messages/${messageId}/feedback`,
          { method: "DELETE" },
        );
      } else {
        await apiFetch(`/chats/${activeChatId}/messages/${messageId}/feedback`, {
          method: "POST",
          body: JSON.stringify({ rating }),
        });
      }
      await loadChat(activeChatId);
    },
    [activeChatId, activeChat, loadChat],
  );

  return (
    <ChatContext.Provider
      value={{
        activeChatId,
        activeChat,
        draftMessage,
        setDraftMessage,
        isSendingMessage,
        streamingContent,
        streamingStatus,
        loadChat,
        updateActiveChatTitle,
        handleSendMessage,
        handleFeedback,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
