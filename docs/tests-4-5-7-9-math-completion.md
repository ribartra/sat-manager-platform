# Completado de Math — Tests 4, 5, 7, 9

> **Estado (2026-08-10).** Recuperación agéntica de contenido Math de los 4 mock tests, aplicada al
> contenido **oficial** (los 4 ya estaban promovidos 44/44). Método: 4 agentes en paralelo
> produjeron un *plan de aplicación validado* en solo-lectura; el orquestador aplicó **en serie y
> WAL-safe**. Ver el playbook en [`ingest-agentic-recovery-strategies.md`](ingest-agentic-recovery-strategies.md).
> Batch `batch_e877446f45e144eda0a1e4199465e3d2`.

## 1. Ya APLICADO (verificado en dev.db, `integrity_check: ok`)

Escrito directo a las filas oficiales `Question` / `QuestionOption` (guardas: nunca pisar opción/valor
existente; solo se escribió lo `validated:true`).

| Test | Explicaciones | Opciones MC escritas | Figura | Estado oficial resultante |
|------|---------------|----------------------|--------|---------------------------|
| **4** | 40 | 22 | — | 44/44 con explicación · 32 MC con 4 opc · 12 NUMERIC |
| **5** | 42 | 30 (incl. 3 type-fix) | 1 materializada (`1:21`) | 44/44 con explicación · 35 MC con 4 opc · 9 NUMERIC |
| **7** | 0 (ya estaban) | 20 | — | 44/44 con explicación · 28 MC con 4 opc · 16 NUMERIC |
| **9** | 38 | 20 | — | 42/44 con explicación · 33 MC (31 con 4 opc) · 11 NUMERIC |
| **Total** | **120** | **92** | **1** | |

Detalles:
- **Explicaciones**: parseadas del docx `TestN_Math_Answer_Explanations.docx` (walk en orden,
  `MODULE`→`Question/Q`→celda `✓ Correct Answer` + `Solution`), limpiadas de refs `![img]()` y
  `[tbl-0.html]()`. Solo se rellenó donde el oficial estaba vacío.
- **Opciones**: recuperadas de la imagen de bloque de opciones (transcripción visual) o, cuando no hay
  imagen, de la enumeración del docx ("Choice X is…"); **cada set validado** contra la letra correcta y
  la matemática de la explicación. Math como `$…$` KaTeX.
- **Type-fix (T5)**: `1:12`, `2:1`, `2:2` estaban como NUMERIC siendo MC de 4 opciones → corregidas a MC
  con sus opciones.
- **Figura (T5 `1:21`)**: el crop estaba mal etiquetado `OPTION_BLOCK` pero es la gráfica del enunciado
  (exponencial p-vs-t); materializada a `public/uploads/questions/` y fijada `Question.imageUrl`.

## 2. Correcciones RETENIDAS — YA APLICADAS (validadas contra el ANS KEY)

> **Actualización (2026-08-10).** Tras extraer los **ANS KEY** docx de cada test (`TEST N ANS KEY.docx`),
> todos los casos retenidos quedaron **verificados por fuente** y se **aplicaron** (WAL-safe,
> `integrity_check: ok`). 11 correcciones. Dos mejoraron respecto al plan original: el "corrupto"
> T7 `2B:21` se recuperó a **4** desde el ANS key (ya no es manual), y el "conflicto de letra" T9 `1:21`
> resultó ser que **el oficial `C` ES correcto** (el ANS key confirma C; el agente se había guiado por la
> explicación) — solo se escribieron sus opciones.

**Aplicado:**
- **Signos NUMERIC** (ANS key confirma el negativo): T4 `2B:20` `21→-21`, T9 `1:1` `2→-2`,
  T9 `1:12` `2, 11→-2, 11`, T9 `2B:5` `1→-1`, T9 `2B:19` `3/25→-3/25`.
- **Respuesta corrupta** T7 `2B:21`: texto basura → `4` (ANS key MATH 2B Q21).
- **Type-fix NUMERIC→MC + opciones** (respuesta-letra ya correcta, confirmada por ANS key): T7 `1:18`
  (C), T7 `2B:19` (A).
- **Opciones** T9 `1:21` (MC, respuesta `C` sin cambio; opciones limpias de imagen A=(x−5)…D=(x+2)).
- **Tablas incrustadas en enunciado** (transcritas del PDF renderizado): T4 `2B:2` (a=3,6,9,12 →
  f(a)=−2,−1,0,1; opción A ✓) y T4 `2B:16` ("Vocabulary Test Scores": 100→1, 90→5, 80→10, 70→8, 60→2).

Guardas del aplicador (`apply-math-corrections.mjs`): cada op solo escribe si el estado actual coincide
con el "antes" esperado (idempotente); nunca pisa opciones/valores ya buenos.

### PENDIENTE (único) — requiere trabajo visual en la UI
- **T9 `2B:4`**: las 4 alternativas son **gráficas** (sistemas de inecuaciones), no texto. La respuesta
  `B` ya es correcta. Falta enlazar las 4 imágenes de opción como `QuestionOption.imageUrl` recortando
  las regiones en el review (herramienta crop-assign). No se automatiza para no inventar/mal-enlazar.

---

### (Histórico) Evidencia original de los casos retenidos
Por el invariante *"nunca escribir/cambiar una respuesta que no se pueda validar"*, estos habían quedado
sin tocar hasta verificarlos contra el ANS key. Cada uno con su evidencia.

### 2.1 Signos negativos perdidos en respuestas NUMERIC (patrón sistémico)
El oficial guardó el valor **positivo**; el docx + la matemática de la explicación coinciden en el
**negativo**. Mismo tipo de defecto que el off-by-one de Test 6.

| Test | Pregunta | Oficial (DB) | docx + explicación | Acción propuesta |
|------|----------|--------------|--------------------|------------------|
| 4 | `2B:20` | `21` | `-21` | corregir a `-21` |
| 9 | `1:1` | `2` | `-2` | corregir a `-2` |
| 9 | `1:12` | `2, 11` | `-2\|11` | corregir a `-2\|11` |
| 9 | `2B:5` | `1` | `-1` | corregir a `-1` |
| 9 | `2B:19` | `3/25` | `-3/25` | corregir a `-3/25` |

**Propuesta:** corregir los 5 en bloque (la evidencia docx+explicación es consistente). *Requiere tu OK.*

### 2.2 Conflicto de letra
| Test | Pregunta | Oficial | docx + explicación | Nota |
|------|----------|---------|--------------------|------|
| 9 | `1:21` | `C` | `D` = `(x+2)` | Opciones limpias de imagen (A=(x−5), B=(x−4), C=(x+1), D=(x+2)); el cero en x=−2 ⇒ D. Opción retenida (`validated:false`). |

**Propuesta:** verificar contra el ANS key oficial y, si confirma D, corregir letra + escribir opciones.

### 2.3 Respuesta corrupta
| Test | Pregunta | Oficial | Problema |
|------|----------|---------|----------|
| 7 | `2B:21` | `"It is given that has two distinct values such that"` | Texto del enunciado se filtró al `correctAnswer`; docx sin respuesta (perdida en el strip de KaTeX). NUMERIC (student-response). |

**Propuesta:** recuperar el valor del ANS key / PDF fuente manualmente; no es deducible del docx.

### 2.4 Type-mislabel pendientes (NUMERIC que son MC)
Sin imagen de opciones; opciones recuperables del docx. Marcadas `validated:false` para revisión.

| Test | Pregunta | Respuesta (letra) | Opciones |
|------|----------|-------------------|----------|
| 7 | `1:18` | `C` | del docx (pendiente > MC + opciones) |
| 7 | `2B:19` | `A` | del docx (pendiente > MC + opciones) |

**Propuesta:** corregir NUMERIC→MC + escribir opciones del docx (mismo patrón ya aplicado en T5).

### 2.5 Opciones que son imágenes (no texto)
| Test | Pregunta | Nota |
|------|----------|------|
| 9 | `2B:4` | Las 4 alternativas son gráficas (sistemas de inecuaciones); no hay texto que transcribir. |

**Propuesta:** enlazar las 4 imágenes de opción como `QuestionOption.imageUrl` (no inventar texto).

### 2.6 Tablas faltantes en el enunciado
Enunciado con `[tbl-0.html]` sin datos y sin artefacto de imagen de tabla.

| Test | Pregunta | Tabla |
|------|----------|-------|
| 4 | `2B:2` | tabla de función lineal (input/output) |
| 4 | `2B:16` | tabla de distribución de puntajes |

**Propuesta:** transcribir la tabla del PDF de preguntas e incrustarla inline en el enunciado.

### 2.7 Explicaciones a verificar (T9)
- `2B:14`, `2B:15`: docx sin explicación (opciones sí recuperadas de imagen).
- `1:19`: explicación del docx degradada (valores numéricos en blanco) — se dejó como estaba; revisar.

## 3. Cómo se aplicará lo pendiente (si autorizas)

1. **Signos NUMERIC (2.1)** — patch directo `UPDATE Question SET correctAnswer` para las 5 (guard: solo
   si el valor actual es el positivo esperado). WAL-safe.
2. **Type-mislabels (2.4)** y **conflicto de letra (2.3→2.2)** — vía el mismo aplicador (`typeFix:"MC"`
   + opciones; y para `1:21` escribir opciones + corregir letra tras verificar ANS key).
3. **Opciones-imagen (2.5)** — enlazar 4 `QuestionOption.imageUrl` desde los artefactos de imagen.
4. **Tablas (2.6)** — transcribir del PDF + `UPDATE Question SET stem`.
5. **Respuesta corrupta (2.7/2.3)** — recuperación manual del ANS key; sin automatizar.

Todo lo anterior es **WAL-safe** (`docker compose stop web` con ingest arriba → escritura en one-off →
`wal_checkpoint(TRUNCATE)` + `integrity_check` → `start web` → verificar DNS) y **auditado**.

## 4. Procedimiento usado (para trazabilidad)

- 4 agentes paralelos, uno por test, en **solo-lectura** sobre `dev.db`; entregaron
  `scratchpad/_tmp/tN-math-agentplan.json` validados.
- Toolkit compartido `scratchpad/_tmp/mathkit.cjs` (diagnóstico por-pregunta + volcado de imágenes) y
  `parse_expl.py` (docx). Aplicador serial `apply-math-agentplan.mjs` (guardas COALESCE, resuelve
  `officialQuestionId` desde el candidato, checkpoint+integrity al final).
- Los agentes T4/T7 terminaron directo; T5/T9 se cortaron por límite de sesión y se re-despacharon
  reutilizando su diagnóstico ya en disco.
- `scratchpad/_tmp/` es throwaway y **no se versiona**.

## 5. Verificación de respuestas (corrupción)
- T4: 43/44 match (1 signo). T5: 44/44 (sin mismatches reales). T7: 43/44 (1 corrupta, 1 benigna
  ASCII/Unicode minus). T9: 39/44 (4 signos + 1 letra).
- Conclusión: contenido limpio salvo los casos de §2; el patrón de signos NUMERIC (§2.1) es el hallazgo
  a resolver en bloque.
