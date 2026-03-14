"use client";

import { useState } from "react";
import { Icon } from "./icons";

export function ProjectModal(props: {
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div
      className="fixed inset-0 bg-[rgba(5,8,14,0.72)] backdrop-blur-[8px] grid place-items-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-[min(520px,calc(100vw-32px))] rounded-[24px] border border-neon-border bg-[rgba(17,24,39,0.95)] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-[22px] py-[22px] border-b border-neon-border">
          <strong className="text-[1.8rem] font-bold tracking-[-0.03em] text-neon-text">
            New Project
          </strong>
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.isSubmitting}
            aria-label="Close modal"
            className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-neon-border bg-white/[0.02] text-neon-muted hover:text-neon-text hover:bg-neon-elevated transition-[140ms] disabled:opacity-45"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Body */}
        <form
          className="flex flex-col gap-[14px] p-[22px]"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || props.isSubmitting) return;
            void props.onSubmit(trimmed, description.trim());
          }}
        >
          <label className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
            Project Name
          </label>
          <input
            className="px-4 py-[14px] rounded-[16px] border border-neon-border bg-white/[0.03] text-neon-text outline-none placeholder:text-neon-disabled"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <label className="text-neon-disabled uppercase text-[0.72rem] tracking-[0.16em] font-bold">
            Description
          </label>
          <textarea
            className="px-4 py-[14px] rounded-[16px] border border-neon-border bg-white/[0.03] text-neon-text resize-y outline-none placeholder:text-neon-disabled"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          {props.errorMessage && (
            <div className="rounded-[14px] border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] text-[#fca5a5] px-[14px] py-3 text-[0.9rem]">
              {props.errorMessage}
            </div>
          )}

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={props.onClose}
              disabled={props.isSubmitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-[14px] py-3 rounded-[14px] border border-neon-border bg-white/[0.03] text-neon-text font-bold hover:bg-neon-elevated transition-[140ms] disabled:opacity-45"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || props.isSubmitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-[14px] py-3 rounded-[14px] font-bold bg-neon-accent text-neon-bg shadow-[0_0_18px_rgba(250,204,21,0.18)] hover:bg-neon-accent-hover transition-[140ms] disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {props.isSubmitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
