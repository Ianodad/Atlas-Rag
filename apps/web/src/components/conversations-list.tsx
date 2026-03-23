"use client";

import { useProjectsContext } from "../context/projects-context";
import { useProjectContext } from "../context/project-context";
import { useChatContext } from "../context/chat-context";
import { formatTimestamp } from "../lib/utils";
import { Icon } from "./icons";

export function ConversationsList() {
  const { handleDeleteProject } = useProjectsContext();
  const { activeProject, chats, setView, handleNewChat, handleDeleteChat } =
    useProjectContext();
  const { activeChatId, setActiveChatId, setActiveChat } = useChatContext();

  if (!activeProject) return null;

  async function onNewChat() {
    const result = await handleNewChat();
    if (result) {
      setActiveChatId(result.chatId);
      setView("chat");
    }
  }

  async function onDeleteChat(chatId: string) {
    const result = await handleDeleteChat(chatId, activeChatId);
    if (result.clearedChat) {
      setActiveChatId(null);
      setActiveChat(null);
      setView("detail");
    }
  }

  return (
    <section className="flex-1 min-w-0 overflow-auto border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-[26px] p-7">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
              Project
            </p>
            <h1 className="text-[1.8rem] font-bold tracking-[-0.03em] my-[6px] mb-[10px] text-neon-text">
              {activeProject.name}
            </h1>
            <p className="text-neon-muted text-[0.92rem] max-w-[720px] leading-relaxed m-0">
              {activeProject.description || "No description yet."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void handleDeleteProject(activeProject.id)}
              className="inline-flex items-center gap-2 px-[14px] py-3 rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[#fca5a5] hover:bg-[rgba(239,68,68,0.12)] transition-[140ms]"
            >
              <Icon name="trash" />
              <span>Delete project</span>
            </button>
            <button
              onClick={() => void onNewChat()}
              className="inline-flex items-center gap-2 px-[14px] py-3 rounded-[14px] font-bold bg-neon-accent text-neon-bg shadow-[0_0_18px_rgba(250,204,21,0.18)] hover:bg-neon-accent-hover transition-[140ms] shrink-0"
            >
              <Icon name="plus" />
              <span>New conversation</span>
            </button>
          </div>
        </div>

        {/* Conversations heading */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-base font-semibold text-neon-text">
            Conversations
          </h2>
          <span className="inline-flex items-center justify-center rounded-full text-[0.72rem] px-[10px] py-[6px] border border-[rgba(250,204,21,0.18)] bg-neon-highlight text-neon-accent uppercase">
            {chats.length}
          </span>
        </div>

        {/* List or empty state */}
        {chats.length === 0 ? (
          <div className="min-h-[320px] grid place-items-center text-center gap-3 p-7">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
              <Icon name="chat" />
            </div>
            <h3 className="m-0 text-base text-neon-text">No conversations yet</h3>
            <p className="text-neon-muted text-[0.92rem]">
              Create a conversation to capture project questions and saved notes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="group flex items-center justify-between gap-3 px-4 py-[14px] rounded-[18px] border border-neon-border bg-white/[0.02]"
              >
                <button
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setView("chat");
                  }}
                  className="flex items-center gap-[14px] flex-1 min-w-0 bg-transparent border-0 text-inherit text-left"
                >
                  <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                    <Icon name="chat" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <strong className="text-neon-text whitespace-nowrap overflow-hidden text-ellipsis">
                      {chat.title}
                    </strong>
                    <span className="text-neon-muted text-[0.92rem]">
                      {formatTimestamp(chat.createdAt)}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => void onDeleteChat(chat.id)}
                  aria-label="Delete chat"
                  className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted opacity-0 group-hover:opacity-100 hover:text-neon-error hover:border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.08)] transition-[140ms]"
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
