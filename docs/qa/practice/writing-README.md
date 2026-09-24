# QA de contenido — WRITING Practice Sets (índice)

- **Fecha:** 2026-09-24
- **Alcance:** todos los Practice Sets de **WRITING** ya **promovidos/publicados** (la mitad *Writing* de R&W). Cierra la QA de la sección `READING_WRITING` (ver [reading-README.md](reading-README.md) para la mitad Reading). Análogo a la QA de Full Practice Tests (`../README.md`) y de MATH (`README.md`).
- **Fase:** detección (read-only) → **fix APLICADO en `dev.db`** (4 explicaciones, WAL-safe) → **PUSH A PROD 4/4 OK** (2026-09-24; ver [writing-prod-push.md](writing-prod-push.md)). Cerrado.
- **Método:** resolver nuevo `resolveWritingPracticeSets` (`scripts/qa/practice-common.mjs`), gemelo del de Reading, con WHERE `s.name='READING_WRITING' AND d.name IN ('Expression of Ideas','Standard English Conventions')`. Expone `externalId` (el `Question ID:` hex de la fuente) y `sourceText` (`rawJson.text`). Pre-scan determinista: `scratchpad/detect-writing-suspects.mjs`.

## Por qué esta QA es **determinista pura** (visual NO justificado)

A diferencia de MATH (figuras raster) y de Command of Evidence en Reading (gráficos vectoriales), **Writing no tiene imágenes**: `pdfimages` reporta **0 imágenes en los 15 PDFs** y `Question.imageUrl`/`QuestionOption.imageUrl` son NULL en las **259/259** preguntas. Además:

- **259/259** con candidato de ingesta, `questionExternalId` (hex) y `rawJson.text` → join total por Question ID y diff de texto contra la fuente.
- **Fidelidad de texto ~perfecta**: el máximo de contenido fuente "faltante" en cualquier pregunta es **4% = 1 token**, y ese token es siempre **el propio hex del Question ID** (scaffolding), nunca contenido real. No existe truncación de pasaje/stem.
- El único topic con estímulo estructurado (**Rhetorical Synthesis**, notas con viñetas) es **byte-fiel**: las notas publicadas coinciden verbatim con la fuente en las 69 preguntas.

Por eso no se lanzó revisión visual: no hay imágenes, la fidelidad de texto está probada deterministamente y el estímulo estructurado es fiel. (Cumple la regla "visual solo donde esté justificado".)

## Universo

Sección DB = **`READING_WRITING`**. Writing = dominios **`Expression of Ideas`** + **`Standard English Conventions`**.

**15 sets · 4 topics · 2 dominios · 259 preguntas** — todas `PUBLISHED`, todas `MC` (A–D), fuente **PDF** (sin imágenes), **259/259 enlazadas (0 huérfanas)**.

| Dominio | Topic (DB) | Carpeta fuente | Sets | Q | Estímulo |
|---|---|---|---|---|---|
| Expression of Ideas | Rhetorical Synthesis | `Student Notes/` | 3 | 69 | notas (no-null 69/69) |
| Expression of Ideas | Transitions | `Transitions/` | 3 | 49 | NULL por diseño (blank en el stem) |
| Standard English Conventions | Boundaries | `Boundaries/` | **6** | 82 | NULL por diseño |
| Standard English Conventions | Grammar and Structure | `Structure and Grammar/` | 3 | 59 | NULL por diseño |

Nota: **Boundaries se ingirió como 6 sets** (uno por archivo fuente): EASY (16Q), MED×2 (11+10Q), **HARD×3** (H1 14Q, H2 16Q, H3 15Q). Los stems fill-in-the-blank llevan el pasaje dentro del `stem` con `stimulus` NULL por diseño (como Words in Context en Reading) — **nunca** se marca `empty_stimulus` ahí.

## Resumen agregado de defectos

| Clase | Cantidad | Severidad | Detección | Estado |
|---|---|---|---|---|
| `answer_key_wrong` | **0 / 259** | — | Determinista (join hex → `Correct Answer:` del ANS) | ✅ 259/259 claves correctas |
| `explanation_truncated` (`Question.explanation` es prefijo del rationale del `ANS`, cortado) | **4** | Media | Determinista ([writing-explanation-truncation.md](writing-explanation-truncation.md)) | fix preparado (append-tail), pendiente aplicar |
| `stem_option_leak` | 1 → **0 real** | — | Determinista (falso positivo) | — |
| **Total defectos reales** | **4** | | | |

Verificaciones limpias (0 defectos): `empty_stem`, `mc_bad_options`, `empty_option`, `option_dup`, `answer_not_in_options`, `encoding_mangle`, `escaped_underscore`, `source_content_missing`, y `type_mismatch` (259/259 MC).

### Único defecto real — explicaciones truncadas (4, todas Boundaries HARD)

`Question.explanation` es, en 4 preguntas, un **prefijo textual exacto** (por alnum) del "Rationale" del `ANS`, cortado a mitad de oración (le falta la explicación de las opciones C/D). No cambia la clave; degrada la explicación que ve el estudiante. Las 4 están en los sets **Boundaries HARD H2/H3** (los únicos ANS con layout `Question ID <hex>` sin dos puntos y con footer `Question Difficulty:` al final). Cola recuperable por **append-tail** desde el `ANS`. Detalle por qid en [writing-explanation-truncation.md](writing-explanation-truncation.md).

## Gotchas deterministas (para reproducir)

1. **Dos formatos de `Question ID` en los ANS.** Easy/H1/Med imprimen `Question ID: <hex>` (con dos puntos); **H2/H3 imprimen `Question ID <hex>` sin dos puntos**. Con el regex estricto de Reading se perdían 31 preguntas (los sets H2 16Q + H3 15Q) → falso "0 truncaciones". Regex robusto = `/Question\s+ID:?\s*([0-9a-fA-F]{6,})/` y `pdftotext` **sin `-layout`** (mantiene `Question ID <hex>` en una línea).
2. **H2/H3 traen footer al final del rationale** (`Question Difficulty: Hard`, tabla `Assessment/Test/Domain/Skill`). Hay que strippearlo antes de medir la "cola faltante", si no infla el conteo (un caso, Boundaries HARD seq7, quedaba como falso positivo con `miss=22` = solo el footer).
3. **Falsos positivos esperables:** `stem_option_leak` casa las abreviaturas de especie ("C. olivacea"/"C. furcatus") en las notas de Rhetorical Synthesis; y un split por línea de `rawJson.text` recoge continuaciones de **opciones** que envuelven a la línea siguiente (parecen "notas faltantes" pero son texto de la opción D/C). Ambos verificados a mano como no-defectos.

## Fix preparado (pendiente de confirmación)

`scratchpad/writing-fixes/01-explanations.json` — **4 ops `text{explanation}`** por append-tail (prefijo pristino + cola faltante; verificado `alnum(prefijo+cola)===alnum(rationale)`, 0 boundary fails; el `pdftotext` sin `-layout` preservó las comillas tipográficas). Aplicación WAL-safe idéntica a Reading: `scripts/qa/apply-recovery-fixes.mjs --apply --confirm-server-stopped --specs-dir=scratchpad/writing-fixes --audit=docs/qa/practice/writing-fixes-applied.md` (servidor detenido, backup previo, `integrity_check`, WAL truncado).

## Fuera de alcance (por ahora)

- Aplicar el fix de las 4 explicaciones (arriba) — pendiente de confirmación.
- **Push a producción** satsol.org de Reading + Writing (análogo a `scripts/qa/push-fixes-to-prod.mjs`) — pendiente.
