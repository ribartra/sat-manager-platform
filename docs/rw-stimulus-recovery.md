# Recuperación de estímulo (pasaje) en R&W de los Full Practice Tests

**Contexto.** Las preguntas de Reading & Writing de los 10 mock tests se promovieron con el campo
`Question.stimulus` vacío. Hay **dos defectos distintos** según de qué archivo se promovió cada test.

## Los dos defectos

### A) Test 1 — promovido del archivo equivocado
Test 1 R&W se promovió desde `Test1 RW Answer Explanations.docx` (el documento de **explicaciones**, sin
pasajes), no desde el docx de preguntas. Resultado: `stimulus` vacío y `stem` = solo el prompt. El pasaje
**no estaba** en los candidatos; se recuperó desde el docx real de preguntas
(`Test 1 Module 1, 2B R&W.docx`) por **mapeo posicional** (número de página OCR `N` → orden de módulo `N-1`).
Corrección adicional: el primer piloto (match difuso por texto) había contaminado M1 con pasajes de M2B;
se rehízo con el mapa posicional autoritativo. Audit: `RECOVER_RW_STIMULUS` / `RECOVER_RW_STIMULUS_POSITIONAL`.

**Test 1 también perdió las opciones.** Como se promovió de las explicaciones, el texto de las alternativas
nunca se capturó: `QuestionOption` existía con `text` vacío (39) o faltaba (15) → el UI mostraba "sin
alternativas" (el `correctAnswer` sí estaba). Se recuperaron los textos A–D desde el mismo docx de preguntas
por el mismo mapa posicional (extrayendo las opciones de cada página-ancla): **33/54** con 4 opciones limpias;
20 quedan vacías (su página OCR es tabla/fragmento, el mismo grupo sin estímulo). Audit:
`RECOVER_RW_OPTIONS_POSITIONAL`. Esto es exclusivo de Test 1 — Tests 2–10 vienen del PDF de preguntas y ya
traían `QuestionOption` con texto (54/54 verificado).

### B) Tests 2–10 — promovidos del PDF correcto, pero mal parseados
Estos **sí** se promovieron desde el PDF de preguntas correcto (`isQuestionSource=1`), cuyo OCR traía
pasaje + prompt (`N. …`) + opciones separados por marcadores `NEXT/PREV QUESTION`. **La ingesta fue la
deficiente**: mashó el pasaje dentro de `Question.stem`, dejó `stimulus` vacío y, en algunos casos, descartó
el prompt. El contenido del pasaje **no se perdió** (salvo prompts sueltos): quedó en el campo equivocado.

**Fix seguro (split del stem).** Como el pasaje ya vive dentro del `stem` de la pregunta correcta, se parte
el stem existente en `stimulus` (pasaje) + `stem` (prompt), cortando en el límite `N.`+frase-prompt y
descartando las opciones embebidas (ya están en `QuestionOption`, 54/54). **No se re-parsea el OCR
secuencialmente**: ese parser deriva en preguntas con gráfico/tabla (le asignó el pasaje de Dunbar-Nelson a
la pregunta de Arthur Wesley Dow). El split del stem no puede derivar porque el texto ya está en la pregunta
correcta. Audit: `SPLIT_RW_STIMULUS_FROM_STEM`.

**Short-stem.** Las preguntas cuyo `stem` era solo el prompt (la ingesta descartó el pasaje) no se pueden
partir; quedan pendientes de una pasada de recuperación por OCR (con validación por-pregunta, camino con
riesgo de derivar).

## Estado por test

| Test | Archivo fuente de promoción | Defecto | RW | Con estímulo | Split aplicado | Short-stem (pendiente OCR) |
|-----:|------------------------------|:------:|---:|-------------:|---------------:|---------------------------:|
| 1  | `Test1 RW Answer Explanations.docx` (equivocado) | A | 54 | 38 | — (posicional) | 16 |
| 2  | `INNOVATOR TEST 2 R&W MOD 1 REV.pdf` | B | 54 | 32 | 32 | 22 |
| 3  | `INNOV test 3 R&W mod. 1 and 2B.pdf` | B | 54 | 31 | 31 | 23 |
| 4  | `INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf` | B | 52 | 33 | 33 | 19 |
| 5  | `INNOVATOR TEST 5 RW MOD 1&2.pdf` | B | 54 | 37 | 37 | 17 |
| 6  | `INNOVATOR TEST 6 RW.pdf` | B | 54 | 33 | 33 | 21 |
| 7  | `Test 7 RW.pdf` | B | 52 | 34 | 34 | 18 |
| 8  | `TEST 8 R&W MOD 1 AND 2.pdf` (solo 2/98 promovidas) | B | 2 | 2 | 2 | 0 |
| 9  | `TEST 9 RW MOD 1, 2, REV PDF.pdf` | B | 54 | 34 | 34 | 20 |
| 10 | `INNOVATORS TEST 10 RW 1, 2B.pdf` (parcial 74/98) | B | 51 | 29 | 29 | 22 |

**Totales.** 481 preguntas R&W promovidas · **303 con estímulo** tras esta fase (38 de Test 1 + 265 por split)
· **178 short-stem** pendientes de la pasada OCR.

## Pendiente
- **Short-stem (≈178)**: recuperar el pasaje del OCR del propio PDF de cada test, validando por-pregunta
  (número de prompt como ancla; verificar que el pasaje no derive en preguntas con gráfico/tabla).
- **Underline/gráficos**: preguntas de "underlined sentence" y de tabla/gráfico pueden requerir la imagen o
  el marcado de subrayado; el texto del pasaje quedó, pero el subrayado no lo preserva el OCR.
- **Promoción incompleta**: Test 8 (2/98), Test 10 (74/98), Tests 4/6/7 con 1–2 preguntas faltantes — track
  aparte de completar promoción.
