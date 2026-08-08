# Crop desde vista de PDF + asignar/OCR de imágenes en el review de ingesta

Feature: en el review de candidatos (dashboard por lote y wizard por archivo) poder
**ver la página del PDF**, **seleccionar una región (crop)** y decidir cómo
trabajarla: **ASIGNAR** la imagen recortada al enunciado / estímulo / una
alternativa (A–D) / campo de respuesta, o hacerle **OCR** para transcribirla a
texto. Debe ser **reutilizable** entre ambas superficies.

Referencias validadas: Next `app/admin/import/ai/**`, `lib/ingest-promotion.ts`,
`prisma/schema.prisma`; FastAPI `ingest_service/app/main.py`.

---

## 1. Qué ya existe (se reutiliza, no se reescribe)

- **Modelo de asociación**: `IngestCandidateImageLink` (schema L665-680) con
  `targetType ∈ {STEM, STIMULUS, OPTION, OPTION_BLOCK, ANSWER_FIELD, EXPLANATION,
  PAGE_CONTEXT}` + `optionLabel`. Rutas Next `candidates/[id]/image-links`
  GET/POST/DELETE. La promoción (`lib/ingest-promotion.ts:160-209`) ya materializa
  `question.imageUrl` y `option.imageUrl` desde esos links y copia el archivo a
  `public/uploads/questions`.
- **UI de link/unlink + "OCR Options"**: existe en el wizard
  (`review-client.tsx`, paso IMAGES L603-641) y en el dashboard
  (`ai-import-client.tsx` L1059-1131) — **duplicada**.
- **Servir imagen privada**: `assets/[batchId]/[fileName]/route.ts`. Regex de
  archivo: `^img_[a-f0-9]+-[a-f0-9]+\.(jpg|jpeg|png|webp)$` → **cualquier crop
  nuevo debe nombrarse `img_…` vía `save_ingest_image`** para ser servible.
- **Internos FastAPI listos**: `crop_pdf_image(path, page, bbox)` (main.py:808,
  recorta a JPEG en puntos PDF), `_render_page_as_image_document` (page→JPEG
  base64), `run_mistral_ocr_image` (OCR de base64), `save_ingest_image`,
  `insert_image_artifacts`, `resolve_existing_source_path`,
  `extract_options_from_image_ocr`.

## 2. Qué falta (lo que se construye)

1. **Render de página al navegador** (no existe; PAGES solo muestra texto).
2. **Endpoint de crop** que recorte por coordenadas y bifurque ASSIGN vs OCR
   (`crop_pdf_image` no está expuesto por HTTP; `parse-option-image` solo opera
   sobre artifacts ya guardados).
3. **UI de selección de región** (no hay cropper; `bboxJson` está pero sin uso).
4. **Componente compartido** para eliminar la duplicación.

---

## 3. Diseño

### 3.1 Modelo de coordenadas
El navegador envía un **bbox normalizado** `{x0,y0,x1,y1}` en `[0,1]` relativo a la
imagen de página mostrada (esquina sup-izq = 0,0). El servidor lo convierte a
puntos PDF multiplicando por `page.width`/`page.height`. Así es **independiente
del DPI y del zoom** del navegador. `crop_pdf_image` ya acepta puntos PDF.

### 3.2 FastAPI — endpoints nuevos (auth global por middleware, sin código extra)

**a) Render de página**
```
GET /sources/{source_file_id}/pages/{page_number}/image?dpi=150
→ 200 image/jpeg (bytes)   |   404 si no existe la página
```
Reusa la lógica de `_render_page_as_image_document` parametrizando el DPI (default
~150 para pantalla). Resuelve el PDF con `resolve_existing_source_path`.

**b) Crop + asignar/OCR**
```
POST /candidates/{candidate_id}/crop-region
body: {
  pageNumber: int,
  bbox: {x0,y0,x1,y1},          # normalizado [0,1]
  mode: "ASSIGN" | "OCR",
  targetType: "STEM"|"STIMULUS"|"OPTION"|"OPTION_BLOCK"|"ANSWER_FIELD"|"EXPLANATION",
  optionLabel?: "A"|"B"|"C"|"D" # requerido si targetType == OPTION
}
```
Pasos comunes: resolver PDF del candidato (`IngestSourceFile.path`), convertir
bbox a puntos PDF, `crop_pdf_image` → JPEG, `save_ingest_image(batchId,
new_id("img"), bytes)` → `INSERT IngestImageArtifact (origin='MANUAL_CROP',
bboxJson=<coords normalizadas+puntos>, pageNumber, fileUrl, contentHash, …)`.
- **mode=ASSIGN**: crear `IngestCandidateImageLink(targetType, optionLabel)`
  (upsert idempotente como en `parse_candidate_option_image`). Respuesta:
  `{imageArtifactId, fileUrl, link}`.
- **mode=OCR**: base64 del recorte → `run_mistral_ocr_image`. Si
  `targetType==OPTION_BLOCK`, además `extract_options_from_image_ocr` → `options[]`.
  Respuesta: `{imageArtifactId, fileUrl, text, options?}`. **No** modifica el
  candidato: el texto vuelve al front para revisión (decisión de producto).

### 3.3 Next.js — proxies (guard `requireTeacherOrAdmin`)
- `GET /api/admin/ai-import/sources/[sourceFileId]/pages/[pageNumber]/image`
  → proxya el render, hace stream del JPEG con `Cache-Control: private`.
- `POST /api/admin/ai-import/candidates/[candidateId]/crop-region`
  → proxya crop-region vía `@/lib/internal-ingest`. Devuelve el JSON tal cual.
El crop-region (ASSIGN) escribe el link en FastAPI (tiene acceso a la misma DB),
igual que hoy `parse-option-image`.

### 3.4 Frontend — componentes compartidos (nuevos, en `app/admin/import/ai/_components/`)
- **`candidate-image-panel.tsx`** (client): encapsula la lista de thumbnails +
  link/unlink + "OCR Options" (mueve la lógica hoy duplicada) y **monta el
  cropper**. Props: `{ batchId, candidateId, sourceFileId, pageNumber, images,
  links, onLinksChanged, onApplyText(target, text|options) }`.
- **`pdf-page-cropper.tsx`** (client): muestra la imagen de página (del endpoint
  de render), permite navegar páginas del archivo, arrastrar un rectángulo
  (guarda coords normalizadas), elegir **target** (enunciado / estímulo / opción
  A–D / respuesta) y **modo** (Asignar / OCR), y hace POST a `crop-region`.
  - ASSIGN → refresca links (`onLinksChanged`).
  - OCR → llama `onApplyText(target, text|options)`: el editor coloca el texto en
    el campo destino **editable**; el revisor confirma y guarda con el PATCH de
    candidato existente. (No auto-aplica.)

### 3.5 Integración en las dos superficies
- **Wizard** (`review-client.tsx`): el paso IMAGES usa `CandidateImagePanel`;
  `onApplyText` escribe en `draft.stem` / `draft.optionsJson` / `draft.correctAnswer`.
- **Dashboard** (`ai-import-client.tsx`, `QuestionStagingEditor`): mismo panel;
  `onApplyText` escribe en las filas de opción / stem / answer del `draft`.
Ambos ya cargan `images` y `links`; solo cambian el render del panel.

---

## 4. Esquema / datos
- **Sin migración**: `origin` es texto libre (ya se usan PDFPLUMBER/MISTRAL_OCR/
  DOCX_MEDIA); se agrega `MANUAL_CROP`. `bboxJson` ya existe para trazabilidad.
- Filenames de crop **deben** empezar con `img_` (regex del assets route).

## 5. Seguridad
- Ambos proxies bajo `requireTeacherOrAdmin`; el token interno nunca sale al
  navegador. El render lee solo PDFs de `IngestSourceFile` del batch. El
  assets route ya valida path-traversal.

## 6. Orden de implementación (por partes)
1. FastAPI: render de página + `crop-region` (+ helper de conversión de bbox).
2. Next: los dos proxies.
3. UI: `pdf-page-cropper` + `candidate-image-panel` (con la lógica de link/OCR
   migrada), sin cablear aún.
4. Cablear en wizard y dashboard (dedupe).
5. Verificación: typecheck/lint; prueba manual de asignar un crop a una opción y
   de OCR de un crop de enunciado; confirmar que promociona con `imageUrl`.

## 7. Fuera de alcance (siguiente)
- Materializar automáticamente las 21 preguntas "needs figure" restantes usando
  este mismo crop (se puede, pero requiere identificar la región por pregunta).
- Rotar/ajustar contraste del recorte antes de OCR.
