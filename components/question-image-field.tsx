"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionMedia } from "@/components/question-media";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

function isDisplayableImageUrl(url: string) {
  const value = url.trim();
  if (!value) return true;
  return value.startsWith("/uploads/") || value.startsWith("data:") || value.startsWith("blob:");
}

export function QuestionImageField({
  label,
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Smaller thumbnail for option rows; full preview lives in View as player. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showPath, setShowPath] = useState(false);
  const displayable = isDisplayableImageUrl(value);

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/questions/media/upload", { method: "POST", body });
      if (!res.ok) {
        setError(errorMessage(await readApiError(res, "Upload failed.")));
        return;
      }
      const data = await res.json();
      if (typeof data.url === "string") onChange(data.url);
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}>
            <Trash2 size={14} />
            Clear
          </Button>
        )}
        <button
          type="button"
          className="text-xs text-gray-500 underline-offset-2 hover:underline"
          onClick={() => setShowPath((v) => !v)}
        >
          {showPath ? "Hide path" : "Show path"}
        </button>
      </div>
      {showPath && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "/uploads/questions/..."}
          className="font-mono text-xs"
        />
      )}
      {!displayable && value.trim() && (
        <p className="text-xs text-amber-700">
          External URLs are blocked by security policy and will not show in the player. Upload the file instead.
        </p>
      )}
      <InlineError className="text-xs">{error}</InlineError>
      {displayable && value.trim() && (
        <QuestionMedia
          imageUrl={value}
          className={compact ? "max-w-xs [&_img]:max-h-28" : "max-w-md [&_img]:max-h-40"}
        />
      )}
    </div>
  );
}
