# QA de contenido — READING Practice Sets (índice)

- **Fecha:** 2026-09-24
- **Alcance:** todos los Practice Sets de **READING** ya **promovidos/publicados** (la mitad *Reading* de R&W; **Writing NO** en esta fase). Análogo a la QA de Full Practice Tests (`../README.md`) y de MATH (`README.md`).
- **Fase:** detección (read-only) → **fix APLICADO en `dev.db`** (2026-09-24; ver [reading-fixes-applied.md](reading-fixes-applied.md)) → **PUSH A PROD 90/94** (2026-09-24; ver [reading-prod-push.md](reading-prod-push.md)). Pendiente: 4 preguntas-gráfico bloqueadas por el gate de publicación (explicación vacía, ver abajo).
- **Método:** por cada set y pregunta se trazó la cadena ingesta→promoción con un resolver nuevo `resolveReadingPracticeSets` (`scripts/qa/practice-common.mjs`), que expone `externalId` (el `Question ID:` hex de la fuente) y `sourceText` (el bloque de texto fuente exacto, `rawJson.text`). Se comparó **campo publicado vs `sourceText`** (fidelidad de texto), se cruzó cada clave contra el `Correct Answer:` del PDF `ANS` (join por `Question ID`), y se renderizó la página fuente (`pdftoppm` 150 dpi) para inspección visual de tablas/gráficos/casos ambiguos. Pre-scan determinista: `scratchpad .../detect-reading-suspects.mjs`.

## Universo

Sección DB = **`READING_WRITING`** ("R&W" es solo etiqueta UI en `lib/taxonomy.ts`). Reading = dominios **`Information and Ideas`** + **`Craft and Structure`**.

**18 sets · 6 topics · 2 dominios · 529 preguntas** — todas `PUBLISHED`, todas `MC` (4 opciones A–D), todas con fuente **PDF**, **529/529 con candidato de ingesta enlazado (0 huérfanas)**. Cobertura de esta QA: **18/18 sets · 529/529 preguntas**. Los 36 PDFs de Reading no traen imágenes raster; las tablas van como texto y los **gráficos van como dibujo vectorial** (relevante abajo).

## Contraste con MATH

Reading es **mucho más limpio** que MATH a nivel de texto (sin ecuaciones/figuras raster): stem/stimulus/opciones resultaron **fiel al byte** salvo los ítems con gráfico, y **las 529 claves son correctas** (MATH tenía 11 erróneas). El defecto sistémico de Reading es de otra naturaleza (ver abajo): **gráficos vectoriales perdidos** y **explicaciones truncadas**.

## Resumen agregado de defectos

| Clase | Cantidad | Severidad | Detección | Estado |
|---|---|---|---|---|
| `stimulus_truncated` (gráfico de barras/líneas perdido en la promoción) | **23** | Alta | Visual (agente Command of Evidence) | ✅ imagen del chart adjuntada + stimulus limpiado |
| `explanation_truncated` (`Question.explanation` es un prefijo textual del rationale del `ANS`, cortado) | **77** | Media | Determinista platform-wide (`reading-explanation-truncation.md`), validado contra revisión visual | ✅ cola restaurada desde el `ANS` (append-tail) |
| `encoding_mangle` (apóstrofo recto vs. tipográfico) | **1** | Baja (cosmético) | Visual (Central Ideas HARD seq5) | — (no aplicado; cosmético) |
| **Total (líneas de defecto)** | **101** (sobre ~94 preguntas; hay solape gráfico↔explicación en Command of Evidence) | | | |

Verificaciones limpias (0 defectos): `broken_question`, `stimulus_wrong/bleed/dup_in_stem`, `double_passage_missing_text` (36/36 Cross-Text conservan `Text 1` **y** `Text 2`), `option_text_wrong/truncated/dup`, `stem_option_leak`, `option_label_leak`, `stem_annotation_leak`, `ui_leak`, `escaped_underscore`, `answer_key_wrong` (**0/529** — 529/529 claves OK), `type_mismatch`.

### Defecto sistémico 1 — gráficos vectoriales perdidos (Command of Evidence, 23)

Análogo al defecto de imagen de MATH, pero por **dibujo vectorial** en vez de raster: en cada ítem *cuantitativo* de Command of Evidence cuyo estímulo es un **gráfico de barras/líneas**, el chart no sobrevivió a la promoción. El `stimulus` publicado conservaba solo los rótulos de ejes (a menudo **espejados por el OCR**, p.ej. `yticirtcelE`, `)hWM fo sdnasuoht ni(`), la leyenda y la prosa; **las barras/líneas con los valores no estaban**, y **`Question.imageUrl` era NULL en las 529 preguntas** → sin respaldo de imagen. Estos ítems quedaban **irresolubles**. **Las tablas de datos, en cambio, sobrevivieron intactas** (todas las filas/columnas/negativos), porque son texto: la pérdida es exclusiva de charts vectoriales. Ítems (23): Command of Evidence EASY seq4/9/12/16/21/24; MEDIUM seq2/4/6/15/16/21/22/24/27/28; HARD seq1/4/7/8/16/21/24. **✅ RECUPERADO en `dev.db` (2026-09-24):** se recortó cada chart de la página fuente (`pdftoppm` 200 dpi región) y se adjuntó como `Question.imageUrl`, y se limpió el `stimulus` (se quitó la basura de ejes espejada, conservando título + prosa **verbatim**). 23/23 imágenes en disco, 0 gibberish residual.

### Defecto sistémico 2 — explicaciones truncadas (77, todos los topics)

`Question.explanation` era, en 77 preguntas, un **prefijo textual exacto** del "Rationale" del PDF `ANS`, cortado (le faltaba la cola). No cambia la clave, pero degrada la explicación que ve el estudiante. Dos sabores: cortes **tempranos** (mayoría, sobre todo en los ítems con gráfico de Command of Evidence) y unos pocos cerca de un **tope ~2.3k chars** (máximo de longitud observado 2379). Método determinista y detalle por qid en [reading-explanation-truncation.md](reading-explanation-truncation.md). **Validación:** el scan (regla: prefijo exacto + corte a mitad de oración o ≥40 chars faltantes) incluye p.ej. WiC HARD seq5 (`…undermine t` → `…undermine their own marketing in pursuit of that goal.`), y su conteo de WiC (10) es consistente con la revisión visual (8) más 2 cortes cortos que el agente no marcó. **✅ RECUPERADO en `dev.db` (2026-09-24):** se restauró la cola completa desde el `ANS` con estrategia **append-tail** — se conserva el prefijo ya guardado (comillas tipográficas intactas) y se **agrega solo la cola faltante** (evita regresar el prefijo a la calidad más pobre del `pdftotext` del `ANS`). 0/77 quedan truncadas tras el fix.

## Por topic

| Dominio | Topic | Sets | Q | Defectos | Findings |
|---|---|---|---|---|---|
| Information and Ideas | Command of Evidence | 3 | 104 | 23 graph + 27 expl | [reading-command-of-evidence-findings.md](reading-command-of-evidence-findings.md) |
| Information and Ideas | Inferences | 3 | 52 | 15 expl | [reading-inferences-crosstext-findings.md](reading-inferences-crosstext-findings.md) |
| Information and Ideas | Cross-Text Connections | 3 | 36 | 12 expl | [reading-inferences-crosstext-findings.md](reading-inferences-crosstext-findings.md) |
| Information and Ideas | Central Ideas and Details | 3 | 48 | 5 expl + 1 encoding | [reading-textstructure-centralideas-findings.md](reading-textstructure-centralideas-findings.md) |
| Craft and Structure | Text Structure and Purpose | 3 | 48 | 8 expl | [reading-textstructure-centralideas-findings.md](reading-textstructure-centralideas-findings.md) |
| Craft and Structure | Words in Context | 3 | 241 | 10 expl | [reading-words-in-context-easy-findings.md](reading-words-in-context-easy-findings.md) · [medhard](reading-words-in-context-medhard-findings.md) |

(«expl» = `explanation_truncated`, del scan determinista; «graph» = `stimulus_truncated`.)

Notas de calidad:
- **Words in Context** es fill-in-the-blank: `stimulus` es NULL **por diseño** en 203 de 241 preguntas (el pasaje va en el `stem`) — no es defecto. Las otras 38 ("most nearly means") sí llevan `stimulus`, correcto.
- **WiC "most nearly means":** la palabra objetivo va **subrayada** en la fuente; ese subrayado se pierde en `sourceText` (OCR) y en el estímulo publicado (no se aplicó `++…++`). No se contó como defecto: la palabra objetivo siempre se nombra en el stem, así que la solvencia no se afecta.
- **`imageUrl`** era NULL en 529/529 (esperado en ítems de texto) — tras el fix, 23 ítems con gráfico ya llevan su chart; el resto sigue NULL por diseño.
- Los 123 `truncation_suspect` del pre-scan determinista fueron **falsos positivos** (heurística de puntuación terminal sobre stems fill-in-the-blank / "as used…"); confirmado por los agentes.

## Fix aplicado en dev.db (2026-09-24) — ver [reading-fixes-applied.md](reading-fixes-applied.md)

WAL-safe (servidor detenido, backup `backups/devdb-preapply-reading-*`, `integrity_check: ok`, WAL truncado) vía `scripts/qa/apply-recovery-fixes.mjs --apply --specs-dir=<reading-fixes> --audit=docs/qa/practice/reading-fixes-applied.md`. **123 ops sobre 94 preguntas:** 23 `imageFile` (crops de chart) + 23 `text{stimulus}` (limpieza) + 77 `text{explanation}` (append-tail). Specs en `scratchpad/reading-fixes/`. Re-verificado: 23/23 imageUrl con archivo en disco, 0 explicaciones truncadas, 0 gibberish de ejes. No se tocó `encoding_mangle` (cosmético) ni ninguna clave (todas correctas).

## Push a producción — 2026-09-24 (ver [reading-prod-push.md](reading-prod-push.md))

No destructivo vía la API de la app (`scripts/qa/push-fixes-to-prod.mjs --apply`, login admin, PUT por id, subida de imagen previa). Primera pasada **90/94 OK** (77 explicaciones + 19/23 gráficos con imagen+stimulus); las **4 restantes** (abajo) se recuperaron y re-pushearon después → **94/94 en prod**. Las 4 iniciales fallaron con `400 "Explanation is required to publish."` — son 4 preguntas-gráfico de Command of Evidence con **`explanation` NULL** (nunca tuvieron explicación; un defecto peor que la truncación, no cubierto por el fix de 77): `cmsjro1af02y8qmt1cz0wfhfw` (EASY seq9), `cmsjro1hi032uqmt19pia9uok` (HARD seq4), `cmsjro1k3035jqmt1dg5cwyxv` (HARD seq24), `cmsjro2aw03iuqmt1cs6rep55` (MEDIUM seq16). Su imagen sí se subió al media store de prod (queda huérfana/sin referenciar hasta que la pregunta se actualice). **✅ Recuperadas y aplicadas en dev.db (2026-09-24):** se completó su `explanation` desde el rationale del `ANS` (join por `externalId` hex; non-layout, footer-stripped; verificado 4/4 que "Choice X is the best answer" coincide con la clave almacenada = D). Specs `scratchpad/reading-fixes-4empty/01-empty-explanations.json`; aplicadas WAL-safe (backup `devdb-preapply-reading4empty-*`, integrity ok; explLen 909/2685/2465/979). **✅ RE-PUSH A PROD 4/4 OK (2026-09-24)** vía `scripts/qa/push-fixes-to-prod.mjs --apply --specs-dir=scratchpad/reading-fixes-4empty --baseline-db=backups/devdb-preapply-reading-20260924-024448` (ver [reading-4empty-prod-push.md](reading-4empty-prod-push.md)): las 4 ahora con explicación (pasan el gate) + stimulus limpio + chart referenciado. **Reading queda 94/94 en prod.**

## Fuera de alcance (por ahora)

- **4 preguntas-gráfico** con explicación NULL (arriba) — recuperación pendiente de permiso/decisión.
- **Writing** practice sets — QA completa y **fix + push a prod 4/4 hechos** (ver [writing-README.md](writing-README.md)).
