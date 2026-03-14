"use client";

import { useEffect, useRef } from "react";
import type { ChatDetail, Citation } from "../types";
import { Icon } from "./icons";

function CitationPill({ citation, idx }: { citation: Citation; idx: number }) {
  return (
    <span
      key={idx}
      className="inline-flex items-center justify-center rounded-full text-[0.72rem] px-[10px] py-[6px] border border-[rgba(250,204,21,0.18)] bg-neon-highlight text-neon-accent uppercase"
    >
      {citation.filename || "Citation"}
      {citation.page ? ` p.${citation.page}` : ""}
    </span>
  );
}

export function ChatInterface(props: {
  chat: ChatDetail | null;
  draft: string;
  setDraft: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
  isSending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.chat?.messages.length]);

  return (
    <section className="flex-1 min-w-0 min-h-0 flex flex-col border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-neon-border">
        <button
          onClick={props.onBack}
          aria-label="Back to project"
          className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted hover:text-neon-text hover:bg-neon-elevated transition-[140ms]"
        >
          <Icon name="arrow-left" />
        </button>
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-purple">
          <Icon name="chat" />
        </div>
        <div className="flex flex-col min-w-0">
          <strong className="text-neon-text whitespace-nowrap overflow-hidden text-ellipsis">
            {props.chat?.title || "Conversation"}
          </strong>
          <span className="text-neon-muted text-[0.92rem]">
            Phase 6 dashboard shell. Assistant generation lands in a later phase.
          </span>
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-auto min-h-0 p-6">
        <div className="flex flex-col gap-4 max-w-[860px] mx-auto">
          {props.chat?.messages.length ? (
            props.chat.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-[18px] py-4 rounded-[20px] leading-[1.65] ${
                    message.role === "user"
                      ? "bg-neon-highlight-purple border border-[rgba(167,139,250,0.24)]"
                      : "bg-white/[0.02] border border-neon-border"
                  }`}
                >
                  <p className="m-0 text-neon-text">{message.content}</p>
                  {message.citations?.length ? (
                    <div className="flex gap-2 flex-wrap mt-3">
                      {message.citations.map((citation, idx) => (
                        <CitationPill key={`${message.id}-${idx}`} citation={citation} idx={idx} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="min-h-[220px] grid place-items-center text-center gap-3 p-7">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                <Icon name="chat" />
              </div>
              <h3 className="m-0 text-base text-neon-text">No messages yet</h3>
              <p className="text-neon-muted text-[0.92rem]">
                Save notes to this conversation now. Generated assistant answers come in a later
                phase.
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Compose */}
      <div className="flex items-end gap-3 px-5 py-[18px] border-t border-neon-border">
        <textarea
          value={props.draft}
          onChange={(e) => props.setDraft(e.target.value)}
          placeholder="Write a note for this conversation"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              props.onSend();
            }
          }}
          className="flex-1 min-h-[54px] max-h-[180px] px-4 py-[14px] rounded-[16px] border border-neon-border bg-white/[0.03] text-neon-text placeholder:text-neon-disabled resize-y outline-none"
        />
        <button
          onClick={props.onSend}
          disabled={!props.draft.trim() || props.isSending}
          className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-neon-accent text-neon-bg border-0 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {props.isSending ? <Icon name="loader" /> : <Icon name="send" />}
        </button>
      </div>
    </section>
  );
}
