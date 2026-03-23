"use client";

import { useRef } from "react";
import type { KnowledgeTab } from "../types";
import { useProjectContext } from "../context/project-context";
import { documentLabel, documentMeta } from "../lib/utils";
import { Icon } from "./icons";
import type { ProjectDocument } from "../types";

function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  const trackStyle = {
    background: `linear-gradient(to right, #facc15 ${pct}%, #2d3748 ${pct}%)`,
  };

  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-neon-muted text-sm">{props.label}</span>
        <strong className="text-neon-text text-sm">{props.value}</strong>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        style={trackStyle}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function DocRow(props: {
  doc: ProjectDocument;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const { doc } = props;

  const statusClass =
    doc.processingStatus === "completed"
      ? "bg-[rgba(234,179,8,0.11)] border-[rgba(234,179,8,0.18)] text-[#fcd34d]"
      : doc.processingStatus === "failed"
        ? "bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.22)] text-[#fca5a5]"
        : "bg-[rgba(167,139,250,0.13)] border-[rgba(167,139,250,0.24)] text-neon-purple";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => props.onView(doc.id)}
      onKeyDown={(e) => e.key === "Enter" && props.onView(doc.id)}
      className="group grid items-center gap-2 px-4 py-[14px] rounded-[18px] border border-neon-border bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] hover:border-[rgba(167,139,250,0.3)] transition-[140ms]"
      style={{ gridTemplateColumns: "auto 1fr auto auto" }}
    >
      <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
        <Icon name={doc.sourceUrl ? "globe" : "file"} />
      </div>
      <div className="flex flex-col min-w-0">
        <strong className="text-neon-text text-[0.92rem] whitespace-nowrap overflow-hidden text-ellipsis">
          {documentLabel(doc)}
        </strong>
        <span className="text-neon-muted text-[0.92rem]">{documentMeta(doc)}</span>
      </div>
      <span
        className={`inline-flex items-center justify-center rounded-full text-[0.72rem] px-[10px] py-[6px] border uppercase ${statusClass}`}
      >
        {doc.processingStatus}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete(doc.id);
        }}
        aria-label="Delete document"
        className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted opacity-0 group-hover:opacity-100 hover:text-neon-error hover:border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.08)] transition-[140ms]"
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

export function KnowledgeSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    knowledgeTab,
    setKnowledgeTab,
    documents,
    selectedFileName,
    urlValue,
    setUrlValue,
    selectedDocumentId: _selectedDocumentId,
    setSelectedDocumentId,
    settings,
    settingsDraft,
    setSettingsDraft,
    isSavingSettings,
    handleDeleteDocument,
    handleAddUrl,
    handleSaveSettings,
    handleSelectedFile,
  } = useProjectContext();

  const draft = settingsDraft;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleSelectedFile}
      />

      <aside className="w-[360px] shrink-0 flex flex-col min-h-0 border border-neon-border rounded-[24px] bg-[rgba(17,24,39,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        {/* Header */}
        <div className="px-5 py-[18px] border-b border-neon-border">
          <strong className="text-neon-text">Knowledge Base</strong>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-neon-border">
          {(["documents", "settings"] as KnowledgeTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setKnowledgeTab(tab)}
              className={`inline-flex items-center justify-center gap-2 py-[14px] px-3 border-0 font-bold transition-[140ms] ${
                knowledgeTab === tab
                  ? "text-neon-accent bg-neon-highlight"
                  : "text-neon-muted bg-transparent"
              }`}
            >
              <Icon name={tab === "documents" ? "file" : "settings"} />
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>

        {/* Scroll area */}
        <div className="overflow-auto min-h-0 flex-1">
          {knowledgeTab === "documents" ? (
            <div className="flex flex-col gap-[14px] p-[18px]">
              {/* Upload zone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-[18px] py-6 rounded-[20px] border border-dashed border-[rgba(250,204,21,0.28)] bg-[rgba(250,204,21,0.04)] text-center hover:bg-[rgba(250,204,21,0.08)] transition-[140ms]"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent mx-auto">
                  <Icon name="upload" />
                </div>
                <strong className="block text-neon-text mt-3 mb-[6px]">
                  {selectedFileName || "Drop files or click to upload"}
                </strong>
                <p className="m-0 text-neon-muted text-sm">PDF, DOCX, PPTX, MD, TXT</p>
              </button>

              {/* Divider */}
              <div className="grid place-items-center text-neon-muted uppercase tracking-[0.16em] text-[0.72rem]">
                <span>or</span>
              </div>

              {/* URL form */}
              <form className="flex flex-col gap-3" onSubmit={handleAddUrl}>
                <div className="flex items-center gap-2 px-[14px] py-[11px] rounded-[18px] border border-neon-border bg-white/[0.03]">
                  <span className="inline-flex items-center text-neon-muted">
                    <Icon name="globe" />
                  </span>
                  <input
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    placeholder="Paste website URL"
                    className="flex-1 bg-transparent border-0 outline-none text-neon-text placeholder:text-neon-disabled"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!urlValue.trim()}
                  className="inline-flex items-center justify-center gap-2 px-[14px] py-3 rounded-[14px] font-bold bg-neon-purple text-white hover:bg-neon-purple-hover hover:text-neon-bg transition-[140ms] disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Icon name="plus" />
                  <span>Add website</span>
                </button>
              </form>

              {/* Sources heading */}
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-base font-semibold text-neon-text">Sources</h2>
                <span className="inline-flex items-center justify-center rounded-full text-[0.72rem] px-[10px] py-[6px] border border-[rgba(250,204,21,0.18)] bg-neon-highlight text-neon-accent uppercase">
                  {documents.length}
                </span>
              </div>

              {/* Document list */}
              <div className="flex flex-col gap-[10px]">
                {documents.length === 0 ? (
                  <div className="min-h-[220px] grid place-items-center text-center gap-3 p-7">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                      <Icon name="file" />
                    </div>
                    <h3 className="m-0 text-base text-neon-text">No sources yet</h3>
                    <p className="text-neon-muted text-[0.92rem]">
                      Upload a file or add a URL to queue ingestion.
                    </p>
                  </div>
                ) : (
                  documents
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((doc) => (
                      <DocRow
                        key={doc.id}
                        doc={doc}
                        onDelete={(id) => void handleDeleteDocument(id)}
                        onView={(id) => setSelectedDocumentId(id)}
                      />
                    ))
                )}
              </div>
            </div>
          ) : draft ? (
            <div className="flex flex-col gap-[14px] p-[18px]">
              {/* Embedding model */}
              <div className="flex flex-col gap-[10px]">
                <label className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
                  Embedding Model
                </label>
                <input
                  className="px-4 py-[14px] rounded-[16px] border border-neon-border bg-white/[0.03] text-neon-disabled outline-none"
                  value={draft.embeddingModel}
                  disabled
                />
                <small className="text-neon-muted text-[0.85rem]">
                  Locked after first indexed content. This phase only wires the control surface.
                </small>
              </div>

              {/* Search strategy */}
              <div className="flex flex-col gap-[10px]">
                <label className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
                  Search Strategy
                </label>
                <div className="flex flex-col gap-[10px]">
                  {(
                    [
                      { value: "vector", label: "Vector Search" },
                      { value: "keyword", label: "Keyword Search" },
                      { value: "hybrid", label: "Hybrid Search" },
                      { value: "multi_query_vector", label: "Multi Query Vector" },
                      { value: "multi_query_hybrid", label: "Multi Query Hybrid" },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2 px-[14px] py-3 rounded-[16px] border cursor-pointer text-neon-text transition-[140ms] ${
                        draft.retrievalStrategy === option.value
                          ? "border-[rgba(250,204,21,0.34)] bg-neon-highlight"
                          : "border-neon-border bg-white/[0.02]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="retrievalStrategy"
                        checked={draft.retrievalStrategy === option.value}
                        onChange={() =>
                          setSettingsDraft({ ...draft, retrievalStrategy: option.value })
                        }
                        className="accent-neon-accent"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="flex flex-col gap-[14px]">
                <SliderField
                  label="Chunks Per Search"
                  value={draft.chunksPerSearch}
                  min={1}
                  max={20}
                  onChange={(v) => setSettingsDraft({ ...draft, chunksPerSearch: v })}
                />
                <SliderField
                  label="Final Context Size"
                  value={draft.finalContextSize}
                  min={1}
                  max={20}
                  onChange={(v) => setSettingsDraft({ ...draft, finalContextSize: v })}
                />
                <SliderField
                  label="Similarity Threshold"
                  value={Number(draft.similarityThreshold.toFixed(1))}
                  min={0}
                  max={1}
                  step={0.1}
                  onChange={(v) => setSettingsDraft({ ...draft, similarityThreshold: v })}
                />
                <SliderField
                  label="Query Variation Count"
                  value={draft.queryVariationCount}
                  min={0}
                  max={8}
                  onChange={(v) => setSettingsDraft({ ...draft, queryVariationCount: v })}
                />
              </div>

              {/* Save button */}
              <button
                onClick={() => void handleSaveSettings()}
                disabled={isSavingSettings}
                className="inline-flex items-center justify-center gap-2 w-full px-[14px] py-3 rounded-[14px] font-bold bg-neon-accent text-neon-bg shadow-[0_0_18px_rgba(250,204,21,0.18)] hover:bg-neon-accent-hover transition-[140ms] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Icon name="settings" />
                <span>{isSavingSettings ? "Saving..." : "Apply Settings"}</span>
              </button>
            </div>
          ) : (
            <div className="min-h-[220px] grid place-items-center text-center gap-3 p-7">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/[0.04] border border-neon-border text-neon-accent">
                <Icon name="settings" />
              </div>
              <h3 className="m-0 text-base text-neon-text">No settings loaded</h3>
              <p className="text-neon-muted text-[0.92rem]">
                Select a project to load retrieval controls.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
