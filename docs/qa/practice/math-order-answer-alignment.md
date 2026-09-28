# Math Practice Sets: orden de preguntas y alineación pregunta ↔ alternativa correcta

**Fecha:** 2026-09-28 · **Alcance:** los 58 Practice Sets de Math (826 preguntas: 649 MC y 177 NUMERIC) · **BD:** `dev.db` local; producción verificada igual en orden y claves · **Modo:** solo lectura, sin cambios aplicados.

## Pregunta de partida

En *Advanced Math – Equivalent Expressions – MEDIUM*, la pregunta 9 del PDF aparece como la 11 en la plataforma y la 16 como la 19. ¿Se trasladó la alternativa correcta a otra pregunta?

**Respuesta: no.** Cada pregunta conserva su enunciado, sus opciones y su clave. Lo único alterado es la **posición** dentro del set. La calificación se hace por `questionId`, no por posición, así que un orden distinto no produce notas erróneas.

## Método

1. **Parsing de fuente.** Se extrajo con `pdftotext` el `Question ID` (hex) de las 59 fuentes y de los 57 ANS de `files_to_load/PRACTICE EXERCISES/EXERCISES MATH`. Hay tres formatos: "Question ID: x", "Question ID x" e "ID: x", este último con varias preguntas por página. De ahí salen el orden de la fuente y la clave oficial por hex.
2. **Artefactos de ingesta.** El enlace es `Question → IngestQuestionCandidate` (hex, `questionNumber`, `answerSource`) → `IngestPageArtifact` (página) → `IngestSourceFile`. Si el candidato no tiene hex, se deduce por la página, que siempre contiene una sola pregunta.
3. **Cotejos automáticos:**
   - orden BD vs. fuente;
   - clave BD vs. ANS por hex;
   - texto de cada opción A–D vs. la opción de la misma letra en la fuente;
   - enunciado, opciones y explicación contra el bloque de su propio hex frente a los de las demás preguntas del archivo;
   - "Choice X is correct" de la explicación vs. la clave;
   - claves NUMERIC vs. "The correct answer is …" / "Note that … are examples" de la explicación OCR.
4. **Análisis visual.** Se renderizaron con `pdftoppm` las páginas donde el texto no basta (matemática incrustada como imagen). También se revisaron las 4 preguntas sin hex de EE MEDIUM, las 7 claves NUMERIC no verificables por texto, los 2 casos de "Choice X" contradictorio y las 15 señales heurísticas de opciones y enunciados. En los casos de opciones como imagen, la clave se validó resolviendo la pregunta.

Los scripts están en el scratchpad de la sesión (`sweep.cjs`, `align.cjs`, `perletter.cjs`, `num.cjs`). Si se aprueba la corrección, se versionan en `scripts/qa/`.

## Resultado global

| Verificación | Resultado |
|---|---|
| Claves MC vs. ANS (por hex) | **649/649 correctas** |
| Claves NUMERIC vs. ANS / explicación / imagen | **175/177 correctas, 2 truncadas** (ver B) |
| Opciones permutadas entre letras (783 opciones con texto en la fuente) | **0**; las 52 diferencias son números que en el PDF son imagen |
| Opciones, enunciado o explicación de otra pregunta (heurística + revisión manual) | **0** en opciones y enunciados; 12 explicaciones con la pregunta siguiente pegada (ver D) |
| Orden de preguntas distinto de la fuente | **2 sets**: Equivalent Expressions EASY y MEDIUM (ver A) |
| Claves con separador no soportado por la calificación | **3** (2 PS y 1 FPT) (ver C) |
| Paridad con prod (orden de los 2 sets + las 5 claves de B/C) | idéntica |

## A. Orden alterado: Equivalent Expressions EASY y MEDIUM

**Causa.** En estos dos PDF, 7 páginas (4 en MEDIUM, 3 en EASY) se ingirieron como candidatos **sin `questionExternalId`**. Se promovieron el 2026-08-11, con ids `cmsp5…`/`cmsp3…` y `answerSource=ANSWER_KEY`.

- Los candidatos con hex se numeraron correlativamente (1…19) saltándose esas páginas.
- Los candidatos sin hex recibieron como `questionNumber` su número de página (6, 9, 16, 23).
- Al ordenar el set por `questionNumber`, cada pregunta sin hex quedó detrás de la que ya tenía ese número.

La `pageNumber` del artefacto de página es correcta en todos los casos, así que el orden real se puede recuperar sin ambigüedad.

**Efecto.** Enunciado, opciones y clave de cada pregunta coinciden con su propia página del PDF; se verificó visualmente y resolviendo las preguntas (p6 → B, p9 → D, p16 → B, p23 → B). Solo cambia el número que ve el alumno. Además, las 7 preguntas sin hex **no tienen explicación** (`explanation = null`).

**EE MEDIUM** (⚠ = posición distinta):

| PDF # | ID | Plataforma # | Clave BD | Clave ANS |
|---|---|---|---|---|
| 1–5 | c602140f … 7348f046 | 1–5 | B D B A C | B D B A C |
| 6 | 3e9cc0c2 (sin ID en BD) | 7 ⚠ | B | B |
| 7 | d9137a84 | 6 ⚠ | D | D |
| 8 | 16de54c7 | 8 | 4 | 4 |
| 9 | c3a72da5 (sin ID en BD) | 11 ⚠ | D | D |
| 10 | a391ed22 | 9 ⚠ | 5/2 \| 2.5 | 5/2 |
| 11 | f237ccfc | 10 ⚠ | 32 | 32 |
| 12–15 | 26eb61c1 … 463eec13 | 12–15 | C A B D | C A B D |
| 16 | ad2ec615 (sin ID en BD) | 19 ⚠ | B | B |
| 17 | b8caaf84 | 16 ⚠ | B | B |
| 18 | dd4ab4c4 | 17 ⚠ | B | B |
| 19 | 42c71eb5 | 18 ⚠ | A | A |
| 20–22 | a05bd3a4 … a520ba07 | 20–22 | C C B | C C B |
| 23 | a255ae72 (sin ID en BD) | 23 | B | B |

**EE EASY:**

| PDF # | ID | Plataforma # | Clave BD = ANS |
|---|---|---|---|
| 5 | 60fdb4d4 (sin ID en BD) | 6 ⚠ | A |
| 6 | 49efde89 | 5 ⚠ | D |
| 10 | 294db8ec (sin ID en BD) | 12 ⚠ | D |
| 11 | 6e06a0a7 | 10 ⚠ | D |
| 12 | 290cdc2c | 11 ⚠ | B |
| 14 | 974d33dc (sin ID en BD) | 17 ⚠ | D |
| 15–17 | 5d93c782, 0354c7de, e597050f | 14–16 ⚠ | B A D |

Las demás posiciones (1–4, 7–9, 13 y 18–21) coinciden.

**Impacto en producción:** hay 1 intento SUBMITTED en cada uno de los dos sets. La nota no cambia porque se califica por id; el snapshot conserva el orden en que se vio.

## B. Claves NUMERIC truncadas (error real de calificación)

| Set | # | ID | Clave BD | Clave correcta (ANS) |
|---|---|---|---|---|
| Algebra – Linear Equations in One Variable – MEDIUM | 8 | f09097b1 | `22` | `22.4\|112/5` |
| Algebra – Linear Equations in One Variable – MEDIUM | 10 | 4f669597 | `1` | `1.2\|6/5` |

El decimal se perdió en la clave, pero la explicación de la BD sí dice 22.4 y 1.2. Un alumno que responda bien sería marcado incorrecto. En prod nadie ha respondido aún estas preguntas.

## C. Claves con coma en lugar de `|`

`lib/answer-grading.ts` → `parseAccepted` solo separa por `|`. Con coma, la clave completa se toma como un único valor y **ninguna respuesta se acepta**.

| Pregunta | Dónde | Clave BD | Debe ser |
|---|---|---|---|
| `cmsjrnxa801duqmt17wr7y809` (84dd43f8) | PS Nonlinear Functions HARD #21 | `3.44, 86/25` | `3.44\|86/25` |
| `cmsjrnxav01e0qmt10bitrnpm` (6d9e01a2) | PS Nonlinear Functions HARD #27 | `25/4, 6.25` | `25/4\|6.25` |
| `cmsjrnw3s010lqmt1p4c4t6bn` | FPT (fuera de alcance, detectado de paso) | `-2, 11` | `-2\|11` (a confirmar con la fuente) |

Sin respuestas registradas en prod.

## D. Explicaciones (no afectan la clave, sí lo que ve el alumno)

- **12 explicaciones con la pregunta siguiente pegada.** Tras `[tbl-0.html] # Question …` aparecen el enunciado de otra pregunta y a veces su "Correct Answer" (p. ej. Area and Volume MEDIUM #9 muestra "A circle has a circumference of 31π… Correct Answer: 31"). Afecta a:
  - NF EASY #13
  - LE2V MEDIUM #25
  - LF HARD #15
  - A&V MEDIUM #9
  - Circles HARD #12
  - OVD-Distrib HARD #14
  - OVD EASY #11
  - OVD MEDIUM #9
  - Percentages MEDIUM #7
  - RRPU EASY #1
  - RRPU HARD #3
  - TVD MEDIUM #10
- **41 explicaciones con el pie "Question Difficulty: Hard".** Son de los sets HARD con formato "ID:": EE HARD #1, NLE HARD #1, NLF HARD y OVD-Distrib HARD.
- **2 erratas de la propia fuente**, copiadas tal cual. En ambas la clave de la BD es correcta, verificada resolviendo la pregunta:
  - Linear Inequalities MEDIUM #4 (bf5f80c6): el ANS dice "Correct Answer: A", pero el rationale dice "Choice D is correct" y "Choices A, B, and C are incorrect".
  - Systems of Two Linear Equations HARD #12 (1e11190a): la clave es B y el rationale dice "Choice C is correct".
- **19 preguntas sin explicación:** las 4 de EE MEDIUM sin hex, 2 de EE HARD #1, 1 de NLE HARD #1, 2 de NLF HARD, 1 de LE2V HARD y 9 de OVD-Distrib HARD. En los ANS sí existe un rationale para recuperarlas.

## E. Notas de cobertura (no son defectos)

- *One-Variable Data – HARD* (4 preguntas) y *Two-Variable Data – HARD* (4) tienen menos preguntas que sus PDF (11 y 8). Las que faltan están en *One-Variable Data: Distributions and Measures – HARD*, porque el mismo hex aparece en dos archivos fuente y se deduplicó. Ningún hex está en más de un set.
- Hay 1 749 letras de opción cuyo texto en la fuente es solo imagen y no se pueden cotejar por texto. En esos casos la integridad pregunta ↔ clave se apoya en la clave por hex (649/649), en la ausencia de desplazamientos en el orden y en la QA visual de Math del 2026-09-23.

## Corrección propuesta (pendiente de aprobación)

1. **Reordenar** `PracticeSetQuestion.order` de EE EASY y EE MEDIUM según la página de la fuente.
2. **Rellenar** `questionExternalId` en los 7 candidatos sin hex.
3. **Claves:** corregir las 2 truncadas (B) y las 3 con coma (C). Opcionalmente, endurecer `parseAccepted` para que también separe por `,` cuando no sea separador de miles.
4. **Explicaciones:**
   - quitar la cola filtrada (12) y el pie "Question Difficulty" (41);
   - completar las 19 vacías desde el rationale del ANS;
   - decidir si se corrige la letra en las 2 erratas de la fuente.
5. Aplicar en `dev.db` (con el servidor detenido y backup) y en prod con guarda `old` y backup de filas; verificar la paridad.

## Aplicado (2026-09-28): local + prod

Script: `scripts/qa/apply-math-alignment-fixes.cjs`. Todo o nada, y cada operación va protegida por su valor anterior. Son 107 operaciones:

| Corrección | Ops |
|---|---|
| Orden de EE EASY (9) y EE MEDIUM (9) según la página del PDF | 18 |
| `questionExternalId` en los 7 candidatos sin hex | 7 |
| Claves: `22`→`22.4\|112/5`, `1`→`1.2\|6/5`, `3.44, 86/25`→`3.44\|86/25`, `25/4, 6.25`→`25/4\|6.25`, FPT `-2, 11`→`-2\|11` (verificado: raíces de x²−9x−22) | 5 |
| Las mismas 5 claves en `IngestQuestionCandidate`, para mantener la coherencia del staging | 5 |
| Explicaciones: cola filtrada de la pregunta siguiente eliminada | 12 |
| Explicaciones: pie "Question Difficulty" eliminado | 41 |
| Explicaciones vacías rellenadas con el rationale del ANS, transcrito visualmente con LaTeX; la clave del rationale coincide en 19/19 | 19 |

- **Local:** backup en `backups/devdb-preapply-mathalign-<ts>.bak`; `integrity_check` ok. Al repetir el barrido: 0 sets con orden alterado, 0 colas filtradas y 0 explicaciones vacías.
- **Prod:** backup en `/data/db/backups/dev.db.pre-mathalign-20260928` y filas en `mathalign-rows-backup-20260928.json`. Las 107 guardas coincidían con local antes de aplicar y todas figuran aplicadas después; `quick_check` ok y `/api/health` 200.

Sin tocar, a propósito:
- Las 2 erratas de letra del propio rationale (bf5f80c6, 1e11190a).
- La errata del ejemplo numérico en 2c88af4d: la fuente imprime $2^{-\frac{1}{3}}$ donde corresponde $2^{-\frac{1}{6}}$; se transcribió tal cual.
- En las explicaciones de c178d4da, e7d48c8a y f8a322d9 se restituyeron los paréntesis de los productos, que el PDF perdió al extraer el texto.

Pendiente de decisión (taxonomía): d6af3572 y 1e1027a7 tienen en la fuente el skill "Two-variable data: Models and scatterplots", pero están en el set *One-Variable Data: Distributions and Measures – HARD*.

## Aplicado 2 (2026-09-28): erratas de la fuente y reubicación Two-Variable, local + prod

Son 32 operaciones con el mismo script. Se añade la operación `psqMove`, que mueve una fila de `PracticeSetQuestion` a otro set, y `topicId` pasa a ser un campo editable.

- **Erratas del rationale oficial corregidas** (la clave ya era correcta en los tres casos y se verificó resolviendo cada pregunta):
  - **bf5f80c6:** "Choice D is correct" pasa a "Choice A is correct", y "Choices A, B, and C are incorrect" pasa a "Choices B, C, and D…".
  - **1e11190a:** "Choice C is correct" pasa a "Choice B…". El párrafo de las incorrectas queda así: C y D son errores de cálculo, y A (4) es el número de pintas de *raspberries*.
  - **2c88af4d:** el valor de la opción A en el ejemplo pasa de $2^{-\frac{1}{3}}$ a $2^{-\frac{1}{6}}$.
- **Reubicación por skill oficial "Two-variable data: Models and scatterplots".** Salen 6 preguntas de *One-Variable Data: Distributions and Measures – HARD*, que queda con 14, y pasan a *Two-Variable Data – HARD*, que queda con 10. También cambia su `Question.topicId`, de `top-data-mean` a `top-two-var-data`.
  - Orden del set destino: primero las 8 del PDF "TWO Var. Data HARD" en su orden (d6af3572, 1e1027a7, 7b52985c, 9d95e7ad, af142f8d, 79137c1b, e821a26d, d0430601). Después van fb866265 y 2e8027b0, que solo aparecen en el PDF de Distributions.
  - El set origen se renumeró de 0 a 13, conservando el orden relativo.
  - No había intentos en ninguno de los dos sets, ni en local ni en prod.
- **Local:** backup en `backups/devdb-preapply-mathalign2-<ts>.bak`; `integrity_check` ok. Al repetir el barrido: claves MC 649/649, 0 explicaciones que citen otra letra y 0 explicaciones vacías.
- **Prod:** backup en `/data/db/backups/dev.db.pre-mathalign2-20260928` y filas en `mathalign2-rows-backup-20260928.json`. Antes de aplicar había 0 guardas desfasadas; después, las 32 operaciones figuran como aplicadas. `quick_check` ok y health 200.
- **Despliegue:** no cambió código de la app, así que no hace falta reconstruir la imagen. Los datos se aplicaron directamente en la BD de prod.
