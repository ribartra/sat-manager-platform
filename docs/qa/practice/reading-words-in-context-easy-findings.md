# QA Reading Practice — Words in Context (EASY)

- **Fecha:** 2026-09-24
- **Dominio / Topic:** Craft and Structure › Words in Context
- **Alcance:** 1 set · 131 preguntas (todas MC, 4 opciones A–D)
- **Método:** QA read-only de Reading; `published` (stem/stimulus/options/correctAnswer) comparado contra `sourceText` (bloque exacto del PDF por pregunta) + ANS PDF (`Correct Answer:`) + render de páginas del PDF de ejercicios (150 dpi) para verificación visual.
- **Nota de diseño:** Words in Context tiene DOS variantes en este set:
  1. **Fill-in-the-blank** (104 preguntas): `stimulus` es NULL por diseño; el pasaje con el hueco `______` vive en el `stem`, seguido de "Which choice completes the text…". No se marca stimulus vacío aquí.
  2. **"Most nearly means"** (27 preguntas): el pasaje vive en `stimulus` y el `stem` es "As used in the text, what does the word "X" most nearly mean?". Estas son legítimas, no defectos.
- **Set:** `cmsjropq606apqmt1lr1zqtst` — "Craft and Structure - Words in Context - EASY" — status PUBLISHED.
- **Fuente:** `files_to_load/PRACTICE EXERCISES/EXERCISES READING/WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf` (+ `ANS WORDS CONTEXT EASY.pdf`).

## Hallazgos por set

### Words in Context - EASY (setId=cmsjropq606apqmt1lr1zqtst)

Comparación estricta (whitespace-normalizada) de `stimulus+stem` y de cada opción contra el bloque exacto de `sourceText`: **131/131 preguntas coinciden byte a byte a nivel de texto** (0 diferencias de stem, 0 de opciones, 0 de orden/conteo de etiquetas). Comillas tipográficas (' " ") y símbolo © preservados correctamente; sin caracteres de reemplazo ni mojibake en stem/stimulus/options/explanation. Ninguna fuga de etiqueta A–D, número de pregunta, anotación `[topic/answer]` ni chrome de UI. Render visual del PDF (pp. 1 y 4) confirma que `sourceText` es fiel al PDF.

Cross-check de clave de respuesta: **131/131 `correctAnswer` coinciden con el ANS PDF** (`Correct Answer:` por `Question ID`). 0 mismatches, 0 claves faltantes.

Suspects del pre-scan (`truncation_suspect`: seq 10,12,47,64,72,74,86,100,124) **revisados uno a uno = FALSOS POSITIVOS**: son la variante "most nearly means" (stimulus presente), con stem completo terminando en "?"; sin truncación.

- _(seq1-131 sin incidencias — 0 defectos de fidelidad de texto, opciones ni clave)_

**Observación (no defecto, no computada):** en las 27 preguntas de la variante "most nearly means", el PDF fuente **subraya** la palabra objetivo dentro del pasaje (p. ej. "disturbed" en seq 4). Ese subrayado se pierde tanto en `sourceText` (OCR) como en el `stimulus` publicado (no se aplicó la convención `++texto++`). Es cosmético y sistémico: la palabra objetivo siempre se nombra explícitamente en el `stem` entre comillas, por lo que la resolubilidad no se ve afectada. Se registra como nota, no como incidencia por-pregunta.

## Resumen de defectos

| clase | cantidad | severidad |
|---|---|---|
| (ninguna) | 0 | — |

**Total defectos: 0 / 131 preguntas.** Set limpio. Única nota sistémica cosmética: pérdida de subrayado de la palabra objetivo en la variante "most nearly means" (27 Q), sin impacto en resolubilidad.
