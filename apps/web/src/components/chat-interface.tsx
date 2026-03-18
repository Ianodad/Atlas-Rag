"use client";

import { useEffect, useRef } from "react";
import type { ChatDetail, Citation } from "../types";
import { Icon } from "./icons";

function CitationPill({ citation, idx }: { citation: Citation; idx: number }) {
  let label = citation.filename;
  if (!label && citation.source_url) {
    try { label = new URL(citation.source_url).hostname; } catch { label = citation.source_url.slice(0, 40); }
  }
  if (!label) label = `Source ${idx + 1}`;
  const page = citation.page ? ` p.${citation.page}` : "";
  const inner = (
    <span className="inline-flex items-center gap-[5px] rounded-full text-[0.72rem] px-[10px] py-[5px] border border-[rgba(250,204,21,0.18)] bg-neon-highlight text-neon-accent">
      <Icon name="file-text" />
      <span className="truncate max-w-[160px]">{label}{page}</span>
    </span>
  );
  if (citation.source_type === "url" && citation.source_url) {
    return (
      <a href={citation.source_url} target="_blank" rel="noopener noreferrer" title={citation.source_url}>
        {inner}
      </a>
    );
  }
  return inner;
}

function StreamingBubble({ content, status }: { content: string; status: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] px-[18px] py-4 rounded-[20px] leading-[1.65] bg-white/[0.02] border border-neon-border">
        {content ? (
          <p className="m-0 text-neon-text whitespace-pre-wrap">{content}<span className="inline-block w-[2px] h-[1em] ml-[2px] bg-neon-accent animate-pulse align-middle" /></p>
        ) : (
          <p className="m-0 text-neon-muted text-sm italic flex items-center gap-2">
            <Icon name="loader" />
            {status || "Thinking..."}
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatInterface(props: {
  chat: ChatDetail | null;
  draft: string;
  setDraft: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
  isSending: boolean;
  streamingContent: string;
  streamingStatus: string;
  onFeedback: (messageId: string, rating: "thumbs_up" | "thumbs_down") => void;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.chat?.messages.length, props.streamingContent]);

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
            {props.isSending ? props.streamingStatus || "Generating..." : "Ask anything about your documents"}
          </span>
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-auto min-h-0 p-6">
        <div className="flex flex-col gap-4 max-w-[860px] mx-auto">
          {props.chat?.messages.length || props.isSending ? (
            <>
              {props.chat?.messages.map((message) => (
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
                    <p className="m-0 text-neon-text whitespace-pre-wrap">{message.content}</p>
                    {message.citations?.length ? (
                      <div className="flex gap-2 flex-wrap mt-3">
                        {message.citations.map((citation, idx) => (
                          <CitationPill key={`${message.id}-${idx}`} citation={citation} idx={idx} />
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-neon-border/40">
                        <button
                          onClick={() => props.onFeedback(message.id, "thumbs_up")}
                          title="Helpful"
                          className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border transition-[140ms] ${
                            message.feedback?.rating === "thumbs_up"
                              ? "border-neon-accent text-neon-accent bg-neon-highlight"
                              : "border-neon-border text-neon-muted hover:text-neon-accent hover:bg-neon-elevated"
                          }`}
                        >
                          <Icon name="thumb-up" />
                        </button>
                        <button
                          onClick={() => props.onFeedback(message.id, "thumbs_down")}
                          title="Unhelpful"
                          className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border transition-[140ms] ${
                            message.feedback?.rating === "thumbs_down"
                              ? "border-neon-error text-neon-error bg-[rgba(239,68,68,0.08)]"
                              : "border-neon-border text-neon-muted hover:text-neon-error hover:bg-neon-elevated"
                          }`}
                        >
                          <Icon name="thumb-down" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {props.isSending && (
                <StreamingBubble
                  content={props.streamingContent}
                  status={props.streamingStatus}
                />
              )}
            </>
          ) : (
            <div className="min-h-[220px] grid place-items-center text-center gap-3 p-7">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                <Icon name="chat" />
              </div>
              <h3 className="m-0 text-base text-neon-text">No messages yet</h3>
              <p className="text-neon-muted text-[0.92rem]">
                Ask a question and AtlasRAG will search your documents to answer it.
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
          placeholder="Ask a question about your documents..."
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
