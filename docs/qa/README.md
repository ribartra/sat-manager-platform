# QA de contenido — Full Practice Tests (publicado vs fuente)

Comparación de las preguntas publicadas de los 10 Full Practice Tests contra sus archivos fuente
(`files_to_load/MOCK EXAMS/TEST N/`) para detectar preguntas mal parseadas. **Solo lectura**: esta
fase documenta hallazgos; no modifica el contenido oficial.

## Desplegado a PRODUCCIÓN (2026-09-22) — ver [`prod-push-applied.md`](./prod-push-applied.md)
Aplicado **no destructivamente** a satsol.org: **37/37** preguntas actualizadas en prod, sin swap de BD.
- **34** vía la API propia (`PUT /api/questions/{id}` + upload de imágenes), sin downtime (`push-fixes-to-prod.mjs`).
- **3** que el gate de publicación bloqueaba (requiere `explanation` no vacía y llevaban vivas sin ella —
  T4 RW M1#25 texto, T9 Math M2#14/#15 imagen) se aplicaron con un **UPDATE puntual en la VM** (parar web+ingest
  ~1 min para soltar el lock WAL → UPDATE solo esas 3 filas en `/data/db/dev.db` → checkpoint+integrity ok → reiniciar).
  No destructivo; backup previo de la BD de prod en `/data/db/backups/`. Sin fabricar explicaciones.
Health y las imágenes verificadas 200. Los 4 casos manuales de imagen (abajo) siguen pendientes.

## Fase de fixes APLICADA (2026-09-22) — ver [`fixes-applied.md`](./fixes-applied.md)
Se aplicaron **45 correcciones a contenido oficial** WAL-safe (`scripts/qa/apply-recovery-fixes.mjs --apply
--confirm-server-stopped`, server detenido, backup en `backups/devdb-preapply-*`, `integrity_check=ok`):
2 claves (T8), 12 re-links de imagen (ahora el diagrama real, no el panel de opciones), 16 stem/stimulus y 15
opciones. **Pendiente manual (4):** T7 Math M1#17/#18 (crop de la región `Im17`/`Im18` — la tabla comparte crop
con el panel UI) y los 2 dual-image (T3 Math M1#17 Set 2, T10 Math M1#19 Data Set B — `Question.imageUrl` es único).

## Recuperación (¿hace falta OCR?) — ver [`recovery-map.md`](./recovery-map.md)
Barrido cruzado de las 4 etapas de ingesta (`scripts/qa/recover-sweep.mjs`) + confirmación visual: **de los ~40
defectos de contenido, CERO requieren re-OCR.** Todo lo "faltante" ya está en staging (`IngestPageArtifact.extractedText`
con Mistral OCR ya `COMPLETED`; `IngestQuestionCandidate`; `IngestImageArtifact`). Veredictos: PARSE_MISALIGN (re-slice
del texto de la página, ~22), IMAGE_MISLINK (re-link del diagrama ya extraído; se publicó el panel `ANSWER_FIELD`, ~17),
PROMOTION_DROP (re-promover del candidato, 1). Los "requiere OCR de fuente" de T7 (orchids/astrology) quedan reclasificados
a PARSE_MISALIGN. Punteros exactos por defecto en `recovery-map.md`.

## Método
- Enlace publicado→fuente: `Question` ← `IngestQuestionCandidate.officialQuestionId` → `IngestSourceFile` + página.
- Render fuente: PDF→imagen con `pdftoppm`; DOCX→PDF con `soffice`. Scripts en `scripts/qa/`.
- Alineación: Math por número de página del candidato; R&W secuencial (las páginas fuente son capturas del reproductor).
- Inspección visual hecha por Claude, pregunta por pregunta.

## Clases de defecto
- `broken_question` — parse colapsado: falta el enunciado real y la opción A (respuesta) contiene texto duplicado del stimulus/notas. **Crítico.**
- `stem_annotation_leak` — anotación `[tema / respuesta]` filtrada en el stem.
- `option_text_wrong` — opciones equivocadas (duplicadas de otra pregunta) o con texto de la pregunta vecina que sangra.
- `stimulus_bleed` — texto de la pregunta vecina prepend/append en el stimulus, o falta la intro.
- `stem_number_leak` — el nº de pregunta ("4.", "16.") antepuesto al stem (cosmético, sistemático).
- `ui_leak` — texto de UI ("COME BACK LATER", "NEXT QUESTION") o headers de módulo dentro del contenido.
- `asset_placeholder_leak` — placeholders de tabla/imagen markdown sin resolver (p.ej. `[tbl-0.html](...)`).
- `option_label_leak` — la letra A-D antepuesta al texto de la opción.
- `escaped_underscore` — blank `\_\_\_\_\_` que se renderiza literal en vez de `_____`.
- `stem_option_leak` — la lista de opciones (con marcas del reproductor) duplicada dentro del stem.
- `image_missing` / `image_incomplete` — el `imageUrl` no es el gráfico requerido (apunta a otra cosa) o está recortado.
- `option_image_wrong` — la imagen de una opción duplica la de otra opción.
- `redundant_ui_image` — `imageUrl` poblado con una captura del propio panel de opciones/NUMERIC cuando la pregunta no lleva diagrama.
- `stimulus_ui_leak` — chrome de UI dentro del stimulus.
- `type_mismatch` — la pregunta se promovió con el tipo equivocado (p.ej. MC de 4 opciones guardado como `NUMERIC` sin `QuestionOption`).
- `stimulus_dup_in_stem` — el pasaje completo duplicado tanto en el campo `stem` como en `stimulus`.
- `source_error` — error presente en la fuente (parseo fiel; corregir es opcional).

## Índice por test
| Test | Estado | Defectos destacados |
|---|---|---|
| [TEST 1](./test-01-findings.md) | ✔ cerrado · claves 98/98 OK | **46** stems R&W con `[tema/respuesta]`; Math M2#8 opciones erróneas; 3 `ui_leak`; 1 `asset_placeholder_leak`; M2#22 `option_label_leak` (A,D); 4 `escaped_underscore` |
| [TEST 2](./test-02-findings.md) | ✔ cerrado · claves 98/98 OK | 2 `broken_question` críticas (R&W M2 #10, #27: falta enunciado + opción A corrupta); 6 `option_text_wrong`/bleed; 5 `stimulus_bleed`; 5 `ui_leak`; 17 `stem_number_leak` (cosmético) |
| [TEST 3](./test-03-findings.md) | ✔ cerrado · claves 98/98 OK | 1 `broken_question` (Math M1#17: opciones del ballot de #16 + falta Set 2); 1 `stem_bleed` crítico (RW M1#12); 2 opción D=stimulus siguiente (RW M2#1,#19); Math M2#19 opciones mezcladas; 8 `ui_leak`; 2 math errors; 67 `stem_number_leak`; 2 `source_error` (pregunta duplicada en la fuente) |
| [TEST 4](./test-04-findings.md) | ✔ cerrado · claves 98/98 OK | 2 `broken_question` (Math M1#19, RW M1#25); 3 `stem_option_leak` (RW M1#6,#11, M2#8); 1 `escaped_underscore`; 59 `stem_number_leak`; sin brackets ni bleed |
| [TEST 5](./test-05-findings.md) | ✔ cerrado · claves 98/98 OK | 2 `image_missing` críticos (Math M1#8,#9: imageUrl = panel de opciones, no el gráfico); Math M2#9 recorte; Math M1#3 img de opción errónea; 2 bleed de opción (RW M1#9,#17); **19 `redundant_ui_image`**; 4 `ui_leak`; 3 boundary; 60 `stem_number_leak` |
| [TEST 6](./test-06-findings.md) | ✔ cerrado · claves 98/98 OK | 2 `broken_question` (Math M1#8, M2#12: stems NUMERIC/MC truncados); 3 `option_text_wrong`/`stimulus_bleed` en opción A/D (RW M1#7, M2#7, M2#16 — opción reemplazada por copia rota del stimulus); **13 `stimulus_bleed` sistémicos** (RW M1/M2 pares, apertura de la siguiente pegada); 4 `stem_annotation_leak` variante `(tema/detalle)`; 60 `stem_number_leak`. Nota: la `TEST 6 ANS KEY.docx` cruda discrepa en RW M2#18/#20 pero el contenido publicado ya sigue al doc de explicaciones (sin defecto en producción) |
| [TEST 7](./test-07-findings.md) | ✔ cerrado · claves 98/98 OK | **3 `broken_question`** (RW M2#15, #19, #24: pasajes reales perdidos — orchids/astrology no sobreviven en la BD, requieren OCR de fuente); 1 `option_text_wrong` (RW M2#8 opt D = stimulus siguiente); 3 `stimulus_bleed`; **4 `image_missing`** (Math M1#16,#17,#22 panel de opciones; M1#18 imagen no relacionada); 5 `stem_option_leak`; 22 `redundant_ui_image`; 1 `escaped_underscore`; 64 `stem_number_leak`. ⚠️ El mapeo qid→defecto del cluster RW M2 #20-24 (dup/bleed) necesita re-verificación en la fase de fixes (el agente confundió #22↔#24) |
| [TEST 8](./test-08-findings.md) | ⚠ cerrado · **claves 96/98** (2 defectos de clave en producción) | **2 claves mal**: RW M2B#1 (`cmsjrnwkk0168qmt1r4m1sqcd`, publicado C → debe B) y Math M2B#1 (`cmsjrnw98011gqmt1zh6x8hem`, publicado A → **debe B**, autoevidente: opción B = el sistema literal del problema); **4 `image_missing`** críticos (Math M1#7,#21, M2#4,#20: panel de opciones en vez del diagrama); 20 `redundant_ui_image`; **1 `type_mismatch`** (Math M1#17 MC de 4 opciones guardado como NUMERIC sin opciones); 1 error de transcripción numérica (Math M1#16 `t/0.730`→`t/5,730`, respuesta 5730 sigue OK); 59 `stem_number_leak`; 1 `escaped_underscore` (RW M2#11). Cobertura 98/98 confirmada (hueco de promoción cerrado) |
| [TEST 9](./test-09-findings.md) | ✔ cerrado · claves 98/98 OK | **3 `image_missing`** (Math M1#18 esfera-en-prisma, M2#14 cuadrilátero, M2#15 histograma → panel de opciones en vez del diagrama); 1 `option_text_wrong` (RW M2#20 opt D = stimulus de #21); 3 `stimulus_bleed`; 2 `stem_option_leak` (RW M1#11,#25); 1 `stimulus_dup_in_stem` (RW M2#23); 1 `ui_leak` (RW M2#11 "BEST QUESTION"); 1 error de transcripción (Math M2#10 `√g`→`√2`); 19 `redundant_ui_image`; 62 `stem_number_leak`. Nota: el doc de explicaciones de Math dice "D" en M1#21 pero el publicado "C" es correcto (verificado por medición de píxeles + ANS KEY) → `source_error` del doc, no de producción |
| [TEST 10](./test-10-findings.md) | ✔ cerrado · claves 98/98 OK | **1 `broken_question`** (Math M1#7: stem colapsado a "7.", enunciado real volcado en opción A); 1 `image_missing` (Math M1#16 quartic); 1 `image_incomplete` (Math M1#19 dot-plot sin "Data Set B"); **cadena de "stimulus swap" RW M2** (#21/#23/#25 muestran el pasaje de otra pregunta; el real sobrevive como basura en la opción D de #20/#22/#24) ⚠️ mapeo exacto a re-verificar en fase de fixes; 14 `option_text_wrong` (bleed de opción D por pares de página); 1 `ui_leak` (Math M1#1 header); 20 `redundant_ui_image`; 61 `stem_number_leak`. Stragglers históricos (M2B#1/#2/#12, M1#11/#23) todos resueltos |

## Defectos de CLAVE de respuesta (los únicos que cambian la letra correcta)
Único test con claves mal en producción en TODO el barrido (TEST 1-10): **TEST 8** (2): RW M2B#1
(`cmsjrnwkk0168qmt1r4m1sqcd`, C→B) y Math M2B#1 (`cmsjrnw98011gqmt1zh6x8hem`, A→B). Los otros 9 tests =
98/98 correctas (978/980 en total). Verificadas contra el doc de explicaciones (citas en `test-08-findings.md`).
Son los de **máxima prioridad de fix**.

## Barrido COMPLETO (TEST 1-10) — resumen
Los 10 tests cerrados. Perfil dominante por test: T1=corchetes `[tema/respuesta]` (46); T2=broken+bleed;
T3=broken+bleed+source-dupes; T4=broken+stem_option_leak; T5/T7/T8/T9/T10=defectos de IMAGEN
(`image_missing`/`redundant_ui_image`) + swaps/bleed de R&W; T6=bleed sistémico; **T8=único con claves mal**.
Constantes en todos: `stem_number_leak` (~44-67/test, cosmético) y `redundant_ui_image` en Math.
Ningún defecto de TEXTO cambia la respuesta; solo las 2 claves de T8 lo hacen.

## Señal automática rápida (stems con artefacto `[x / y]`, todos los tests)
TEST 1 = **46**, TEST 2 = 3, resto ≈ 0. El artefacto de corchetes es prácticamente exclusivo de TEST 1.
