import type { ProjectDocument } from "../types";

export function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

export function documentLabel(doc: ProjectDocument): string {
  if (doc.sourceUrl) {
    try {
      const url = new URL(doc.sourceUrl);
      return `${url.hostname}${url.pathname}`;
    } catch {
      return doc.sourceUrl;
    }
  }
  return doc.filename;
}

export function documentMeta(doc: ProjectDocument): string {
  if (doc.sourceUrl) {
    return `Website · ${formatTimestamp(doc.createdAt)}`;
  }
  const sizeBytes =
    typeof doc.processingDetails.sizeBytes === "number" ? doc.processingDetails.sizeBytes : null;
  return `${formatBytes(sizeBytes)} · ${formatTimestamp(doc.createdAt)}`;
}
