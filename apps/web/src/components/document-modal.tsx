"use client";

import React, { useEffect, useState } from "react";
import type { ProjectDocument } from "../types";
import { apiFetch } from "../lib/api";
import { Icon } from "./icons";

type Details = Record<string, unknown>;

const PHASES = [
  "queued",
  "processing",
  "partitioning",
  "chunking",
  "summarising",
  "embedding",
  "completed",
] as const;
type Phase = (typeof PHASES)[number];

function getStepStatus(
  step: Phase,
  doc: ProjectDocument,
  details: Details,
  currentPhase: string,
): "done" | "active" | "failed" | "pending" {
  if (doc.processingStatus === "completed") return "done";

  const stepIndex = PHASES.indexOf(step);

  if (doc.processingStatus === "failed") {
    const completedSet = new Set<string>(["queued"]);
    if (details.startedAt) completedSet.add("processing");
    if (details.partitioning) {
      completedSet.add("processing");
      completedSet.add("partitioning");
    }
    if (details.chunking) completedSet.add("chunking");
    if (details.summarising) completedSet.add("summarising");
    if (details.embedding) completedSet.add("embedding");

    if (completedSet.has(step)) return "done";
    const lastCompletedIndex = Math.max(
      ...[...completedSet].map((p) => PHASES.indexOf(p as Phase)).filter((i) => i >= 0),
    );
    if (stepIndex === lastCompletedIndex + 1) return "failed";
    return "pending";
  }

  const currentIndex = PHASES.indexOf(currentPhase as Phase);
  if (currentIndex < 0) return step === "queued" ? "active" : "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function PhaseDot({ status }: { status: "done" | "active" | "failed" | "pending" }) {
  const base = "w-2.5 h-2.5 rounded-full shrink-0";
  if (status === "done") return <span className={`${base} bg-neon-accent`} />;
  if (status === "active") return <span className={`${base} bg-neon-purple animate-pulse`} />;
  if (status === "failed") return <span className={`${base} bg-neon-error`} />;
  return <span className={`${base} border border-neon-border`} />;
}

function labelColor(status: "done" | "active" | "failed" | "pending") {
  if (status === "done") return "text-neon-accent";
  if (status === "active") return "text-neon-purple";
  if (status === "failed") return "text-neon-error";
  return "text-neon-disabled";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-neon-muted text-[0.82rem] shrink-0 w-24">{label}</span>
      <span className="text-neon-text text-[0.82rem] font-mono break-all">{value}</span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-neon-border bg-white/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-neon-accent">
          <Icon name={icon} />
        </span>
        <strong className="text-neon-text text-sm">{title}</strong>
      </div>
      {children}
    </div>
  );
}

function TagList({ items }: { items: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(items).map(([key, count]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[0.72rem] border border-neon-border text-neon-muted"
        >
          {key} <strong className="text-neon-text">{count}</strong>
        </span>
      ))}
    </div>
  );
}

type DocImage = { chunk_index: number; page_number: number | null; image_base64: string };

function DocumentImages({
  documentId,
  detectedImageCount,
  onReprocess,
}: {
  documentId: string;
  detectedImageCount: number;
  onReprocess?: () => void;
}) {
  const [images, setImages] = useState<DocImage[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<{ images: DocImage[] }>(`/chunks/by-document/${documentId}/images`)
      .then((d) => { setImages(d.images); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [documentId]);

  if (!loaded) return null;

  // Images detected during partitioning but no base64 extracted
  if (!images.length && detectedImageCount > 0) {
    return (
      <Section title={`Extracted Images (${detectedImageCount} detected)`} icon="image">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="m-0 text-neon-muted text-sm">
            {detectedImageCount} image{detectedImageCount !== 1 ? "s" : ""} detected but image data was not extracted.
            Reprocess to extract image content.
          </p>
          {onReprocess && (
            <button
              onClick={onReprocess}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-neon-accent text-neon-bg hover:bg-neon-accent-hover transition-[140ms]"
            >
              <Icon name="loader" />
              Reprocess document
            </button>
          )}
        </div>
      </Section>
    );
  }

  if (!images.length) return null;

  return (
    <Section title={`Extracted Images (${images.length})`} icon="image">
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, i) => {
          const src = `data:image/jpeg;base64,${img.image_base64}`;
          return (
            <button
              key={i}
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="relative rounded-lg border border-neon-border overflow-hidden hover:border-neon-accent transition-[140ms] focus:outline-none bg-black/20"
            >
              <img
                src={src}
                alt={img.page_number ? `Page ${img.page_number}` : `Image ${i + 1}`}
                className="block w-full h-[80px] object-cover"
              />
              {img.page_number != null && (
                <span className="absolute bottom-1 right-1 text-[0.6rem] px-1.5 py-0.5 rounded bg-black/60 text-neon-muted">
                  p.{img.page_number}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {expanded !== null && images[expanded] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setExpanded(null)}
        >
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={`data:image/jpeg;base64,${images[expanded].image_base64}`}
              alt={images[expanded].page_number ? `Page ${images[expanded].page_number}` : `Image ${expanded + 1}`}
              className="block max-w-full max-h-[85vh] rounded-xl object-contain"
            />
            <button
              onClick={() => setExpanded(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-neon-surface border border-neon-border text-neon-muted hover:text-neon-text flex items-center justify-center"
            >
              <Icon name="x" />
            </button>
            {images[expanded].page_number != null && (
              <span className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded-lg bg-black/60 text-neon-muted">
                Page {images[expanded].page_number}
              </span>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

export function DocumentModal({
  doc,
  onClose,
  onReprocess,
}: {
  doc: ProjectDocument;
  onClose: () => void;
  onReprocess?: () => void;
}) {
  const details = (doc.processingDetails ?? {}) as Details;
  const currentPhase =
    doc.processingStatus === "queued"
      ? "queued"
      : doc.processingStatus === "completed"
        ? "completed"
        : (details.phase as string) ?? doc.processingStatus;

  const isFailed = doc.processingStatus === "failed";

  const statusClass =
    doc.processingStatus === "completed"
      ? "bg-[rgba(234,179,8,0.11)] border-[rgba(234,179,8,0.18)] text-[#fcd34d]"
      : isFailed
        ? "bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.22)] text-[#fca5a5]"
        : "bg-[rgba(167,139,250,0.13)] border-[rgba(167,139,250,0.24)] text-neon-purple";

  const partitioningData = details.partitioning as Record<string, unknown> | undefined;
  const chunkingData = details.chunking as Record<string, unknown> | undefined;
  const summarisingData = details.summarising as Record<string, unknown> | undefined;
  const embeddingData = details.embedding as Record<string, unknown> | undefined;
  const errorMessage = isFailed ? (details.error as string | undefined) : undefined;

  const hasNoDetails = !errorMessage && !partitioningData && !chunkingData && !summarisingData && !embeddingData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[88vh] flex flex-col rounded-[24px] border border-neon-border bg-[#111827] shadow-[0_40px_80px_rgba(0,0,0,0.5)]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neon-border shrink-0">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-[12px] bg-white/[0.04] border border-neon-border text-neon-accent shrink-0">
            <Icon name={doc.sourceUrl ? "globe" : "file"} />
          </div>
          <div className="flex-1 min-w-0">
            <strong className="block text-neon-text text-sm truncate">
              {doc.filename || doc.sourceUrl || "Document"}
            </strong>
            {doc.sourceUrl && (
              <span className="text-neon-muted text-[0.78rem] block truncate">{doc.sourceUrl}</span>
            )}
          </div>
          <span
            className={`inline-flex items-center justify-center rounded-full text-[0.72rem] px-[10px] py-[6px] border uppercase shrink-0 ${statusClass}`}
          >
            {doc.processingStatus}
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-neon-border text-neon-muted hover:text-neon-text hover:bg-white/[0.04] transition-[140ms] shrink-0"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Pipeline stepper */}
        <div className="px-5 pt-4 pb-3 border-b border-neon-border shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {PHASES.map((phase, i) => {
              const status = getStepStatus(phase, doc, details, currentPhase);
              return (
                <React.Fragment key={phase}>
                  <div className="flex items-center gap-1">
                    <PhaseDot status={status} />
                    <span className={`text-[0.72rem] capitalize ${labelColor(status)}`}>{phase}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <span className="text-neon-disabled text-[0.72rem] mx-1">›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Detail sections */}
        <div className="flex flex-col gap-3 p-5 overflow-auto min-h-0">

          {/* Error */}
          {errorMessage && (
            <div className="rounded-[14px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-neon-error">
                  <Icon name="alert" />
                </span>
                <strong className="text-neon-error text-sm">Processing Failed</strong>
              </div>
              <p className="m-0 text-[#fca5a5] text-[0.82rem] font-mono break-all">{errorMessage}</p>
            </div>
          )}

          {/* Partitioning */}
          {partitioningData && (
            <Section title="Partitioning" icon="file-text">
              <div className="flex flex-col gap-1.5">
                <DetailRow label="Parser" value={String(partitioningData.parser ?? "—")} />
                <DetailRow label="Elements" value={String(partitioningData.element_count ?? "—")} />
                {partitioningData.page_count != null && (
                  <DetailRow label="Pages" value={String(partitioningData.page_count)} />
                )}
              </div>
              {partitioningData.elements_by_type != null && (
                <TagList items={partitioningData.elements_by_type as Record<string, number>} />
              )}
              {Array.isArray(partitioningData.preview) && partitioningData.preview.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-neon-disabled text-[0.7rem] uppercase tracking-[0.1em]">
                    First elements
                  </span>
                  {(partitioningData.preview as Array<Record<string, unknown>>)
                    .slice(0, 4)
                    .map((el, i) => (
                      <div
                        key={i}
                        className="rounded-[10px] bg-white/[0.02] border border-neon-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-neon-accent text-[0.7rem] uppercase font-semibold">
                            {String(el.type)}
                          </span>
                          {el.pageNumber != null && (
                            <span className="text-neon-disabled text-[0.7rem]">
                              p.{String(el.pageNumber)}
                            </span>
                          )}
                        </div>
                        <p className="m-0 text-neon-muted text-[0.8rem] line-clamp-2">
                          {String(el.textPreview)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </Section>
          )}

          {/* Chunking */}
          {chunkingData && (
            <Section title="Chunking" icon="info">
              <div className="flex flex-col gap-1.5">
                <DetailRow label="Chunks" value={String(chunkingData.chunk_count ?? "—")} />
                <DetailRow
                  label="Avg chars"
                  value={String(chunkingData.average_chunk_chars ?? "—")}
                />
                <DetailRow
                  label="Max chars"
                  value={String(chunkingData.max_chunk_chars ?? "—")}
                />
              </div>
              {chunkingData.chunks_by_modality != null && (
                <TagList items={chunkingData.chunks_by_modality as Record<string, number>} />
              )}
              {Array.isArray(chunkingData.chunks) && chunkingData.chunks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-neon-disabled text-[0.7rem] uppercase tracking-[0.1em]">
                    Chunk preview
                  </span>
                  {(chunkingData.chunks as Array<Record<string, unknown>>).slice(0, 4).map(
                    (chunk, i) => (
                      <div
                        key={i}
                        className="rounded-[10px] bg-white/[0.02] border border-neon-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-neon-muted text-[0.7rem]">
                            #{String(chunk.chunkIndex)}
                          </span>
                          {chunk.pageNumber != null && (
                            <span className="text-neon-disabled text-[0.7rem]">
                              p.{String(chunk.pageNumber)}
                            </span>
                          )}
                          {Array.isArray(chunk.modalityFlags) &&
                            chunk.modalityFlags.map((m: unknown) => (
                              <span key={String(m)} className="text-neon-accent text-[0.7rem]">
                                {String(m)}
                              </span>
                            ))}
                        </div>
                        <p className="m-0 text-neon-muted text-[0.8rem]">
                          {String(chunk.charCount)} chars
                          {chunk.sectionTitle ? ` · ${String(chunk.sectionTitle)}` : ""}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Summarisation */}
          {summarisingData && (
            <Section title="Summarisation" icon="chat">
              <div className="flex flex-col gap-1.5">
                <DetailRow label="Total" value={String(summarisingData.chunk_count ?? "—")} />
                <DetailRow
                  label="Summarized"
                  value={String(summarisingData.summarized_chunk_count ?? "—")}
                />
              </div>
              {summarisingData.strategy_counts != null && (
                <TagList items={summarisingData.strategy_counts as Record<string, number>} />
              )}
              {Array.isArray(summarisingData.chunks) && summarisingData.chunks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-neon-disabled text-[0.7rem] uppercase tracking-[0.1em]">
                    Retrieval preview
                  </span>
                  {(summarisingData.chunks as Array<Record<string, unknown>>).slice(0, 3).map(
                    (chunk, i) => (
                      <div
                        key={i}
                        className="rounded-[10px] bg-white/[0.02] border border-neon-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-neon-muted text-[0.7rem]">
                            #{String(chunk.chunkIndex)}
                          </span>
                          <span
                            className={`text-[0.7rem] ${
                              chunk.summaryApplied ? "text-neon-accent" : "text-neon-disabled"
                            }`}
                          >
                            {chunk.summaryApplied ? "summarized" : "raw"}
                          </span>
                          {chunk.summaryStrategy != null && (
                            <span className="text-neon-disabled text-[0.7rem]">
                              {String(chunk.summaryStrategy)}
                            </span>
                          )}
                        </div>
                        <p className="m-0 text-neon-muted text-[0.8rem] line-clamp-2">
                          {String(chunk.retrievalPreview)}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Embedding */}
          {embeddingData && (
            <Section title="Embedding" icon="check">
              {embeddingData.skipped ? (
                <div className="flex flex-col gap-1.5">
                  <DetailRow label="Status" value="skipped" />
                  <DetailRow label="Reason" value={String(embeddingData.reason ?? "—")} />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <DetailRow label="Model" value={String(embeddingData.model ?? "—")} />
                  <DetailRow
                    label="Embedded"
                    value={`${String(embeddingData.embedded_count ?? "—")} / ${String(embeddingData.total_chunks ?? "—")}`}
                  />
                  {typeof embeddingData.failed_count === "number" &&
                    embeddingData.failed_count > 0 && (
                      <DetailRow
                        label="Failed"
                        value={<span className="text-neon-error">{String(embeddingData.failed_count)}</span>}
                      />
                    )}
                </div>
              )}
            </Section>
          )}

          {/* Extracted images */}
          {doc.processingStatus === "completed" && (
            <DocumentImages
              documentId={doc.id}
              detectedImageCount={
                ((partitioningData?.elements_by_type as Record<string, number> | undefined)?.image) ?? 0
              }
              onReprocess={onReprocess}
            />
          )}

          {/* Empty state while queued/early processing */}
          {hasNoDetails && (
            <div className="min-h-[120px] grid place-items-center text-center gap-2 p-4">
              <span className="text-neon-purple">
                <Icon name="loader" />
              </span>
              <p className="text-neon-muted text-sm m-0">
                Processing details appear here as each pipeline stage completes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
