"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type MergeCandidate = {
  id: string;
  questionNumber: number | null;
  questionExternalId: string | null;
  stem: string | null;
  stimulus: string | null;
  optionsJson: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  difficulty: string | null;
  topicName: string | null;
  promotionStatus: string;
  officialQuestionId: string | null;
};

export type MergeImageLink = {
  id: string;
  candidateId: string;
  imageArtifactId: string;
  targetType: string;
  optionLabel: string | null;
  sortOrder: number;
};

export type MergeImageArtifact = {
  id: string;
  pageNumber: number;
  fileUrl: string | null;
  base64Data: string | null;
  mimeType: string | null;
};

type FieldKey = "stem" | "stimulus" | "optionsJson" | "correctAnswer" | "explanation" | "difficulty" | "topicName";

const FIELDS: { key: FieldKey; label: string; multiline: boolean; mono?: boolean; math?: boolean }[] = [
  { key: "stem", label: "Enunciado", multiline: true, math: true },
  { key: "stimulus", label: "Estímulo", multiline: true, math: true },
  { key: "optionsJson", label: "Opciones (JSON)", multiline: true, mono: true },
  { key: "correctAnswer", label: "Respuesta", multiline: false },
  { key: "explanation", label: "Explicación", multiline: true, math: true },
  { key: "difficulty", label: "Dificultad", multiline: false },
  { key: "topicName", label: "Skill", multiline: false },
];

const IMAGE_TARGETS = [
  { value: "STEM", label: "Imagen de enunciado" },
  { value: "STIMULUS", label: "Imagen de estímulo" },
  { value: "OPTION", label: "Imagen de una opción" },
  { value: "OPTION_BLOCK", label: "Bloque de opciones" },
  { value: "ANSWER_FIELD", label: "Campo de respuesta" },
  { value: "EXPLANATION", label: "Imagen de explicación" },
  { value: "PAGE_CONTEXT", label: "Contexto de página" },
];

function imageSrc(image: MergeImageArtifact | undefined) {
  if (!image) return null;
  if (image.fileUrl) return image.fileUrl;
  if (image.base64Data) return `data:${image.mimeType ?? "image/png"};base64,${image.base64Data}`;
  return null;
}

function labelFor(candidate: MergeCandidate) {
  const num = candidate.questionNumber != null ? `Q${candidate.questionNumber}` : "Q?";
  const snippet = (candidate.stem ?? candidate.questionExternalId ?? "").replace(/[\n\r]/g, " ").slice(0, 40);
  return `${num} · ${snippet || "sin texto"}`;
}

type Choice = "A" | "B" | "custom";

interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
  candidates: MergeCandidate[];
  imageLinks: MergeImageLink[];
  images: MergeImageArtifact[];
  initialCandidateId: string;
  onMerged: (survivorId: string, warnings: string[]) => void;
}

export function MergeDialog({ open, onClose, candidates, imageLinks, images, initialCandidateId, onMerged }: MergeDialogProps) {
  const candA = candidates.find((c) => c.id === initialCandidateId) ?? null;
  const others = candidates.filter((c) => c.id !== initialCandidateId);

  const [otherId, setOtherId] = useState(others[0]?.id ?? "");
  const candB = candidates.find((c) => c.id === otherId) ?? null;

  // Which side survives (becomes the target). Default: the one that has a
  // questionNumber (the fragment usually has none).
  const defaultSurvivor: "A" | "B" =
    candA?.questionNumber != null || candB?.questionNumber == null ? "A" : "B";
  const [survivor, setSurvivor] = useState<"A" | "B">(defaultSurvivor);

  const [choice, setChoice] = useState<Record<FieldKey, Choice>>({} as Record<FieldKey, Choice>);
  const [custom, setCustom] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [imgInclude, setImgInclude] = useState<Record<string, boolean>>({});
  const [imgTarget, setImgTarget] = useState<Record<string, { targetType: string; optionLabel: string }>>({});
  const [cleanup, setCleanup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linksFor = useMemo(() => {
    const map = new Map<string, MergeImageLink[]>();
    for (const link of imageLinks) {
      const list = map.get(link.candidateId) ?? [];
      list.push(link);
      map.set(link.candidateId, list);
    }
    return map;
  }, [imageLinks]);

  // Reset field/image defaults whenever the pairing changes. React supports
  // adjusting state during render as long as it is guarded to avoid loops —
  // this is the recommended alternative to a state-setting effect.
  const pairingKey = candA && candB ? `${candA.id}|${candB.id}|${survivor}` : "";
  const [appliedKey, setAppliedKey] = useState("");
  if (candA && candB && pairingKey !== appliedKey) {
    const nextChoice = {} as Record<FieldKey, Choice>;
    const nextCustom = {} as Record<FieldKey, string>;
    const survivorCand = survivor === "A" ? candA : candB;
    const otherCand = survivor === "A" ? candB : candA;
    for (const field of FIELDS) {
      const sVal = (survivorCand[field.key] ?? "").toString().trim();
      const oVal = (otherCand[field.key] ?? "").toString().trim();
      // Prefer the survivor's value when it has content, else pull the other side's.
      const pickSurvivor = sVal.length > 0 || oVal.length === 0;
      const side: Choice = pickSurvivor ? survivor : survivor === "A" ? "B" : "A";
      nextChoice[field.key] = side;
      nextCustom[field.key] = (candA[field.key] ?? candB[field.key] ?? "").toString();
    }
    const include: Record<string, boolean> = {};
    const targets: Record<string, { targetType: string; optionLabel: string }> = {};
    for (const link of [...(linksFor.get(candA.id) ?? []), ...(linksFor.get(candB.id) ?? [])]) {
      include[link.id] = true;
      targets[link.id] = { targetType: link.targetType, optionLabel: link.optionLabel ?? "" };
    }
    setChoice(nextChoice);
    setCustom(nextCustom);
    setImgInclude(include);
    setImgTarget(targets);
    setCleanup(otherCand.promotionStatus === "PROMOTED");
    setError(null);
    setAppliedKey(pairingKey);
  }

  if (!candA) return null;

  const survivorCand = survivor === "A" ? candA : candB;
  const sourceCand = survivor === "A" ? candB : candA;

  function valueFor(field: FieldKey): string {
    const c = choice[field] ?? "A";
    if (c === "custom") return custom[field] ?? "";
    const cand = c === "A" ? candA : candB;
    return (cand?.[field] ?? "").toString();
  }

  const combinedLinks = candB ? [...(linksFor.get(candA.id) ?? []), ...(linksFor.get(candB.id) ?? [])] : [];

  async function handleMerge() {
    if (!candB || !survivorCand || !sourceCand) return;
    setSubmitting(true);
    setError(null);
    const resolved: Record<string, string> = {};
    for (const field of FIELDS) resolved[field.key] = valueFor(field.key);
    const finalLinks = combinedLinks
      .filter((link) => imgInclude[link.id])
      .map((link, index) => ({
        imageArtifactId: link.imageArtifactId,
        targetType: imgTarget[link.id]?.targetType ?? link.targetType,
        optionLabel: (imgTarget[link.id]?.targetType ?? link.targetType) === "OPTION" ? imgTarget[link.id]?.optionLabel || null : null,
        sortOrder: index,
      }));

    try {
      const res = await fetch(`/api/admin/ai-import/candidates/${survivorCand.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: sourceCand.id,
          resolved,
          imageLinks: finalLinks,
          sourceOutcome: "REJECT",
          cleanupSourcePromotion: cleanup,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "No se pudo fusionar.");
        setSubmitting(false);
        return;
      }
      onMerged(survivorCand.id, Array.isArray(data?.warnings) ? data.warnings : []);
    } catch {
      setError("Error de red al fusionar.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fusionar preguntas detectadas</DialogTitle>
          <DialogDescription>
            Resuelve cada componente eligiendo un lado o una copia personalizada. La pregunta sobreviviente conserva el
            resultado consolidado; la otra se retira.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">Fusionar con</span>
            <select
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {others.length === 0 && <option value="">No hay otras preguntas</option>}
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {labelFor(c)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-gray-500">¿Cuál sobrevive?</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={survivor === "A" ? "primary" : "secondary"} onClick={() => setSurvivor("A")}>
                Izquierda: {candA.questionNumber != null ? `Q${candA.questionNumber}` : "Q?"}
              </Button>
              <Button type="button" size="sm" variant={survivor === "B" ? "primary" : "secondary"} onClick={() => setSurvivor("B")} disabled={!candB}>
                Derecha: {candB?.questionNumber != null ? `Q${candB.questionNumber}` : "Q?"}
              </Button>
            </div>
          </div>
        </div>

        {candB ? (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs font-medium">
              <div className="rounded bg-blue-50 px-3 py-1.5 text-blue-900">
                Izquierda · {labelFor(candA)} {survivor === "A" && <Badge variant="success">sobrevive</Badge>}
              </div>
              <div className="rounded bg-amber-50 px-3 py-1.5 text-amber-900">
                Derecha · {labelFor(candB)} {survivor === "B" && <Badge variant="success">sobrevive</Badge>}
              </div>
            </div>

            <div className="space-y-4">
              {FIELDS.map((field) => {
                const c = choice[field.key] ?? "A";
                const aVal = (candA[field.key] ?? "").toString();
                const bVal = (candB[field.key] ?? "").toString();
                return (
                  <div key={field.key} className="rounded-md border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800">{field.label}</span>
                      <div className="flex gap-1">
                        {(["A", "B", "custom"] as Choice[]).map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            size="sm"
                            variant={c === opt ? "primary" : "secondary"}
                            onClick={() => setChoice((prev) => ({ ...prev, [field.key]: opt }))}
                          >
                            {opt === "A" ? "Izq." : opt === "B" ? "Der." : "Personalizado"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setChoice((prev) => ({ ...prev, [field.key]: "A" }))}
                        className={`rounded border p-2 text-left text-xs ${c === "A" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
                      >
                        {field.math && aVal ? <MathContent content={aVal} className="text-sm" /> : <span className="whitespace-pre-wrap break-words text-gray-700">{aVal || "—"}</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoice((prev) => ({ ...prev, [field.key]: "B" }))}
                        className={`rounded border p-2 text-left text-xs ${c === "B" ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                      >
                        {field.math && bVal ? <MathContent content={bVal} className="text-sm" /> : <span className="whitespace-pre-wrap break-words text-gray-700">{bVal || "—"}</span>}
                      </button>
                    </div>
                    {c === "custom" &&
                      (field.multiline ? (
                        <textarea
                          value={custom[field.key] ?? ""}
                          onChange={(e) => setCustom((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className={`mt-2 min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${field.mono ? "font-mono text-xs" : ""}`}
                        />
                      ) : (
                        <Input
                          value={custom[field.key] ?? ""}
                          onChange={(e) => setCustom((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="mt-2"
                        />
                      ))}
                  </div>
                );
              })}
            </div>

            {combinedLinks.length > 0 && (
              <div className="rounded-md border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-800">Imágenes de ambas fuentes</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {combinedLinks.map((link) => {
                    const image = images.find((img) => img.id === link.imageArtifactId);
                    const src = imageSrc(image);
                    const fromSide = link.candidateId === candA.id ? "Izq." : "Der.";
                    const t = imgTarget[link.id] ?? { targetType: link.targetType, optionLabel: link.optionLabel ?? "" };
                    return (
                      <div key={link.id} className={`rounded-md border p-2 ${imgInclude[link.id] ? "border-blue-300 bg-blue-50" : "border-gray-200 opacity-60"}`}>
                        <div className="h-28 overflow-hidden rounded bg-white">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={`p.${image?.pageNumber ?? "?"}`} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">Sin vista previa</div>
                          )}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={imgInclude[link.id] ?? false}
                            onChange={(e) => setImgInclude((prev) => ({ ...prev, [link.id]: e.target.checked }))}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          Incluir · <span className="text-gray-400">{fromSide} p.{image?.pageNumber ?? "?"}</span>
                        </label>
                        <select
                          value={t.targetType}
                          onChange={(e) => setImgTarget((prev) => ({ ...prev, [link.id]: { ...t, targetType: e.target.value } }))}
                          className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                          disabled={!imgInclude[link.id]}
                        >
                          {IMAGE_TARGETS.map((target) => (
                            <option key={target.value} value={target.value}>
                              {target.label}
                            </option>
                          ))}
                        </select>
                        {t.targetType === "OPTION" && (
                          <Input
                            value={t.optionLabel}
                            onChange={(e) => setImgTarget((prev) => ({ ...prev, [link.id]: { ...t, optionLabel: e.target.value.toUpperCase() } }))}
                            placeholder="Letra (A-D)"
                            className="mt-1"
                            disabled={!imgInclude[link.id]}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sourceCand && sourceCand.promotionStatus === "PROMOTED" && sourceCand.officialQuestionId && (
              <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                Eliminar también la pregunta oficial huérfana ya promovida (solo si es borrador sin intentos).
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-gray-500">No hay otra pregunta en este archivo para fusionar.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleMerge} disabled={submitting || !candB}>
            {submitting ? "Fusionando…" : `Fusionar en ${survivorCand?.questionNumber != null ? `Q${survivorCand.questionNumber}` : "Q?"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
