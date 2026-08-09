"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Reusable "crop from a PDF page" tool for the ingest review surfaces (batch
// dashboard + per-file wizard). Renders a source page, lets the reviewer drag a
// rectangle (stored as NORMALIZED [0,1] coords, DPI/zoom independent) and then
// either ASSIGN the crop as an image (link to stem/option/…) or OCR it to text.

export const CROP_TARGETS = [
  { value: "STEM", label: "Enunciado (imagen)" },
  { value: "STIMULUS", label: "Estímulo" },
  { value: "OPTION", label: "Opción individual" },
  { value: "OPTION_BLOCK", label: "Bloque de opciones (OCR A–D)" },
  { value: "ANSWER_FIELD", label: "Campo de respuesta" },
  { value: "EXPLANATION", label: "Explicación" },
  { value: "PAGE_CONTEXT", label: "Contexto de página" },
] as const;

export interface CropTarget {
  targetType: string;
  optionLabel: string | null;
}
export interface CropOcrResult {
  text: string | null;
  options?: { label: string; text: string }[];
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PdfPageCropperProps {
  candidateId: string;
  sourceFileId: string;
  pageNumbers: number[];
  defaultPageNumber?: number;
  onAssigned?: () => void;
  onOcrText?: (target: CropTarget, result: CropOcrResult) => void;
  className?: string;
  // Region crop (ASSIGN/OCR) needs a real PDF (pdfplumber). For DOCX sources the
  // page can still be viewed, but region tools are disabled with a pointer to the
  // gallery. Defaults to true so PDF callers are unaffected.
  sourceIsPdf?: boolean;
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function PdfPageCropper({
  candidateId,
  sourceFileId,
  pageNumbers,
  defaultPageNumber,
  onAssigned,
  onOcrText,
  className,
  sourceIsPdf = true,
}: PdfPageCropperProps) {
  const uniquePages = Array.from(new Set(pageNumbers.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  const initialPage = defaultPageNumber && uniquePages.includes(defaultPageNumber) ? defaultPageNumber : uniquePages[0] ?? 1;

  const [open, setOpen] = useState(false);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [targetType, setTargetType] = useState<string>("STEM");
  const [optionLabel, setOptionLabel] = useState("");
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState<null | "ASSIGN" | "OCR">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // change page and reset selection/error (avoids setState-in-effect)
  function changePage(next: number) {
    setPageNumber(Math.max(1, next));
    setRect(null);
    setPageError(false);
  }

  const pointFromEvent = useCallback((event: React.MouseEvent) => {
    const el = wrapperRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  function handleMouseDown(event: React.MouseEvent) {
    if (busy) return;
    event.preventDefault();
    dragStart.current = pointFromEvent(event);
    setRect(null);
    setMessage(null);
  }
  function handleMouseMove(event: React.MouseEvent) {
    if (!dragStart.current) return;
    setRect(normalizeRect(dragStart.current, pointFromEvent(event)));
  }
  function handleMouseUp(event: React.MouseEvent) {
    if (!dragStart.current) return;
    const final = normalizeRect(dragStart.current, pointFromEvent(event));
    dragStart.current = null;
    setRect(final.x1 - final.x0 < 0.01 || final.y1 - final.y0 < 0.01 ? null : final);
  }

  const hasSelection = !!rect;
  const needsOption = targetType === "OPTION";
  const canSubmit = sourceIsPdf && hasSelection && (!needsOption || !!optionLabel);

  async function submit(mode: "ASSIGN" | "OCR") {
    if (!rect || !canSubmit) return;
    setBusy(mode);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/ai-import/candidates/${candidateId}/crop-region`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNumber,
          bbox: rect,
          mode,
          targetType,
          optionLabel: needsOption ? optionLabel.toUpperCase() : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "No se pudo procesar el recorte.");
        return;
      }
      if (mode === "ASSIGN") {
        setMessage("Recorte asignado.");
        setRect(null);
        onAssigned?.();
      } else {
        onOcrText?.({ targetType, optionLabel: needsOption ? optionLabel.toUpperCase() : null }, { text: data.text ?? null, options: data.options });
        setMessage(data.text ? "OCR aplicado al campo (revisa y guarda)." : data.warning || "El OCR no devolvió texto.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "Cerrar recorte de PDF" : "Recortar desde el PDF"}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
        <div className="my-auto w-full max-w-3xl space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recortar desde el PDF</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          {!sourceIsPdf && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Este archivo es un DOCX: puedes ver la página, pero el recorte por región (Asignar/OCR) solo está
              disponible para PDF. Para DOCX usa la <strong>Galería de imágenes</strong> y asigna la página completa.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Página</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => changePage(pageNumber - 1)} disabled={pageNumber <= 1 || busy !== null}>
              ‹
            </Button>
            <Input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(event) => changePage(Number(event.target.value) || 1)}
              className="w-20"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => changePage(pageNumber + 1)} disabled={busy !== null}>
              ›
            </Button>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {CROP_TARGETS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <Input
              value={optionLabel}
              onChange={(event) => setOptionLabel(event.target.value.toUpperCase().slice(0, 1))}
              placeholder="A–D"
              disabled={!needsOption}
              className="w-16"
            />
          </div>

          <p className="text-xs text-gray-500">
            Arrastra sobre la página para seleccionar la región. Luego <strong>Asignar</strong> (guarda la imagen y la enlaza) u{" "}
            <strong>OCR</strong> (transcribe a texto para revisar).
          </p>

          <div
            ref={wrapperRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative max-h-[560px] cursor-crosshair select-none overflow-auto rounded border border-gray-300 bg-gray-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/ai-import/sources/${sourceFileId}/pages/${pageNumber}/image?dpi=150`}
              alt={`Página ${pageNumber}`}
              className="block w-full"
              draggable={false}
              onError={() => setPageError(true)}
              onLoad={() => setPageError(false)}
            />
            {pageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-xs text-gray-400">
                No se pudo cargar la página {pageNumber}.
              </div>
            )}
            {rect && (
              <div
                className="pointer-events-none absolute border-2 border-blue-500 bg-blue-400/20"
                style={{
                  left: `${rect.x0 * 100}%`,
                  top: `${rect.y0 * 100}%`,
                  width: `${(rect.x1 - rect.x0) * 100}%`,
                  height: `${(rect.y1 - rect.y0) * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => submit("ASSIGN")} disabled={!canSubmit || busy !== null}>
              {busy === "ASSIGN" ? "Asignando…" : "Asignar recorte"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => submit("OCR")} disabled={!canSubmit || busy !== null}>
              {busy === "OCR" ? "OCR…" : "OCR del recorte"}
            </Button>
            {rect && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setRect(null)} disabled={busy !== null}>
                Limpiar selección
              </Button>
            )}
            {needsOption && !optionLabel && <span className="text-xs text-amber-600">Indica la letra (A–D).</span>}
          </div>

          {message && <p className="text-xs text-gray-600">{message}</p>}
        </div>
        </div>
      )}
    </div>
  );
}
