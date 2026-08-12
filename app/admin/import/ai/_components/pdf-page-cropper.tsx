"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

// Destination fields the OCR'd text can be assigned to (no PAGE_CONTEXT — the
// OCR text always lands in a concrete draft field).
export const OCR_TARGETS = [
  { value: "STEM", label: "Enunciado" },
  { value: "STIMULUS", label: "Estímulo" },
  { value: "OPTION_BLOCK", label: "Bloque de opciones (A–D)" },
  { value: "OPTION", label: "Opción individual" },
  { value: "EXPLANATION", label: "Explicación" },
  { value: "ANSWER_FIELD", label: "Respuesta correcta" },
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
  // When the candidate's own source has no renderable pages, the pixels come from
  // a sibling source in the same batch (e.g. Test 1 R&W: candidates in the answer
  // DOCX, images in the questions DOCX). When set, the viewer renders and crops
  // that source instead. Defaults to `sourceFileId` / `pageNumbers`.
  imageSourceFileId?: string;
  imagePageNumbers?: number[];
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
  imageSourceFileId,
  imagePageNumbers,
}: PdfPageCropperProps) {
  // The source we actually render/crop — a sibling image source when provided.
  const effectiveSourceId = imageSourceFileId || sourceFileId;
  const effectivePages = imagePageNumbers && imagePageNumbers.length ? imagePageNumbers : pageNumbers;
  const uniquePages = Array.from(new Set(effectivePages.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  const initialPage = defaultPageNumber && uniquePages.includes(defaultPageNumber) ? defaultPageNumber : uniquePages[0] ?? 1;

  const [open, setOpen] = useState(false);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [targetType, setTargetType] = useState<string>("STEM");
  const [optionLabel, setOptionLabel] = useState("");
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState<null | "ASSIGN" | "OCR">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // OCR review: the crop OCR result is staged here (NOT auto-applied) so the
  // reviewer can see the detected text, edit it and choose the destination field
  // before it overwrites anything.
  const [ocr, setOcr] = useState<CropOcrResult | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrTarget, setOcrTarget] = useState("STEM");
  const [ocrOptionLabel, setOcrOptionLabel] = useState("");

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // change page and reset selection/error (avoids setState-in-effect)
  function changePage(next: number) {
    setPageNumber(Math.max(1, next));
    setRect(null);
    setPageError(false);
    setImgLoaded(false);
  }

  // Measure against the IMAGE element (not the scroll container) so the normalized
  // coords are correct even when the image is scaled or the box is scrolled.
  const pointFromEvent = useCallback((event: React.MouseEvent) => {
    const el = imgRef.current;
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
  const canSubmit = hasSelection && (!needsOption || !!optionLabel);

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
          imageSourceFileId: effectiveSourceId,
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
        // Stage the OCR result for review — do NOT auto-apply/overwrite. The
        // reviewer edits the text, picks the destination field and confirms.
        const detected = data.text ?? "";
        setOcr({ text: detected, options: data.options });
        setOcrText(detected);
        setOcrTarget(targetType === "PAGE_CONTEXT" ? "STEM" : targetType);
        setOcrOptionLabel(needsOption ? optionLabel.toUpperCase() : "");
        setMessage(
          data.options?.length
            ? `OCR listo: ${data.options.length} opción(es) detectada(s). Revisa, elige el campo y asigna.`
            : detected
              ? "OCR listo. Revisa el texto, elige el campo y asigna."
              : data.warning || "El OCR no devolvió texto.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const ocrNeedsOption = ocrTarget === "OPTION";
  const canApplyOcr = !!ocr && (ocrNeedsOption ? !!ocrOptionLabel : ocrTarget === "OPTION_BLOCK" ? !!ocr.options?.length : !!ocrText.trim());

  // Apply the reviewed OCR to the chosen destination field, then clear the panel.
  function applyOcr() {
    if (!ocr || !canApplyOcr) return;
    onOcrText?.(
      { targetType: ocrTarget, optionLabel: ocrNeedsOption ? ocrOptionLabel.toUpperCase() : null },
      { text: ocrText, options: ocr.options },
    );
    const label = OCR_TARGETS.find((t) => t.value === ocrTarget)?.label ?? ocrTarget;
    setMessage(`Asignado a: ${label}${ocrNeedsOption ? ` ${ocrOptionLabel.toUpperCase()}` : ""}. Revisa y guarda.`);
    setOcr(null);
  }

  const hasPages = uniquePages.length > 0;
  return (
    <div className={className}>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={!hasPages}>
        Recortar región de la página
      </Button>
      {!hasPages && (
        <span className="ml-2 text-xs text-gray-400">No hay páginas con imagen para recortar en este lote.</span>
      )}

      {/* Nested Radix Dialog: when launched from inside another modal (the review
          dialog), Radix makes this the active layer — correct focus, pointer-events
          and stacking — instead of a body-portaled div that the parent modal makes
          inert. Also works standalone in the per-file wizard. */}
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setRect(null); setOcr(null); } }}>
        <DialogContent className="max-h-[92vh] max-w-3xl select-none gap-3 overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Recortar región de la página</DialogTitle>
            <DialogDescription className="sr-only">Elige una página, arrastra la región y usa Asignar u OCR.</DialogDescription>
          </DialogHeader>
          {imageSourceFileId && imageSourceFileId !== sourceFileId && (
            <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Este archivo no trae imágenes propias; se muestran las imágenes de página del archivo de origen del
              mismo lote. Elige la página en la tira de miniaturas, arrastra la región y usa Asignar u OCR.
            </p>
          )}

          {/* Page picker. Avoid loading every page as a thumbnail image at once —
              concurrent pdfplumber renders segfault the ingest process. Numbers
              only; the main viewer loads the selected page. */}
          {uniquePages.length > 1 && (
            <div className="flex flex-wrap gap-1.5 rounded border border-gray-200 bg-gray-50 p-2">
              {uniquePages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => changePage(p)}
                  disabled={busy !== null}
                  title={`Página ${p}`}
                  className={`min-w-8 rounded px-2 py-1 text-xs font-medium ${
                    p === pageNumber
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
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
            Arrastra sobre la imagen para seleccionar la región. Luego <strong>Asignar</strong> (guarda la imagen y la enlaza) u{" "}
            <strong>OCR</strong> (transcribe a texto para revisar).
          </p>

          <div className="max-h-[60vh] overflow-auto rounded border border-gray-300 bg-gray-100">
            <div
              ref={wrapperRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="relative inline-block cursor-crosshair select-none align-top"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={`/api/admin/ai-import/sources/${effectiveSourceId}/pages/${pageNumber}/image?dpi=150`}
                alt={`Página ${pageNumber}`}
                className="block max-w-full select-none"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onError={() => { setPageError(true); setImgLoaded(false); }}
                onLoad={() => { setPageError(false); setImgLoaded(true); }}
              />
              {!imgLoaded && !pageError && (
                <div className="flex h-40 min-w-[280px] items-center justify-center text-xs text-gray-400">Cargando página {pageNumber}…</div>
              )}
              {pageError && (
                <div className="flex h-40 min-w-[280px] items-center justify-center text-xs text-gray-400">
                  No se pudo cargar la página {pageNumber}.
                </div>
              )}
              {rect && imgLoaded && (
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

          {/* OCR review: shown after OCR — edit the detected text, choose the field, then assign. */}
          {ocr && (
            <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-blue-800">Texto detectado (OCR)</span>
                <button type="button" onClick={() => setOcr(null)} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">Descartar</button>
              </div>

              {ocr.options && ocr.options.length > 0 && (
                <div className="rounded border border-blue-100 bg-white p-2 text-xs text-gray-700">
                  <span className="font-medium text-gray-500">Opciones detectadas:</span>
                  <ul className="mt-1 space-y-0.5">
                    {ocr.options.map((o) => (
                      <li key={o.label}><span className="font-semibold">{o.label}.</span> {o.text || <em className="text-gray-400">(vacío)</em>}</li>
                    ))}
                  </ul>
                </div>
              )}

              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 p-2 text-sm"
                placeholder="Texto detectado…"
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600">Asignar a</span>
                <select
                  value={ocrTarget}
                  onChange={(e) => setOcrTarget(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {OCR_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {ocrNeedsOption && (
                  <Input
                    value={ocrOptionLabel}
                    onChange={(e) => setOcrOptionLabel(e.target.value.toUpperCase().slice(0, 1))}
                    placeholder="A–D"
                    className="w-16"
                  />
                )}
                <Button type="button" size="sm" onClick={applyOcr} disabled={!canApplyOcr}>
                  Asignar al campo
                </Button>
                {ocrTarget === "OPTION_BLOCK" && !ocr.options?.length && (
                  <span className="text-xs text-amber-600">No se detectaron opciones A–D en este recorte.</span>
                )}
              </div>
            </div>
          )}

          {message && <p className="text-xs text-gray-600">{message}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
