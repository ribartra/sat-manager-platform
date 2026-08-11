# Estructura documental de los conjuntos de ingesta — Math y R&W

> Referencia para **generalizar parsers**. Documenta, por sección (Math / R&W), la
> estructura documental de los archivos de cada conjunto, sus características
> independientes, y qué lógica de extracción cubre mejor cada campo. Sintetiza las
> consideraciones y los scripts de corrección aplicados durante la recuperación de
> contenido (Tests 1–10).
>
> Fuentes de verdad en código: `lib/ingest-sets.ts` (`classifyQuestion`),
> `lib/ingest-sets.server.ts` (`computeConjuntos`), `lib/ingest-promotion.ts`
> (`sanitizeStem`, `sanitizeExplanation`, `buildQuestionDraft`),
> `ingest_service/app/practice_repair.py`, `lib/answer-grading.ts`.
>
> Inventario de **procesamientos ya aplicados** (campañas, scripts, residuales):
> [`docs/procesamientos-ingest.md`](docs/procesamientos-ingest.md).
>
> Estructura del **Digital SAT** (preguntas, tiempos, módulos) y paridad con el player:
> [`docs/sat-digital-estructura-vs-plataforma.md`](docs/sat-digital-estructura-vs-plataforma.md).

---

## 0. Modelo de conjunto (recordatorio)

Un **conjunto** = el **grupo de archivos fuente** que juntos arman un set, no un archivo.

- **Full Practice Test** → clave de agrupación `(testNumber, section)`. Cada sección
  (`RW`, `MATH`) es un conjunto de ~54 (R&W) / ~44 (Math) preguntas, con módulos `1` y
  `2`/`2B`.
- **Practice Set** → clave `(section, topicName, difficulty, practiceSetVariant)`.
- **Roles de archivo** dentro del conjunto (`IngestSourceFile`):
  - `QUESTION` (`isQuestionSource=1`, `sourceKind=MOCK_EXAM` / `PRACTICE_EXERCISE`) — **archivo
    primario**; aquí viven los `IngestQuestionCandidate`.
  - `ANSWER` (`isAnswerFile=1`, `sourceKind=ANSWER_KEY`) — la clave de respuestas.
  - `EXPLANATION` (`isExplanationFile=1`, `sourceKind=ANSWER_EXPLANATION`) — soluciones; a
    menudo **combinado** con ANSWER (`ANS+EXPL`: trae respuesta *y* explicación).
- **ANS KEY de test completo**: un `ANSWER_KEY` puede venir con `section = NULL` (cubre todo
  el test) → se **adjunta a TODAS las secciones** del test. Etiquetado inconsistente en el
  corpus: unos ANS KEY están marcados `section=MATH`/`RW`, otros `NULL` — un parser debe
  aceptar ambos (buscar por `testNumber` con `section IN (target, NULL)`).
- **Dónde vive el dato**: las preguntas se promueven de `IngestQuestionCandidate`
  (staging, con el OCR en `rawJson.text`) a `Question` oficial (lo que ve el estudiante).
  La completitud SIEMPRE se mide sobre la `Question` oficial cuando `officialQuestionId`
  existe; si no, sobre el candidato.

### Los 5 campos y su clasificación (`classifyQuestion`)

| Campo | ok | atención (warn) | revisar (crit) | info | n/a |
|---|---|---|---|---|---|
| **enunciado** (stem) | tiene texto | — | vacío | — | — |
| **estímulo** (pasaje) | hay pasaje | vacío (solo R&W) | — | — | Math |
| **opciones** (MC) | ≥4 textos | parciales (1–3) | 0 y sin imágenes | ≥4 imágenes | NUMERIC |
| **respuesta** | hay `correctAnswer` | — | vacío | — | — |
| **explicación** | existe | — | — | ausente | — |

`level` escala al peor; `info` nunca lo baja. **NUMERIC** ⇒ `opciones = n/a`. Respuesta
NUMERIC multi-valor se guarda **pipe-delimited** (`"2|6"`, `"7|8|13"`); comparación SIEMPRE
vía `lib/answer-grading.ts` (`isAnswerCorrect`), nunca `===` crudo.

---

## 1. Catálogo transversal de formatos de archivo

Antes de bajar a cada sección, tres taxonomías que atraviesan Math y R&W.

### 1.1 Archivo de preguntas (QUESTION / primario)

| Variante | Cómo se detecta | Dónde está el contenido | Notas |
|---|---|---|---|
| **PDF texto+imagen** | `.pdf`, `rawJson.text` poblado | stem/estímulo como texto; opciones a veces como **imagen** `![img-N.jpeg]` | el caso común de mock exams |
| **DOCX texto** | `.docx`, párrafos/tablas con texto | todo en texto | práctica y algunos mocks |
| **DOCX image-only** | `.docx`, ~0 párrafos de texto, ≥3 imágenes de página | **todo** el enunciado/pasaje es imagen | **T1 R&W**; requiere OCR/transcripción de `word/media/*` |

### 1.2 Archivo de respuestas (ANSWER_KEY)

| Formato | Estructura | Trampa |
|---|---|---|
| **Grid por módulo** (p.ej. T6) | 1 tabla; fila 0 = nombres de módulo (`RW MOD 1 | RW MOD 2B | MATH MOD 1 | MATH MOD 2B`); filas `N.  <resp>` una por pregunta | limpio; 1 celda = 1 respuesta |
| **Posicional por módulo** (p.ej. T3) | 1 tabla; **cada columna-módulo es UNA celda** con respuestas separadas por `\n` en orden 1..N | al final un bloque `EXTRA` con correcciones tipo `21. 113` / `2. -11` — **sospechosas**: en T3 el usuario confirmó que se añadieron por accidente y NO aplican; el valor posicional pre-EXTRA es el correcto |

En ambos: NUMERIC aparece inline (`-2`, `18`, `3.2`, `-6/5`, `2, 6`→`2|6`). El OCR **pierde
el signo negativo** con frecuencia (defecto sistémico corregido en varios Math).

### 1.3 Archivo de explicaciones (ANSWER_EXPLANATION) — **estilo de autoría por-test**

Hallazgo central para generalizar: **el formato del docx de explicaciones es una elección de
autoría por test, y es consistente entre las secciones Math y R&W del mismo test.** Basta
detectarlo una vez por test. Cuatro estilos observados:

| Estilo | Marcador de respuesta | Texto de opción correcta | Tests | Estructura |
|---|---|---|---|---|
| **A · "Choice X is the best answer"** | `Choice ([A-D]) is the best answer` | no siempre | T1, T2 | tablas 1×1 (a veces la 1ª pregunta de un módulo va inline en un párrafo) |
| **B · "Correct Answer: X — texto"** | `✓ Correct Answer: ([A-D])\s*[—-]\s*(texto)` | **sí** (tras `—`) | T5, T6, T7, T8, T10 | tablas 1×1 (T8: 2 filas, resp en fila 0) |
| **C · Tabla ✓ marcada** | fila cuyo `cell[0]` = `^[✓✔]\s*([A-D])` | **sí** (`cell[1]`) | T3 | tabla 5×3: `Answer | Choice | Why Correct/Eliminated` |
| **D · Párrafos** | `Correct Answer:\s*Choice ([A-D])` | **sí** (`Choice X (texto) is correct`) | T9 | sin tablas; todo en párrafos |

Regla de oro de **alineación**: nunca emparejar docx→pregunta solo por orden de cuerpo
(produce falsos positivos). Validar la alineación matcheando el **texto de la opción
correcta** del docx contra `QuestionOption[letter].text` de la BD (ver §6.3).

---

## 2. CONJUNTO **MATH** — estructura y extracción por campo

Módulos `1` y `2`/`2B`, ~22 preguntas cada uno (44/test). Tipos: `MC` (4 opciones) y
`NUMERIC` (grid-in, sin opciones). **Sin estímulo** (campo n/a).

### 2.1 Archivos del conjunto
- **QUESTION** (`MOCK_EXAM` PDF): stems como texto; **opciones MC frecuentemente como
  imagen** (screenshot del bloque A–D) → `![img-N.jpeg]` en `rawJson.text`.
- **ANSWER_KEY**: grid o posicional (§1.2).
- **ANSWER_EXPLANATION**: estilo A/B/C/D (§1.3) — para Math incluye la **solución trabajada**
  además de la letra.

### 2.2 Extracción por campo

**Enunciado (stem)**
- Fuente: `rawJson.text` del candidato (o el promovido).
- Defecto **header-dump**: la 1ª pregunta de cada módulo arrastra el encabezado del doc
  (`## INNOVATOR TEST N` / `MATH MODULE 1`). Cubierto por `sanitizeStem()` en
  `lib/ingest-promotion.ts` (quita líneas-encabezado desde arriba hasta el `N.` numerado;
  **nunca vacía**; fallback al original). Regexes en `STEM_HEADER_LINE`.
- Corrección de datos ya promovidos: `scratchpad/_tmp/clean-stem-headers.mjs` (WAL-safe).

**Opciones (MC) — el defecto "sin opciones"**
- Causa raíz: las 4 opciones se renderizaron como **imagen por pregunta**; OCR emitió el
  stem como texto y el bloque de opciones como `![img-N.jpeg]`. Promoción creó 4
  `QuestionOption` con `text` vacío (o 0 filas). Magnitud corpus: ~397 MC (169 Math).
- Localizar la imagen: parsear `![img-N.jpeg]` del `rawJson.text` → `IngestImageArtifact`
  por `(sourceFileId, pageNumber, imageId=img-N.jpeg)` (`base64Data`). **Una imagen puede
  apilar dos bloques** (pregunta vecina sin ref toma el bloque inferior).
- Extracción **fiable**: **ver la imagen y transcribir A–D** (el endpoint
  `/candidates/{id}/parse-option-image` de Mistral es poco fiable con grids numéricos → lee
  "20.25" como tabla). Herramienta: `mathkit.cjs dumpimg <candidateId> <outDir>` → leer el
  `.jpg` con la herramienta de imagen.
- Convención: math en las opciones como `$...$` KaTeX; números/`$` literal tal cual.
- **Validación obligatoria**: la letra `correctAnswer` guardada debe ∈ {A,B,C,D} y mapear a
  una opción producida (orden A,B,C,D del bloque). Si no valida → no escribir (revisión).

**Respuesta (`correctAnswer`)**
- Fuente primaria: `ANSWER_KEY` (§1.2). Secundaria/validación: la letra del
  `ANSWER_EXPLANATION`.
- NUMERIC: multi-valor pipe-delimited; recomponer signos/decimales perdidos por OCR
  (`-6/5`, `3.2`, `2, 6`→`2|6`). Cruce posicional en formato T3: mapear celda-newline a
  `questionNumber` 1..N; **ignorar el bloque `EXTRA`** salvo verificación explícita.
- Adjudicación en conflicto: la **explicación trabajada** (docx) gana sobre la letra si el
  desarrollo matemático la contradice (p.ej. T3 2:21 la "Answer:42" era copy-paste de Q17;
  la matemática daba −21). **Nunca** invertir a un valor no verificado.

**Explicación**
- Fuente: `ANSWER_EXPLANATION` (estilo por-test). Parsear la solución trabajada por pregunta.
- Defecto header-dump (igual que stem) → `sanitizeExplanation()`; corrección de datos:
  `clean-expl-headers.mjs`. El dump concentró explicaciones de todo un módulo en la Q1 →
  re-derivar por pregunta (`parse_expl.py`), no solo limpiar la Q1.
- **Si no hay doc de explicaciones (T4): dejar vacío, nunca fabricar.**

### 2.3 Defectos Math y guardas

| Defecto | Guarda / fix |
|---|---|
| Opciones como imagen ("sin opciones") | transcribir+validar vs respuesta; WAL-safe |
| Header-dump en stem/explicación (Q1 de módulo) | `sanitizeStem` / `sanitizeExplanation` en `buildQuestionDraft` |
| Signo negativo perdido en NUMERIC | recomponer desde ANS KEY / explicación |
| `EXTRA`-corrections espurias en ANS KEY posicional | ignorar salvo confirmación (T3: accidentales) |
| Candidatos duplicados (23º por módulo) | rechazar el stray (`promotionStatus=REJECTED`), nunca el promovido |

---

## 3. CONJUNTO **R&W** — estructura y extracción por campo

Módulos `1` y `2`/`2B`, 27 preguntas cada uno (54/test). **~100% MC** (4 opciones de texto).
Campo central adicional: **estímulo** (pasaje). `NUMERIC` en R&W = mislabel.

### 3.1 Archivos del conjunto
- **QUESTION** (`MOCK_EXAM` PDF/DOCX): `rawJson.text` con la anatomía de §3.2. Caso especial
  **DOCX image-only** (T1): pasajes como screenshots.
- **ANSWER_KEY** y/o **ANSWER_EXPLANATION**: §1.2 / §1.3.

### 3.2 Anatomía del `rawJson.text` de una pregunta R&W
```
## INNOVATOR TEST 5            ← encabezado (descartar)
### READING AND WRITING        ← encabezado (descartar)
#### MODULE 1                  ← encabezado (descartar)
<PASAJE / ESTÍMULO...>         ← estímulo (bloque de prosa ANTES del enunciado numerado)
NEXT QUESTION / PREV. QUESTION / COME BACK LATER   ← ruido de navegación (descartar)
1. Which choice completes...   ← enunciado (empieza con "N.")
☒ A manage                     ← opciones (glyph ☒/☐/☑/✕ + letra + texto)
☒ B justify
☒ C construct
☒ D define
```
Consideraciones:
- **El glyph ☒/☐/☑/✕ NO codifica la respuesta correcta** — OCR ruidoso de checkboxes vacíos
  (a veces todos ☒, a veces todos ☐). Solo sirve para **localizar** el bloque. La respuesta
  viene del ANSWER file.
- **Estímulo compartido / "anchor candidates"**: el OCR a veces concatena varios pasajes en
  un candidato "ancla" (p.ej. T3 Q3/6/8/10/12…), dejando los siguientes con estímulo vacío.
  El pasaje de una pregunta vacía se recupera del ancla o del candidato **vecino** (p.ej. T5
  1:14 tenía su pasaje en 1:13; T2 1:4 en 1:3).
- **No todo item tiene estímulo** (convenciones/gramática) → si genuinamente no hay pasaje,
  `estimulo` queda `warn` legítimo o se deja vacío; no inventar.

### 3.3 Extracción por campo

**Estímulo (pasaje)**
- Fuente normal: bloque de prosa previo al `N.` en `rawJson.text` (quitar encabezados y ruido
  de navegación). Recuperar de ancla/vecino cuando el propio candidato solo trae opciones.
- **T1 (image-only)**: extraer `word/media/image*.png` del docx, **leer cada imagen y
  transcribir verbatim**; mapear imagen→pregunta por el número visible / hint del
  answer-doc (nunca posicional a ciegas). Nunca coser un pasaje de fragmentos de la
  explicación y presentarlo como original → si solo hay cita parcial: `NEEDS_HUMAN`.

**Opciones (MC)**
- Vivían en `rawJson.text` como `☒/☐ A <texto>` pero no se promovieron a `QuestionOption`.
- Parsear A–D **en orden** (quitar glyph + etiqueta). Formatos alternos: `A) texto`,
  `A. texto`. Preservar puntuación significativa (items de convenciones). Math inline en
  R&W es raro → `$...$` solo si aparece notación.
- **Validar**: `correctAnswer` ∈ {A,B,C,D}. Cruce fuerte: la explicación cita el texto de la
  opción correcta ("Choice X is correct because '<texto>'") → confirmar el mapeo letra↔texto.

**Enunciado (stem)**: normalmente presente; mismo guard `sanitizeStem` para header-dump.

**Respuesta (`correctAnswer`) — defecto de corrimiento (off-by-one)**
- Fuente: ANSWER file (§1.2/§1.3).
- **Defecto detectado en T2**: cada pregunta guardaba la respuesta de la **siguiente**
  (`BD[N] == correcta[N+1]`, 29/30). Origen: ingesta de candidatos (`candAnswer==official`),
  no promoción. Corregido a `docx[N]` (verdad por pregunta), verificado leyendo estímulo BD
  vs explicación (p.ej. 1:21 "bamboo" singular→posesivo "its"=C, no A).
- **Auditoría de todo el corpus**: el corrimiento estaba **aislado a T2**. T1/T3/T5/T6/T9
  cross-validan correctos; T7/T8/T10 no confirmables por tool (huecos propios / casi sin
  promover / prior-validado). Regla: nunca aplicar una corrección de respuesta sin
  validación por texto (§6.3).

**Explicación**: estilo por-test (§1.3). Si no hay fuente (T4): vacío, nunca fabricar. El
dump de módulo también aplica a R&W (re-derivar por pregunta; `distribute-rw-expl.mjs`
distribuyó explicaciones a las preguntas vacías con COALESCE + gate `parsed==official`).

### 3.4 Defectos R&W y guardas

| Defecto | Guarda / fix |
|---|---|
| Opciones en `rawText`, no promovidas | parsear ☒-bloque + validar vs respuesta |
| Glyph ☒/☐ leído como "la marcada = correcta" | **prohibido**; respuesta solo del ANSWER file |
| Estímulo vacío / concatenado en ancla | recuperar de ancla/vecino; T1 vía OCR-imagen |
| Corrimiento de respuestas (T2) | corregir a `docx[N]` con validación por texto |
| Corrupción de opción-A (estímulo filtrado al slot A) | baja confianza → revisión humana (T2 2B:10/2B:27) |
| Sin fuente (explicaciones T4, respuestas sin promover) | dejar vacío / `NEEDS_HUMAN` |

---

## 4. Lógica de parseo **generalizable**

### 4.1 Contrato de extractor por campo (por conjunto)
Un parser generalizado debería exponer, por conjunto, funciones puras:
```
extractStem(candidate)         -> string      (sanitizeStem)
extractStimulus(candidate,ctx) -> string|null (rawText block | anchor/neighbor | image-OCR)
extractOptions(candidate)      -> [{label,text}] | imageRefs   (☒-block | image | docx)
extractAnswer(ansSources,key)  -> letter|numeric               (grid | positional | expl)
extractExplanation(explDoc,key)-> string|null
```
Cada uno devuelve **null cuando no hay fuente fiable** (→ `NEEDS_HUMAN`), nunca un valor
inventado.

### 4.2 Detección de formato (una vez por test)
1. **Question source**: `.pdf` → texto+img; `.docx` con ≥3 imágenes y texto ínfimo →
   image-only; si no → docx-texto.
2. **ANS KEY**: si alguna celda-módulo contiene múltiples `\n` con letras sueltas →
   posicional; si hay filas `N.  <resp>` → grid.
3. **Explicaciones**: probar en orden los marcadores del §1.3 sobre el doc completo:
   `Choice X is the best answer` (A) · `Correct Answer: X —` (B) · fila `^✓ [A-D]` en tablas
   5×3 (C) · `Correct Answer: Choice X` en párrafos (D). El estilo detectado sirve para
   **ambas** secciones del test.

### 4.3 Alineación docx↔pregunta (la lección de la auditoría)
- **Nunca** confiar en el emparejamiento por orden de cuerpo: un doc con explicaciones
  inline (p.ej. una pregunta sin tabla) o con conteos desiguales (módulo con preguntas sin
  promover) produce **desalineación en cascada** → mismatches falsos.
- **Validar por contenido**: cuando el estilo expone el **texto de la opción correcta**
  (estilos B/C/D), matchear `normaliza(textoDocx) ⊆/⊇ normaliza(QuestionOption[letter].text)`.
  Exigir **≥90% de alineación por texto** antes de confiar en cualquier comparación de
  letras. Si <90% → herramienta desalineada, no aplicar (auditar a mano o con agente).
- Para el estilo A (sin texto de opción): validar leyendo **estímulo BD vs explicación** en
  una muestra antes de aplicar en masa (como se hizo con T2).

### 4.4 Invariantes de validación (siempre)
1. **Recuperar de fuente, nunca adivinar.** Sin fuente fiable → `NEEDS_HUMAN`.
2. **Nunca vaciar** un campo poblado; los rellenos solo llenan vacíos (COALESCE/guards).
3. **Respuesta ∈ opciones**: la letra debe mapear a una opción real; NUMERIC debe ser
   numérico/pipe válido.
4. **Glyph ☒/☐ irrelevante** para la respuesta.
5. **Nunca invertir una respuesta** sin prueba (explicación trabajada / verificación por
   estímulo); comparar respuestas vía `lib/answer-grading.ts`.
6. **Rechazar duplicados**, nunca el candidato promovido.
7. **confidence:"low" → no se aplica**, se surfacea para humano.

---

## 5. Protocolo de escritura WAL-safe (obligatorio)

`dev.db` está en modo WAL; escrituras externas mal hechas lo corrompen. Procedimiento
usado por todos los `apply-*.mjs`:

1. Construir un **plan JSON** validado (dry-run por defecto; `MODE=APPLY` para escribir).
2. `docker compose stop web` (dejar `ingest-service` **arriba** para no romper el DNS
   web→ingest; nunca parar ambos).
3. Escribir vía contenedor efímero: `docker compose run --rm --no-deps -T -e MODE=APPLY web
   node /app/scratchpad/_tmp/apply-*.mjs …` (better-sqlite3, escritor único).
4. Cerrar con `PRAGMA wal_checkpoint(TRUNCATE)` + `PRAGMA integrity_check` ("ok").
5. Verificar persistencia con una conexión **fresca read-only**.
6. `docker compose start web`; confirmar `getent hosts ingest-service`.
7. Antes de commitear `dev.db`: web parado → checkpoint(TRUNCATE) → integrity ok → commit.

Los scripts en `scratchpad/_tmp/` corren con ruta de contenedor `/app/scratchpad/_tmp/…`
(el `$CLAUDE_JOB_DIR/tmp` NO está montado). `scratchpad/` **no** está en `.gitignore` →
nunca `git add` esos scripts.

---

## 6. Toolkit — scripts y qué generaliza cada uno

| Script (`scratchpad/_tmp/…` salvo indicado) | Rol | Generaliza |
|---|---|---|
| `mathkit.cjs` `diag|dumpimg <test>` | diagnóstico read-only Math + volcado de imágenes | extractor de estado Math + acceso a imágenes de opción |
| `rwkit.cjs` `gaps|diag|dumpimg <test>` | diagnóstico read-only R&W (flags por campo) | worklist de huecos + detección de mislabels |
| `apply-t36-math.mjs` | aplicador Math (SET_OPTIONS/FIX_ANSWER/FIX_TYPE/DEMOTE) | plantilla de aplicador WAL-safe Math |
| `apply-rw.mjs` | aplicador R&W (SET_OPTIONS/SET_STIMULUS/SET_EXPLANATION/FIX_ANSWER) con `NO_FIX_ANSWER` | plantilla de aplicador WAL-safe R&W (rellenos vs respuestas) |
| `apply-t2-answers.mjs` + `t2_answer_map.py` | corrección de respuestas verificada (off-by-one) | patrón de corrección de answer-key con guardas |
| `audit2_rw.py` | auditor multi-formato con **validación por texto de opción** | auditoría generalizada de respuestas (estilos A/B/C) |
| `audit_t9.py` | auditor estilo-párrafo | auditoría estilo D |
| `clean-stem-headers.mjs` / `clean-expl-headers.mjs` | fix de header-dump en datos ya promovidos | saneo retroactivo |
| `distribute-rw-expl.mjs` / `parse_expl.py` | distribuir/re-derivar explicaciones por pregunta | des-concentrar el dump de módulo |
| `ingest_service/app/practice_repair.py` | parser por marcadores de práctica (`Question ID`→stem/opts/estímulo/num) | parser generalizado de práctica (con tests) |
| `AGENT_CONTEXT_RW_T1_5.md` | brief para agentes de recuperación read-only | contrato de agente → plan JSON validado |

**Patrón de operación generalizado** (Math y R&W): agentes read-only (uno por test) leen
diag + fuentes y emiten un **plan JSON validado** → el orquestador **aplica en serie**
WAL-safe con guardas. Nunca escritores SQLite concurrentes.

---

## 7. Matriz resumen — fuente → parser → validación

| Sección · Campo | Fuente primaria | Lógica de extracción | Validación |
|---|---|---|---|
| Math · stem | question `rawText` | texto + `sanitizeStem` | no vacío |
| Math · opciones | imagen `![img-N]` (o texto) | localizar `IngestImageArtifact` + **transcribir** | resp ∈ A–D; mapea |
| Math · respuesta | ANS KEY (grid/posicional) | por posición 1..N; ignorar `EXTRA` | signo/pipe; explicación gana en conflicto |
| Math · explicación | ANSWER_EXPLANATION (A/B/C/D) | solución trabajada por pregunta | `sanitizeExplanation`; si no hay fuente → vacío |
| R&W · estímulo | question `rawText` (bloque pre-`N.`) / ancla / imagen (T1) | quitar encabezados+nav; OCR-imagen en T1 | fiel; parcial → `NEEDS_HUMAN` |
| R&W · opciones | question `rawText` (☒-bloque) | A–D en orden, quitar glyph | resp ∈ A–D; cruce con texto de explicación |
| R&W · respuesta | ANS KEY / explicación | letra por pregunta | **validar por texto** ≥90%; ojo off-by-one (T2) |
| R&W · explicación | ANSWER_EXPLANATION (A/B/C/D) | por pregunta | si no hay fuente → vacío |

---

## 8. Estado de cobertura (contexto, 2026-08)

- **R&W barridos T1–T5**: 99 opciones + 35 estímulos rellenados; T2 con 31 respuestas
  corregidas (off-by-one). T1/T2/T3/T5 al 100%; T4 al límite de sus fuentes (sin doc de
  explicaciones; 2 preguntas sin promover). Detalle: artifact de cobertura R&W.
- **R&W pendientes T6–T10**: mismos formatos/defectos; huecos de contenido (T8 casi sin
  promover). Respuestas de T6/T9 auditadas limpias.
- **Math T1–T10**: recuperación de opciones-imagen + answer-key + explicaciones aplicada en
  sesiones previas; secciones Math de T3/T6 a 0 huecos.

Ver memorias del proyecto: `conjunto-model`, `mc-option-image-recovery`,
`answer-key-recovery`, `rw-recovery-and-t2-answer-shift`, `explanation-header-dump-defect`,
`ingest-practice-candidate-repair`, `devdb-wal-checkpoint-corruption`.
