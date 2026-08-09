# Recuperación de estímulo (pasaje) en R&W de los Full Practice Tests

> **Estado (2026-08-09).** R&W de los 10 full tests. **Estímulo: 410/481.** Opciones: OK en Tests 2–10 +
> 35/54 en Test 1. Prompt (stem) y `correctAnswer`: completos. Etiquetado de módulo en el UI de revisión
> corregido (M1/M2B, ya no aparecen "dos Q1"). **Pendiente: ~71 estímulos** en páginas OCR tipo tabla/gráfico
> (requieren re-OCR con visión o recorte de imagen) o sin confirmar por validación. Todos los cambios de datos
> se hicieron WAL-safe con `integrity_check` ok y quedaron auditados en `AuditLog`.

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

## Pendiente — lista concreta y causa

**71 estímulos + 19 opciones (Test 1).** Causas:
- **`TBL/IMG`** (53) — la página OCR del pasaje es un placeholder `[tbl-0.html]` / `![img]` (o, en Test 1,
  el docx no trae el pasaje): **no hay texto que recuperar** → requiere re-OCR con visión o recorte de imagen.
- **`DRIFT`** (16) — el parser sí obtuvo un pasaje pero la **validación por prompt falló** (preguntas con
  gráfico/tabla desplazan la secuencia); se descartó por seguridad → revisión manual o recuperación dirigida.
- **`REVISAR`** (2) — hay pasaje parseable pero el limpiador de fuga de opción lo dejó < 40 chars; recuperable
  con una pasada afinada.

| Test | Estímulos pendientes (causa) |
|-----:|------------------------------|
| 1  | `TBL/IMG` (16): M1 Q4,Q7,Q12,Q19,Q24 · M2B Q6,Q9,Q15,Q16,Q18,Q19,Q20,Q22,Q23,Q24,Q26 |
| 2  | `TBL/IMG`: M1 Q1,Q2,Q4 · `DRIFT`: M2B Q10,Q27 |
| 3  | `TBL/IMG` (12): M1 Q4,Q5,Q7,Q9,Q11,Q13,Q15,Q16,Q18,Q19,Q21,Q22 |
| 4  | `DRIFT`: M1 Q25 · M2B Q16,Q25 |
| 5  | `TBL/IMG`: M1 Q14 |
| 6  | `TBL/IMG` (12): M1 Q15,Q17,Q19,Q20,Q21,Q23,Q25 · M2B Q17,Q19,Q21,Q23,Q25 |
| 7  | `TBL/IMG`: M1 Q10 · M2B Q2,Q15 · `DRIFT`: M2B Q4,Q7 |
| 8  | — (sin pendientes; solo 2/98 promovidas) |
| 9  | `TBL/IMG`: M1 Q16,Q22 · M2B Q15,Q23 · `DRIFT`: M2B Q27 |
| 10 | `REVISAR`: M1 Q6,Q23 · `DRIFT`: M1 Q26,Q27 · M2B Q4,Q7,Q11,Q14,Q16,Q24 · `TBL/IMG`: M2B Q2,Q9 |

**Opciones — Test 1 (19 sin texto)**: M1 Q4,Q6,Q7,Q9,Q12,Q19,Q24,Q27 · M2B Q6,Q9,Q15,Q16,Q18,Q19,Q20,Q22,Q23,Q24,Q26
(mismo grupo `TBL/IMG`; Tests 2–10 ya tienen opciones del PDF). El `correctAnswer` está completo en todas.

**Otras pistas**: preguntas de "underlined sentence" y de tabla/gráfico pueden requerir además la imagen o el
marcado de subrayado; el texto del pasaje (cuando se recuperó) quedó, pero el subrayado no lo preserva el OCR.

> Reproducir esta lista: el parser generalizado (`RECOVER_RW_STIMULUS_SHORTSTEM`) clasifica cada pendiente por
> causa; ver el detalle por-pregunta en el `AuditLog` (`metadata`) y en los scripts de recuperación.
- **Promoción incompleta**: Test 8 (2/98), Test 10 (74/98), Tests 4/6/7 con 1–2 preguntas faltantes — track
  aparte de completar promoción.
