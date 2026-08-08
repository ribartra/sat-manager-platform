# Integración de la 2.ª capa de OCR en la ingesta (práctica)

Documento de diseño para llevar lo que hoy hacemos con scripts one-off
(`scripts/reocr_*.{py,mjs}`) al servicio de ingesta, de modo que **futuras
ingestas de práctica ya salgan con el OCR correcto** sin parche manual.

Todas las referencias de línea son sobre `ingest_service/app/main.py` salvo que se
indique otro archivo. Validado contra el código en `feat/parent-reports-smtp-taxonomy`.

---

## 1. Estado actual del código (validado)

Flujo por página en `_process_batch` (L4663+):

1. **Decisión de OCR forzado** (L4734):
   ```python
   force_ocr = path.suffix.lower() == ".pdf" and source["sourceKind"] == "MOCK_EXAM"
   ```
2. **Extracción** (L4735): `extract_pdf_text(path, force_ocr)` (L1963).
   - Si `force_ocr` → devuelve la página con `text=""`, `requiresOcr = not is_blank`
     (L1990-2003): **descarta el texto de pdfplumber y obliga a OCR**.
   - Si no → `requiresOcr = density < TEXT_DENSITY_THRESHOLD and not is_blank`
     (L2019). `TEXT_DENSITY_THRESHOLD = 120` (env `INGEST_TEXT_DENSITY_THRESHOLD`, L128).
3. **OCR con caché** (L4773-4804): si `requiresOcr` y es PDF, primero mira
   `IngestOcrCache` (L4774); solo llama a Mistral si no hay caché (L4787). El
   resultado se guarda en `IngestOcrCache` (L4794) y la página queda `MISTRAL_OCR`.
   Si Mistral no devuelve texto → `method='OCR_REQUIRED'` + incidente `PAGE_OCR_REQUIRED`.
4. **Parseo a candidatos** (L4887): `make_candidates_from_text` → `make_candidate_from_text`
   (L2340) → para bloques con `Question ID` usa **`parse_practice_block`**
   (`app/practice_repair.py:112`).

### El parser YA soporta el formato sin encabezados

`parse_practice_block` (practice_repair.py L112) no exige el formato rico
(`# Question / # Answer / # Correct Answer / # Rationale`):

- El inicio del enunciado cae tras el encabezado `# Question` **o**, si no existe,
  tras las líneas de ruido `ID: / Assessment / SAT…` (L132-138).
- El inicio de las alternativas cae tras `# Answer` **o**, si no existe, en la
  **primera línea `A.` que arranca una corrida A–D** (L142-152).

Es decir, el formato real de estos PDFs de práctica
(`ID: xxxx` / enunciado / `A. B. C. D.`) **se parsea bien** — siempre que el texto
de entrada sea el del OCR y no el de pdfplumber.

> Conclusión: **no hace falta tocar el parser.** El parser Node
> `scripts/reocr_reparse_cached.mjs` que usamos para el repair reimplementa esta
> misma lógica en el host; el del servicio es equivalente.

---

## 2. El gap a cubrir

**Los PDFs de práctica nunca fuerzan OCR** porque la condición de L4734 solo
incluye `MOCK_EXAM`. Los archivos de pregunta de práctica llevan
`sourceKind = "PRACTICE_EXERCISE"` (L1134).

Y el umbral de densidad **no los rescata**: en estas páginas la matemática del
enunciado y los valores de las opciones son **glifos vectoriales** que pdfplumber
no extrae, pero la prosa que sí extrae ("Which expression is equivalent to…",
"What is the value of b?") supera `TEXT_DENSITY_THRESHOLD=120`. Resultado:
`requiresOcr = False` → la página se guarda como `PDF_TEXT` con la mate y las
opciones perdidas → el parser (correcto) recibe basura → candidato roto.

**Impacto medido** (local, este batch): 303 preguntas de práctica MC promovidas
quedaron rotas (`<4` opciones de texto) exactamente por esto. La reparación con
OCR + re-parseo las vuelve contestables (~75% a texto; el resto necesita
materializar figura/tabla).

---

## 3. Lógica a añadir

### 3.1 (Principal) Forzar OCR también para preguntas de práctica

Convertir la lista de `sourceKind` que fuerzan OCR en configurable y añadir
`PRACTICE_EXERCISE`:

- **Config** (`IngestConfig`, L115-132): nuevo campo `force_ocr_source_kinds`
  desde env `INGEST_FORCE_OCR_SOURCE_KINDS` (default `"MOCK_EXAM,PRACTICE_EXERCISE"`).
- **Global** (junto a L136-138): `FORCE_OCR_SOURCE_KINDS = CONFIG.force_ocr_source_kinds`.
- **Gate** (L4734):
  ```python
  force_ocr = path.suffix.lower() == ".pdf" and source["sourceKind"] in FORCE_OCR_SOURCE_KINDS
  ```

**Por qué es seguro / barato:**
- La caché (L4774) evita re-cobrar: una re-ingesta del mismo contenido reutiliza
  `IngestOcrCache`; solo la primera ingesta paga el OCR.
- No hay regresión para R&W de práctica: Mistral OCR también transcribe bien la
  prosa, así que descartar el texto de pdfplumber en esas páginas no degrada nada.
- Es **opt-out**: poner `INGEST_FORCE_OCR_SOURCE_KINDS=MOCK_EXAM` restaura el
  comportamiento anterior si el costo fuese un problema.
- **No** incluimos `ANSWER_KEY` / `ANSWER_EXPLANATION` (los answer keys son otro
  track; su re-OCR se decide aparte).

Esto cubre nativamente justo lo que hoy hacemos a mano con
`scripts/reocr_fetch.py` + `scripts/reocr_reparse_cached.mjs`.

### 3.2 (Opcional, red de seguridad) Fallback por opciones no detectadas

Aun con OCR, alguna página de MC podría quedar sin 4 opciones (opción en
tabla/figura). Hoy eso ya se marca: `make_candidate_from_text` baja la confianza y
deja `status='NEEDS_REVIEW'` cuando `len(options) not in {0,4}` o
`image_backed_options` (L2385-2393). No requiere cambio; solo conviene
**documentar** que esos candidatos son el bucket "necesita figura" y se resuelven
materializando la imagen (fase aparte).

### 3.3 (Opcional, deuda) `retry_ocr_required` regenera candidatos

`retry_ocr_required` (L4314) solo toma páginas `method='OCR_REQUIRED'` y
**recrea** candidatos, lo que perdería el vínculo `officialQuestionId` y
duplicaría si ya se promovió. Para **re-OCR de contenido ya promovido** el patrón
correcto (el que usan nuestros scripts) es: OCR → parsear → **UPDATE del candidate
existente** por `questionExternalId` → empujar a la `Question` vía
`officialQuestionId`. Queda como mejora futura; no se toca ahora (riesgo alto,
fuera del alcance de "que futuras ingestas salgan bien").

---

## 4. Alcance de esta integración

- **Se implementa ahora:** 3.1 (forzar OCR para `PRACTICE_EXERCISE`, configurable).
- **Se documenta, no se toca:** 3.2 (ya cubierto por el estado de review) y 3.3
  (deuda del path de re-OCR de contenido promovido).
- **Verificación sugerida:** re-ingestar un PDF de práctica math en un batch de
  prueba y confirmar que la página sale `MISTRAL_OCR` y el candidato trae stem +
  4 opciones (o `NUMERIC` sin opciones) con `status='READY'`.
