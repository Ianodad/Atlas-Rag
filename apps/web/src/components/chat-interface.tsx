"use client";

import { useEffect, useRef, useState } from "react";
import type { Citation } from "../types";
import { apiFetch } from "../lib/api";
import { useRouter } from "next/navigation";
import { useProjectContext } from "../context/project-context";
import { useChatContext } from "../context/chat-context";
import { Icon } from "./icons";

type ChunkImage = { index: number; page_number: number | null; image_base64: string };

function ChunkImages({ chunkId }: { chunkId: string }) {
  const [images, setImages] = useState<ChunkImage[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ images: ChunkImage[] }>(`/chunks/${chunkId}/images`)
      .then((data) => setImages(data.images))
      .catch(() => {});
  }, [chunkId]);

  if (!images.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {images.map((img) => {
        const src = `data:image/jpeg;base64,${img.image_base64}`;
        const key = `${chunkId}-${img.index}`;
        return (
          <button
            key={key}
            onClick={() => setExpanded(expanded === key ? null : key)}
            className="block rounded-lg border border-neon-border overflow-hidden hover:border-neon-accent transition-[140ms] focus:outline-none"
            title={img.page_number ? `Page ${img.page_number}` : "Document image"}
          >
            <img
              src={src}
              alt={img.page_number ? `Page ${img.page_number}` : "Document image"}
              className={`block object-contain transition-all duration-200 ${expanded === key ? "max-h-[480px] max-w-full" : "max-h-[120px] max-w-[180px]"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

type CitationGroup = {
  key: string;
  label: string;
  isUrl: boolean;
  sourceUrl?: string;
  citations: Citation[];
};

function groupCitations(citations: Citation[]): CitationGroup[] {
  const map = new Map<string, CitationGroup>();
  for (const c of citations) {
    let key: string;
    let label: string;
    let isUrl = false;
    let sourceUrl: string | undefined;

    if (c.source_type === "url" && c.source_url) {
      key = c.source_url;
      try { label = new URL(c.source_url).hostname; } catch { label = c.source_url.slice(0, 40); }
      isUrl = true;
      sourceUrl = c.source_url;
    } else {
      key = c.filename || c.document_id || "unknown";
      label = c.filename || "Unknown source";
    }

    if (!map.has(key)) {
      map.set(key, { key, label, isUrl, sourceUrl, citations: [] });
    }
    map.get(key)!.citations.push(c);
  }
  return Array.from(map.values());
}

function CitationModal({ group, onClose }: { group: CitationGroup; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl max-h-[80vh] flex flex-col rounded-[20px] bg-neon-surface border border-neon-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neon-border shrink-0">
          <div className="text-neon-accent shrink-0"><Icon name="file-text" /></div>
          <span className="text-neon-text font-semibold truncate flex-1">{group.label}</span>
          <span className="text-[0.72rem] text-neon-muted mr-2 shrink-0">
            {group.citations.length} citation{group.citations.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-neon-border text-neon-muted hover:text-neon-text hover:bg-neon-elevated transition-[140ms] shrink-0"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-5 flex flex-col">
          {group.citations.map((c, i) => (
            <div key={i}>
              {i > 0 && <div className="border-t border-neon-border/40 my-4" />}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[0.65rem] font-semibold text-neon-muted uppercase tracking-wider">
                  Citation {i + 1}
                </span>
                {c.page && (
                  <span className="text-[0.65rem] px-[6px] py-[2px] rounded-full bg-neon-highlight border border-[rgba(250,204,21,0.18)] text-neon-accent">
                    p.&nbsp;{c.page}
                  </span>
                )}
              </div>
              {c.snippet && (
                <p className="m-0 text-sm text-neon-text/80 leading-relaxed bg-white/[0.02] rounded-lg px-3 py-[10px] border border-neon-border/50">
                  {c.snippet}
                </p>
              )}
              {c.has_images && c.chunk_id && (
                <div className="mt-3">
                  <p className="m-0 text-[0.65rem] text-neon-muted uppercase tracking-wider mb-2">
                    Images from this citation
                  </p>
                  <ChunkImages chunkId={c.chunk_id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CitationFilePill({ group }: { group: CitationGroup }) {
  const [hovered, setHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const firstSnippet = group.citations.find((c) => c.snippet)?.snippet;
  const count = group.citations.length;

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-[5px] rounded-full text-[0.72rem] px-[10px] py-[5px] border border-[rgba(250,204,21,0.18)] bg-neon-highlight text-neon-accent hover:border-neon-accent/50 hover:bg-neon-elevated transition-[140ms]"
      >
        <Icon name="file-text" />
        <span className="truncate max-w-[160px]">{group.label}</span>
        {count > 1 && (
          <span className="flex items-center justify-center w-[16px] h-[16px] rounded-full bg-neon-accent/20 text-[0.6rem] font-bold leading-none">
            {count}
          </span>
        )}
      </button>

      {hovered && firstSnippet && (
        <div className="absolute bottom-full left-0 mb-2 z-20 w-64 p-3 rounded-xl bg-neon-elevated border border-neon-border shadow-xl pointer-events-none">
          <p className="m-0 text-[0.72rem] text-neon-text/80 leading-relaxed line-clamp-4">
            {firstSnippet}
          </p>
        </div>
      )}

      {modalOpen && <CitationModal group={group} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function StreamingBubble({
  content,
  status,
}: {
  content: string;
  status: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] px-[18px] py-4 rounded-[20px] leading-[1.65] bg-white/[0.02] border border-neon-border">
        {content ? (
          <p className="m-0 text-neon-text whitespace-pre-wrap">
            {content}
            <span className="inline-block w-[2px] h-[1em] ml-[2px] bg-neon-accent animate-pulse align-middle" />
          </p>
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

export function ChatInterface() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { activeProjectId } = useProjectContext();
  const {
    activeChat,
    draftMessage,
    setDraftMessage,
    isSendingMessage,
    streamingContent,
    streamingStatus,
    handleSendMessage,
    handleFeedback,
  } = useChatContext();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, streamingContent]);

  return (
    <section className="flex-1 min-w-0 min-h-0 flex flex-col border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-neon-border">
        <button
          onClick={() => activeProjectId && router.push(`/projects/${activeProjectId}`)}
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
            {activeChat?.title || "Conversation"}
          </strong>
          <span className="text-neon-muted text-[0.92rem]">
            {isSendingMessage
              ? streamingStatus || "Generating..."
              : "Ask anything about your documents"}
          </span>
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-auto min-h-0 p-6">
        <div className="flex flex-col gap-4 max-w-[860px] mx-auto">
          {activeChat?.messages.length || isSendingMessage ? (
            <>
              {activeChat?.messages.map((message) => (
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
                    <p className="m-0 text-neon-text whitespace-pre-wrap">
                      {message.content}
                    </p>
                    {message.citations?.length ? (
                      <div className="flex gap-2 flex-wrap mt-3">
                        {groupCitations(message.citations).map((group) => (
                          <CitationFilePill key={group.key} group={group} />
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-neon-border/40">
                        <button
                          onClick={() => void handleFeedback(message.id, "thumbs_up")}
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
                          onClick={() =>
                            void handleFeedback(message.id, "thumbs_down")
                          }
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
              {isSendingMessage && (
                <StreamingBubble
                  content={streamingContent}
                  status={streamingStatus}
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
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          placeholder="Ask a question about your documents..."
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSendMessage();
            }
          }}
          className="flex-1 min-h-[54px] max-h-[180px] px-4 py-[14px] rounded-[16px] border border-neon-border bg-white/[0.03] text-neon-text placeholder:text-neon-disabled resize-y outline-none"
        />
        <button
          onClick={() => void handleSendMessage()}
          disabled={!draftMessage.trim() || isSendingMessage}
          className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-neon-accent text-neon-bg border-0 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {isSendingMessage ? <Icon name="loader" /> : <Icon name="send" />}
        </button>
      </div>
    </section>
  );
}
