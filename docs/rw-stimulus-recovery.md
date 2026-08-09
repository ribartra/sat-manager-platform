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

La recuperación se hizo en tres fases: **split** del stem (fase B1), **recuperación short-stem por OCR**
(fase B2) y, para Test 1, **mapeo posicional** de estímulo y opciones (fase A).

| Test | Archivo fuente de promoción | Def. | RW | Estímulo (split + OCR) | Pendiente |
|-----:|------------------------------|:---:|---:|:----------------------:|----------:|
| 1  | `Test1 RW Answer Explanations.docx` (equivocado) | A | 54 | 38 (posicional) | 16 |
| 2  | `INNOVATOR TEST 2 R&W MOD 1 REV.pdf` | B | 54 | 49 (32+17) | 5 |
| 3  | `INNOV test 3 R&W mod. 1 and 2B.pdf` | B | 54 | 42 (31+11) | 12 |
| 4  | `INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf` | B | 52 | 49 (33+16) | 3 |
| 5  | `INNOVATOR TEST 5 RW MOD 1&2.pdf` | B | 54 | 53 (37+16) | 1 |
| 6  | `INNOVATOR TEST 6 RW.pdf` | B | 54 | 42 (33+9) | 12 |
| 7  | `Test 7 RW.pdf` | B | 52 | 47 (34+13) | 5 |
| 8  | `TEST 8 R&W MOD 1 AND 2.pdf` (solo 2/98 promovidas) | B | 2 | 2 | 0 |
| 9  | `TEST 9 RW MOD 1, 2, REV PDF.pdf` | B | 54 | 49 (34+15) | 5 |
| 10 | `INNOVATORS TEST 10 RW 1, 2B.pdf` (parcial 74/98) | B | 51 | 39 (29+10) | 12 |

**Totales.** 481 preguntas R&W · **410 con estímulo** (38 Test 1 + 265 split + 107 OCR short-stem) ·
**71 pendientes**.

### Fase B2 — recuperación short-stem por OCR (generalizada, `RECOVER_RW_STIMULUS_SHORTSTEM`)
Las preguntas short-stem (prompt sin pasaje) se recuperan re-parseando el OCR del PDF de cada test con un
parser único: ancla por número `N.` (→ orden de módulo `N-1`), pasaje = cola del bloque anterior tras la
última opción. **Clave de seguridad: se valida por prompt** — solo se escribe si el prompt parseado coincide
con el stem actual; si el parser deriva (preguntas con gráfico/tabla), el prompt no coincide y se **descarta**
(18 casos así, no escritos). Maneja marcadores en negrita, viñetas, overflow, y limpia fugas del valor de
la opción D previa (`![img]`/`[tbl]` se descartan). Recuperó **107/481**. Los **71 restantes** son: ~55 en
páginas OCR tipo tabla/gráfico (sin texto de pasaje → requieren re-OCR con visión o imagen) + ~16 descartados
por validación (drift no confirmado). Un caso minoritario puede conservar una opción-fragmento inicial.

## Pendiente
- **~71 estímulos**: ~55 en páginas tabla/gráfico (re-OCR con visión o recorte de imagen) + ~16 sin confirmar
  por validación de prompt (revisión manual).
- **Underline/gráficos**: preguntas de "underlined sentence" y de tabla/gráfico pueden requerir la imagen o
  el marcado de subrayado; el texto del pasaje quedó, pero el subrayado no lo preserva el OCR.
- **Promoción incompleta**: Test 8 (2/98), Test 10 (74/98), Tests 4/6/7 con 1–2 preguntas faltantes — track
  aparte de completar promoción.
