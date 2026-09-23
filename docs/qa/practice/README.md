# QA de contenido — MATH Practice Sets (índice)

- **Fecha:** 2026-09-22
- **Alcance:** todos los Practice Sets de MATH ya **promovidos/publicados**. Análogo a la QA de Full Practice Tests (`../README.md`).
- **Fase:** detección (read-only) → sweep → **fix aplicado en dev.db** (claves 2026-09-22, contenido 2026-09-23) **y en producción** satsol.org (2026-09-23).
- **Método:** por cada set y pregunta se trazó la cadena ingesta→promoción (`Question` ← `IngestQuestionCandidate.officialQuestionId` → `IngestSourceFile`/`IngestPageArtifact`), se renderizó el PDF fuente de ejercicio y el PDF `ANS` (pdftoppm 150 dpi, cacheado) y se comparó **visualmente** pregunta-vs-fuente. Claves contrastadas contra el PDF `ANS`. Resolver: `scripts/qa/practice-common.mjs` (`resolveMathPracticeSets`); pre-scan determinista: `scratchpad .../detect-suspects.mjs`.

## Universo

58 sets · 20 topics · 4 dominios · **827 preguntas** — todos `PUBLISHED`, todos con PDF de ejercicio + `ANS`, 827/827 con candidato de ingesta enlazado (0 huérfanas, 0 `.docx`). Cobertura de esta QA: **58/58 sets**.

## Resumen agregado de defectos

| Clase | Cantidad | Severidad típica |
|---|---|---|
| `broken_question` (matemática/valores caídos del enunciado u opciones) | 165 | Crítica/Alta |
| `image_missing` (figura/tabla/gráfico esencial ausente, `imageUrl` null o recorte equivocado) | 94 | Crítica/Alta |
| `answer_key_wrong` | 11 | Alta |
| `option_text_wrong` | 3 | Media |
| `stem_option_leak` | 2 | Baja |
| `type_mismatch` | 1 | Alta |
| `redundant_ui_image` | 1 | Media |
| **Total (líneas de defecto)** | **~277** (sobre ~250 preguntas; algunas con 2 defectos) | |

### Defecto sistémico dominante

Donde la fuente de College Board traía **ecuaciones, funciones, tablas, gráficos o figuras renderizados como imagen**, la ingesta/OCR los **descartó** en la promoción. Resultado: enunciados publicados gramaticalmente correctos pero **sin la matemática** (irresolubles), `imageUrl` null cuando la figura es esencial, u opciones colapsadas a texto idéntico al caerse sus valores. **Todo es recuperable desde los PDF fuente** (igual que en FPT). Muchos casos **no** los detectó el pre-scan determinista y solo salieron en la revisión visual.

### Sub-patrón: claves NUMERIC con decimal truncado

De las 11 claves erróneas, ~8 son valores NUMERIC con el **punto decimal caído / truncado a entero** — apunta a un bug de ingesta de respuestas NUMERIC. **Recomendado:** chequeo determinista platform-wide de respuestas NUMERIC enteras cuya explicación/`ANS` implique decimal.

## Por dominio

| Dominio | Sets | Q | Defectos | Claves erróneas | Findings |
|---|---|---|---|---|---|
| Advanced Math | 9 | 207 | 46 | 2 | [math-advanced-findings.md](math-advanced-findings.md) |
| Algebra | 15 | 267 | 108 | 4 | [math-algebra-findings.md](math-algebra-findings.md) |
| Geometry & Trigonometry | 12 | 142 | 37 | 1 | [math-geometry-findings.md](math-geometry-findings.md) |
| PSDA grupo 1 (Inference, One-Var Data, Distributions, Percentages) | 10 | 107 | 41 | 2 | [math-psda-1-findings.md](math-psda-1-findings.md) |
| PSDA grupo 2 (Probability, Ratios, Statistical Claims, Two-Var Data) | 12 | 104 | 45 | 2 | [math-psda-2-findings.md](math-psda-2-findings.md) |

Notas de calidad:
- **Geometry:** los 11 sospechosos de "recorte `ANSWER_FIELD`" (imagen del panel de opciones en vez de la figura) resultaron **falsos positivos** — esos recortes sí contenían la figura correcta. No hay wrong-crop en Geometry.
- **Advanced:** el findings file tiene 4 anotaciones `setId=...` truncadas/erróneas en encabezados (cosmético); los `qid` por línea son correctos y autoritativos para el fix.

## Claves de respuesta erróneas (11) — ✅ APLICADO en dev.db (2026-09-22)

Las 11 claves se corrigieron WAL-safe (servidor detenido, backup `backups/devdb-preapply-practice-keys-*`, `integrity_check: ok`) vía `scripts/qa/apply-recovery-fixes.mjs --apply --specs-dir=<practice-fixes> --audit=docs/qa/practice/fixes-applied.md`. Cada valor se re-verificó contra el texto del PDF `ANS` antes de escribir (todas son citas literales "The correct answer is …", Moore MC confirmada). Auditoría: [fixes-applied.md](fixes-applied.md). NUMERIC se guarda pipe-delimitado (formas equivalentes decimal|fracción); `lib/answer-grading` acepta cualquiera. **✅ En producción** (2026-09-23, junto con el contenido).


| qid | Set | Actual → Correcto |
|---|---|---|
| cmsjrnybd01wjqmt1z0jj2is4 | Nonlinear Functions MEDIUM p27 | `2` → **2.5 / 5/2** |
| cmsjrnyai01vxqmt17jd8wlzq | Nonlinear Functions MEDIUM p21 (Moore) | `D (1994)` → **B (1989)** |
| cmsjrnys9021xqmt117pau780 | Linear Functions MEDIUM seq1 | `2` → **2.6 / 13/5** |
| cmsjrnzh102beqmt1511oyppa | Linear Eq 2-Var HARD seq2 | `1` → **1.5 / 3/2** (decimal truncado) |
| cmsjrnzh802bgqmt14276i4fx | Linear Eq 2-Var HARD seq4 | `1` → **1.25 / 5/4** (decimal truncado) |
| cmsjrnzlb02buqmt14xwwo7l3 | Linear Eq 2-Var HARD seq12 | `1` → **1.5 / 3/2** (decimal truncado) |
| cmsjrnzu102dqqmt1kmsxcyjc | Lines/Angles/Triangles HARD seq7 | `4` → **4.5 / 9/2** |
| cmsjrnzyt02euqmt18iagq73n | One-Variable Data HARD seq2 | `2` → **2.6 / 13/5** |
| cmsjro0xd02tsqmt1qm7ef91v | One-Variable Data MEDIUM seq10 | `1` → **1.3 / 13/10** |
| cmsjro1u703adqmt1cqywu1cg | Ratios MEDIUM seq13 | `4` → **4.44** |
| cmsjro1ub03aeqmt1d6psm1iz | Ratios MEDIUM seq14 | `25` → **25.4 / 127/5** |

Además, nota de formato (no contada como answer_key_wrong): **Percentages HARD seq2** guarda `0014` cuando debería ser `0.0014`.

## Sweep de recuperabilidad — HECHO (2026-09-22)

`scripts/qa/practice-recover-sweep.mjs` (read-only, `dev.db {readonly:true}`) cruzó las 4 etapas de ingesta para las **277** líneas de defecto → [recovery-map.md](recovery-map.md).

**Resultado: `NEEDS_REOCR = 0`.** Ningún defecto necesita re-ejecutar OCR — re-correrlo no ayudaría porque el OCR ya descartó la matemática/figura renderizada como imagen (verificado por muestreo: la ecuación caída **no está** en `candidate.stem` ni en `rawJson.text`). La promoción copia `candidate.stem`→`Question.stem` verbatim, así que **0** defectos se recuperan del texto de ingesta. La recuperación es transcripción / crop-assign desde la fuente, **ya en disco**:

| Veredicto | # | Fuente de recuperación |
|---|---|---|
| NEEDS_SOURCE_VISUAL | 139 | página del PDF de ejercicio (sin crop en ingesta) |
| IMAGE_ON_PAGE | 126 | ≥1 crop `pdfplumber` (`IngestImageArtifact`) en la página, a inspeccionar primero |
| ANS_PDF_KEY | 11 | clave legible en el PDF `ANS` |
| UI_IMAGE_REMOVE | 1 | quitar imagen de UI redundante |

## Fix de contenido (266 defectos) — ✅ APLICADO en dev.db (2026-09-23)

5 agentes read-only (uno por dominio) transcribieron desde la página fuente y validaron cada fix contra la clave guardada + `ANS`. Specs versionados en [specs/](specs/) (`content-<dominio>.json`). Revisión del lead antes de aplicar: spot-check visual de crops, lint de moneda y render KaTeX estricto de los 307 valores (0 errores).

- **Aplicado:** 419 ops sobre 260 preguntas — `text` 180, `option` 127, `imageFile` 67 (crops 200 dpi del PDF fuente), `image` 42 (crops `IngestImageArtifact`), `imageClear` 2, `answer` 1. Backup `backups/devdb-preapply-practice-content-20260923-010629`, `integrity_check: ok`, WAL 0. Re-verificado 419/419 contra el spec. Auditoría: [fixes-applied-content.md](fixes-applied-content.md).
- **Clave extra:** Percentages HARD seq2 `0014` → `0.0014|.0014` (`ANS`: "Correct Answer: .0014").
- **qids corregidos del findings** (el finding apuntaba a otra pregunta): Nonlinear Functions HARD p34 → `cmsjrnxbl01ebqmt1id28edpg`; LinEq 2-Var EASY seq11 → `cmsjrnyz6023wqmt1nicwdbbq`.
- **Moneda:** en los textos nuevos, `$N` se escribe `\(\$N\)` — un par de `$` de moneda en la misma línea lo tokeniza `lib/math-text.ts` como math (bug preexistente fuera de esta campaña).
- **Diferidos (4 specs / 3 qids, sin cambio):** `cmsjrnxef01elqmt13v07uy5o` y `cmsjrnyz90241qmt1xo8m2ip3` ya estaban completos (qid mal atribuido); `cmsjrnyy30235qmt1igtglrkc` (LinEq 2-Var EASY seq0) es un fragmento de la explicación de seq18 → **recomendado retirarlo del set** (decisión pendiente).
- **✅ En producción (2026-09-23):** claves + contenido, 270/270 preguntas (260 vía API + 10 vía UPDATE en VM por el gate de explicación). Ver [prod-push-applied.md](prod-push-applied.md).
