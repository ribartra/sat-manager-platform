# Inventario del contenido cargado

Este documento describe:
1. El corte del proyecto.
2. Las características del sistema.
3. Qué se extrajo de los archivos fuente y cómo.
4. Qué contenido quedó cargado y es útil para los alumnos.

Cómo se agrupa el contenido:
- **Practice Sets:** en tres áreas, **Reading**, **Writing** y **Math**.
- **Full Practice Tests (FPT):** en dos secciones, **R&W** y **Math**, igual que en los módulos del test.

---

## 1. Corte del proyecto

| Aspecto | Valor |
|---|---|
| Fecha de corte | **2026-09-30** (versión anterior: 2026-09-28) |
| Rama de trabajo | `feat/obs-fixes-nav-stats-review`, subida a `origin` |
| Último commit | `d2a1324`: un único ancho de página en todas las vistas |
| Rama `main` | `2099613`: runbook de despliegue. Los arreglos de contenido de la rama aún no están fusionados en `main` |
| Producción | https://satsol.org. `/api/health` responde 200 |
| Versión desplegada en prod | Imágenes `web` e `ingest` con el tag `ws-20260929-ui-margins`, que corresponde a `d2a1324` (Artifact Registry `us-central1-docker.pkg.dev/sat-sol-gsc/sat-images`) |
| Infraestructura | GCP, proyecto `sat-sol-gsc`. Una VM `sat-vm` (e2-medium, us-east1-b) con docker compose: `web` + `ingest-service` + Caddy (HTTPS con Let's Encrypt) |
| Base de datos | SQLite (`/data/db/dev.db` en la VM, `./dev.db` en local, versionado con Git LFS) |
| Medios | Imágenes de preguntas en `gs://sat-sol-gsc-sat-data/media/questions/`, con copia en el disco del contenedor |
| Paridad de contenido | Local y prod tienen los mismos conteos: preguntas por estado, sets, vínculos, tests, módulos y vínculos de test, además de la misma trazabilidad candidata→pregunta. Cada corrección de contenido se aplicó en ambos lados. Los 2 lotes de ingesta PENDING que existían solo en prod se eliminaron el 2026-09-28 (ver 3.3). **Re-verificado el 2026-09-30:** el mismo script de recuento de solo lectura (por área, skill, dificultad, explicaciones, imágenes, pasajes, NUMERIC, pretest, por test y nombres de los 91 sets) da una salida idéntica en local y en prod |

**Nota sobre el código:** los cambios de UI que al corte anterior estaban sin commitear ya están commiteados y desplegados:
- navegación, filtros y estadísticas;
- ficha única del alumno y reporte PDF;
- taxonomía oficial;
- ancho único de página.

**Este inventario solo cubre contenido**, que es igual en local y en prod.

---

## 2. Características del sistema

Es una plataforma de preparación para el SAT digital.

**Arquitectura:**
- Una app web **Next.js 16** (App Router, React 19, TypeScript).
- **Prisma 7** sobre **SQLite** (`better-sqlite3`).
- Un servicio aparte **FastAPI** (Python 3.12) para ingerir documentos con OCR (Mistral `mistral-ocr-latest`).

**Otras piezas:**
- Autenticación: NextAuth v5 (credenciales y JWT). Los permisos (RBAC) se validan en el servidor, en los layouts y en las rutas API.
- UI: Tailwind v4, Radix UI y KaTeX para las fórmulas.
- Correo: SMTP (Nodemailer).

| Portal | Rol | Funciones principales |
|---|---|---|
| `/admin` | ADMIN | Usuarios, profesores, programas, taxonomía, configuración (clave Mistral cifrada AES-256-GCM), logs de auditoría, ingesta IA y promoción |
| `/teacher` | TEACHER | Alumnos (acotados a sus programas), padres, banco de preguntas, Practice Sets, FPT, asignaciones, grupos, analytics, comparativas, reportes PDF, materiales, desbloqueos, vista "como alumno" |
| `/student` | STUDENT | Mapa de contenido (skill × dificultad), Practice Sets asignados, FPT, historial, resultados con revisión, materiales, programa |
| `/parent` | PARENT | Progreso y reportes de los hijos vinculados (acceso por enlace con token) |

### Funciones de contenido y evaluación

**Banco de preguntas:**
- Tipos: `MC` (4 opciones A–D) y `NUMERIC` (respuesta abierta; admite varias respuestas válidas separadas por `|`).
- Estados: `DRAFT`, `PUBLISHED` y `ARCHIVED`.
- Cada pregunta puede tener:
  - pasaje (`stimulus`);
  - imagen de pregunta;
  - imágenes de opciones;
  - explicación.

**Practice Sets:**
- Un set agrupa preguntas de una habilidad y una dificultad.
- El player tiene autoguardado, pausas, envío, corrección y revisión.
- Cómo se ve la explicación: inmediata, al terminar u oculta.

**Full Practice Tests:**
- Cuatro módulos, como el SAT digital: R&W M1, R&W M2, Math M1 y Math M2.
- Tiempo por módulo, descanso y preguntas pretest.
- La puntuación se convierte a la escala SAT con `FullPracticeTestScoreConversion` (92 filas).

**Intentos inmutables:**
- Al enviar, el intento guarda una *snapshot* del set o test y de sus preguntas.
- Así, editar el contenido después no altera los resultados históricos.

**Taxonomía en la base:**
- 2 áreas, 8 dominios y 45 skills (`TaxonomyNode`).
- 51 filas en `Topic`:
  - 45 son skills académicos. **29 son los skills oficiales** (19 de Math, 6 de Reading y 4 de Writing), y todo el contenido de los Practice Sets está en ellos. Los otros **16 son heredados**, sin preguntas ni sets.
  - 6 son marcadores genéricos para los FPT.
- **Nombres y orden oficiales (2026-09-29, `lib/taxonomy-order.ts`):**
  - Math sigue el *SAT Math — Skills Tracker* del College Board.
  - Reading sigue la lista del College Board, así que *Cross-Text Connections* pasa a **Craft and Structure** y *Central Ideas and Details* pasa a llamarse **Main Ideas and Details**.
  - Writing no cambia.
  - Filtros, mapas de contenido y reportes muestran solo los 29 skills oficiales; los heredados siguen en la base, ocultos.
- En la implementación actual `Topic` ocupa el nivel de Skill. Falta un nivel Topic real debajo del Skill. La tabla `Subskill` está vacía (0 filas) y se decidió que sea ese futuro nivel Topic (2026-09-29); ver README, "Taxonomía Académica".

**Ingesta:**
- Nunca escribe directamente en el banco oficial.
- Los documentos pasan por staging (`Ingest*`), revisión en el asistente y promoción trazable (`IngestPromotionArtifact`).

---

## 3. Qué se extrajo: fuentes y proceso

### 3.1 Archivos fuente (`files_to_load/`, 311 MB, 231 archivos)

Se ingirieron los 231 archivos, en un lote (`IngestBatch`) procesado del 2026-07-22 al 2026-08-08.

| Carpeta | Archivos | Detalle |
|---|---:|---|
| `PRACTICE EXERCISES/EXERCISES READING` | 36 PDF | 18 de preguntas + 18 de respuestas (ANS). 6 subcarpetas: Main Idea and Details, Words in Context, Text Structure and Purpose, Command of Evidence, Double Passage (= Cross-Text Connections), Inferences |
| `PRACTICE EXERCISES/EXERCISES WRITING` | 30 PDF | 15 de preguntas + 15 ANS. Subcarpetas: Boundaries (12), Transitions (6), Structure and Grammar (6), Student Notes (6, = Rhetorical Synthesis) |
| `PRACTICE EXERCISES/EXERCISES MATH` | 116 PDF | 58 de preguntas + 58 ANS. Subcarpetas: Algebra (30), Advanced Math (18), Problem Solving and Data Analysis (44), Geometry & Trigonometry (24) |
| `MOCK EXAMS/TEST 1 … TEST 10` | 49 (19 PDF + 30 DOCX) | Por test: enunciados R&W y Math, explicaciones R&W y Math, y clave de respuestas (ANS KEY). Detalle abajo |

Clasificación de los archivos en la ingesta (`IngestSourceFile`):

| Tipo de contenido | Tipo de fuente | Sección | Formato | Archivos | Páginas |
|---|---|---|---|---:|---:|
| Practice Set | Enunciados (`PRACTICE_EXERCISE`) | Math | PDF | 58 | 843 |
| Practice Set | Enunciados | R&W (Reading + Writing) | PDF | 33 | 791 |
| Practice Set | Clave + explicación (`ANSWER_KEY`) | Math | PDF | 58 | 921 |
| Practice Set | Clave + explicación | R&W | PDF | 33 | 850 |
| FPT | Enunciados (`MOCK_EXAM`) | Math | PDF | 10 | 180 |
| FPT | Enunciados | R&W | PDF | 9 | 321 |
| FPT | Enunciados | R&W (Test 1: capturas en DOCX) | DOCX | 1 | 64 imágenes |
| FPT | Explicaciones (`ANSWER_EXPLANATION`) | Math | DOCX | 10 | — |
| FPT | Explicaciones | R&W | DOCX | 10 | — |
| FPT | Clave oficial (`ANSWER_KEY`) | Math / general | DOCX | 9 | — |
| **Total** | | | | **231** | **3 999** (3 906 páginas PDF + 29 DOCX + 64 capturas) |

Particularidades de las fuentes de los FPT:
- **Sin capa de texto.** Los PDF de enunciados de los FPT son capturas de pantalla, una por pregunta, así que se extrajeron con OCR y lectura visual. El R&W del Test 1 viene como capturas dentro de un DOCX.
- **Claves oficiales (ANS KEY):**
  - Existen para los Tests 1, 3, 4, 5, 6, 7, 9 y 10. El Test 1 tiene dos versiones: la clave y la "CHECKED".
  - **Test 2 y Test 8 no tienen ANS KEY.** Sus claves se validaron con los documentos de explicaciones y con la propia figura o pregunta.

### 3.2 Resultado de la extracción (staging de ingesta)

| Etapa | Cantidad |
|---|---:|
| Archivos procesados (`IngestSourceFile`, COMPLETED) | 231 |
| Páginas renderizadas (`IngestPageArtifact`) | 3 999 |
| Imágenes extraídas (`IngestImageArtifact`) | 6 897 |
| Entradas en la caché de OCR (Mistral) | 1 110 |
| **Preguntas candidatas detectadas** (`IngestQuestionCandidate`) | **2 605** (2 262 MC + 343 NUMERIC) |
| Respuestas y explicaciones candidatas (`IngestAnswerCandidate`) | 3 297 |
| Vínculos de imagen con candidata | 553 |
| Incidencias registradas en la ingesta | 2 042 (1 146 resueltas, 896 abiertas en staging) |
| Artefactos de promoción (trazabilidad) | 2 678 |

Las 896 incidencias abiertas son de staging y no afectan al banco oficial.

### 3.3 Trazabilidad fuente → candidata → pregunta oficial (verificada)

Verifiqué el 2026-09-28 que cada pregunta oficial se puede rastrear hasta su fuente. Las consultas se hicieron sobre `dev.db`. Los conteos principales se repitieron en prod y dieron lo mismo.

**Resultado: las 2 597 preguntas del banco vienen, cada una, de exactamente una candidata extraída de un archivo fuente.**
- **Ninguna pregunta se creó a mano sin fuente.** No hay preguntas sin candidata.
- Ninguna candidata está vinculada a dos preguntas.
- Ningún vínculo apunta a una pregunta inexistente.

| Candidatas (2 605) | Cantidad | Qué son |
|---|---:|---|
| Promovidas y publicadas | 2 594 | 2 591 REVIEWED + 3 que siguen en READY en staging aunque ya se promovieron: Test 1 Math M1 #5 y Test 10 Math M2B #8 y #15. Es solo la etiqueta de staging |
| Promovidas y luego archivadas | 3 | Fragmentos que la ingesta tomó por preguntas: un "Choice D is correct…" de *Linear Eq TWO Variables EASY* y dos colas de opción D de *CE HARD* y *CE MED*. La candidata está marcada como rechazada y la pregunta como ARCHIVED |
| Rechazadas sin pregunta | 8 | Ver detalle abajo |

Las 8 candidatas rechazadas sin pregunta:
- **2 del Test 6 Math, cortes erróneos.**
  - M1 #4: una lista de datos "4.2, 6.3, …" que se tomó como pregunta.
  - M2B #10: un duplicado.
  - Ambas posiciones del test están cubiertas por otra candidata del mismo PDF. La de M1 #4 se promovió el 2026-08-10.
- **6 de Practice Sets, sin contenido de pregunta:**
  - opciones sueltas "C. D.";
  - 2 enunciados vacíos;
  - 2 líneas de explicación "Choice D is incorrect…";
  - un enlace a tabla `[tbl-0.html]`.

#### De dónde viene cada pregunta

**Practice Sets:**
- Cada uno de los 91 sets viene de **un solo PDF de enunciados**, y cada uno de los 91 PDF dio **exactamente un set**.
- Todas las preguntas de un set tienen la misma dificultad que su archivo fuente.
- En total hay 1 614 preguntas.
- Por archivo, las candidatas coinciden con las preguntas del set salvo en 7 PDF. En ellos sobran las 9 candidatas descritas arriba: 6 rechazadas y 3 archivadas.
- **Excepción posterior (2026-09-28):**
  - Se movieron 6 preguntas extraídas del PDF *One-Variable Data: Distributions and Measures HARD* al set *Two-variable data HARD*, porque su skill oficial en la fuente es "Two-variable data: Models and scatterplots". Ver `docs/qa/practice/math-order-answer-alignment.md`, "Aplicado 2".
  - Esas 6 preguntas conservan su candidata de origen. Es la única excepción a la regla "un PDF = un set".

**FPT:**
- Para las 980 preguntas coinciden, contra la candidata de origen:
  - el número de test;
  - el módulo (M1 ↔ etiqueta "1", M2 ↔ "2" o "2B");
  - la posición (candidata #N = pregunta N del módulo);
  - la sección.
- El Módulo 2 se etiqueta "2B" en R&W en 5 tests y en Math en 6 tests; en el resto, "2".

Archivo de origen por test y sección:

| Test / sección | Archivo de origen de las preguntas |
|---|---|
| Math, Tests 1–10 | El PDF de Math de cada test (44 candidatas cada uno; Test 6: 46, con los 2 cortes rechazados) |
| R&W, Tests 3, 4, 5, 7, 8, 9, 10 | El PDF de R&W de cada test (54 candidatas) |
| R&W, Tests 2 y 6 | PDF de R&W (52) + 2 preguntas del Módulo 1 tomadas del DOCX de explicaciones, que la ingesta no encontró en el PDF |
| R&W, Test 1 | **Las 54 preguntas vienen del DOCX de explicaciones** (`Test1 RW Answer Explanations.docx`). El DOCX de enunciados (`Test 1 Module 1, 2B R&W.docx`) solo contiene capturas y generó 0 candidatas. Sus 64 capturas se usaron con OCR para recuperar pasajes y para cotejar los enunciados (108 cotejados con la fuente en T1/T2, todos coinciden) |

**De dónde salen las claves (`answerSource` de la candidata):**
- **Practice Sets:** 1 599 del PDF ANS del set y 18 de otro archivo de clave.
- **FPT:**
  - 616 del PDF.
  - 164 del DOCX de explicaciones.
  - 83 del ANS KEY.
  - 117 sin etiqueta de origen.
- Todas las claves de los FPT se revisaron después contra el ANS KEY oficial o, en los Tests 2 y 8, contra las explicaciones.

**Archivos usados:**
- Se usaron los 91 PDF ANS de Practice Sets, los 20 DOCX de explicaciones y los 9 ANS KEY.
- Único archivo de preguntas sin candidatas: el DOCX de capturas del Test 1 R&W, explicado arriba.

**Cronología:**
- Candidatas extraídas:
  - 2026-08-03: 2 543.
  - 2026-08-04: 4.
  - 2026-08-08: 54 (Test 1 R&W desde el DOCX de explicaciones).
  - 2026-08-11: 4.
- Preguntas oficiales creadas:
  - 2026-08-08: 2 458, promoción masiva.
  - 2026-08-10: 62.
  - 2026-08-11: 77, completando tests y sets.
- 20 de las promovidas los días 10 y 11 no tienen `IngestPromotionArtifact`: 2 del Test 4 R&W M2 (#12, #24) y 18 de Practice Sets de Math. Se promovieron por una vía posterior que no registró el artefacto (`promotedAt` también está vacío). Su trazabilidad es el vínculo `officialQuestionId` de la candidata, que sí existe. Las otras 2 577 tienen además su artefacto.

**Limpieza del 2026-09-28 (prod):**
- Prod tenía 2 lotes de ingesta **PENDING sin procesar**, subidos desde la UI de admin después de la carga:
  - 2026-08-18: `Non Linear Functions EASY.pdf`, un duplicado.
  - 2026-09-08: `NON Linear Functions Hard Cook SAT .pdf`.
- Tenían 0 candidatas y 0 preguntas. Sus PDF ya no existían en disco, porque estaban en `/tmp` del contenedor.
- **Se eliminaron** (2 `IngestBatch` + 2 `IngestSourceFile`). Prod vuelve a tener 1 lote y 231 archivos, igual que local.
- Ese mismo día se eliminaron en prod los **intentos vacíos**, es decir, sin ninguna respuesta, marca, nota ni opción descartada:
  - 9 de Practice Sets y 1 de FPT.
  - En cascada: sus 160 + 98 filas de respuesta vacías y 28 notificaciones que enlazaban a ellos.
  - Se recalculó el estado de 2 asignaciones que se quedaron sin intentos: pasaron a PENDING.
  - El `AuditLog` se conserva.
  - Copia completa previa: `/data/db/backups/dev.db.pre-cleanup-empty-attempts-20260928`. Copia de las filas borradas: `cleanup-empty-attempts-ingest-rows-backup-20260928.json`.
  - Esto no afecta al contenido inventariado.

### 3.4 Promoción y control de calidad

- La promoción (2026-08-08 → 2026-08-11) creó **2 597 preguntas oficiales**:
  - 2 594 están publicadas.
  - 3 son fragmentos archivados.
  - Van en 91 Practice Sets y 10 FPT.
- La auditoría de cobertura (`docs/qa/practice/promotion-coverage-report.md`) confirmó que **no falta ninguna pregunta** de los archivos fuente.
- Después hubo una **fase de QA comparando cada pregunta publicada con su fuente**. Duró de agosto al 2026-09-29 y todas las correcciones se aplicaron en local y en prod. Principales correcciones:

| Área | Correcciones principales | Detalle |
|---|---|---|
| Claves | Clave desplazada en uno en R&W del Test 2 (31); signo negativo perdido en respuestas NUMERIC de Math; claves Math de los Tests 3 y 6; las 2 claves erróneas del Test 8 (RW M2 #1 y Math M2 #1, ahora B). Resultado: las 980 claves FPT quedaron alineadas con la clave oficial o las explicaciones, y las de Practice Sets coinciden al 100 % con los PDF ANS | `docs/qa/test-*-findings.md`, `docs/qa/fixes-applied.md` |
| Opciones | Opciones de MC que venían como imagen, transcritas desde la fuente (cientos, en todos los tests) | `docs/qa/recovery-map.md` |
| Pasajes R&W | Pasajes FPT que se habían tomado del documento de explicaciones en lugar del documento de enunciados; recuperados | `docs/qa/fixes-applied.md` |
| Math Practice | 277 defectos por matemática o figuras perdidas en el OCR (419 correcciones de contenido + 11 claves) | `docs/qa/practice/fixes-applied*.md` |
| Reading / Writing Practice | 23 gráficos de Command of Evidence recortados; 77 + 4 explicaciones truncadas completadas | `docs/qa/practice/reading-*.md`, `writing-*.md` |
| Imágenes | 269 imágenes espurias de UI quitadas; 22 figuras de Math de los FPT recortadas de la fuente | `docs/qa/fpt-image-restore/README.md` |
| Texto | `$` pegado a la matemática, asteriscos Markdown literales, contaminación entre preguntas contiguas | Hoja "Texto" de `docs/qa/preguntas-pendientes-consistencia.xlsx` |
| Enunciados FPT (2026-09-28) | 10 explicaciones con borrador del autor; 19 opciones duplicadas en el enunciado; 35 pasajes repetidos en el enunciado; 49 etiquetas internas; 634 números de pregunta iniciales | `docs/qa/fpt-image-restore/README.md` |
| Math Practice: orden y claves (2026-09-28) | 826 preguntas cotejadas por Question ID; ninguna clave desplazada (649/649 MC). Correcciones: 2 sets reordenados según la fuente; 5 claves NUMERIC (2 truncadas, 3 separadas por comas); 19 explicaciones vacías rellenadas; 12 fugas de la pregunta siguiente; 41 pies "Question Difficulty"; erratas del rationale; 6 preguntas movidas a *Two-variable data HARD* | `docs/qa/practice/math-order-answer-alignment.md` |
| FPT Math: orden y claves (2026-09-29) | 440 preguntas; 0 desplazamientos, 0 claves erróneas; 7 defectos de contenido corregidos (9 operaciones) | `docs/qa/fpt-math-order-answer-alignment.md` |
| FPT R&W: orden y claves (2026-09-29) | 540 preguntas; 0 desplazamientos; 1 clave corregida (T6 M2 #20); 22 correcciones de contenido | `docs/qa/fpt-rw-order-answer-alignment.md` |
| Reading Practice: consistencia (2026-09-29) | 529 preguntas: orden, claves, opciones, pasajes y taxonomía limpios; 15 explicaciones corregidas (13 de Command of Evidence con el enunciado en lugar del rationale, 1 truncada, 1 vacía); paridad con prod 529/529 | `docs/qa/practice/reading-consistency-2026-09-29.md` |

---

## 4. Contenido cargado

### 4.1 Resumen

| Concepto | Total |
|---|---:|
| **Preguntas útiles** (PUBLISHED y dentro de un Practice Set o FPT publicado) | **2 594** |
| Preguntas ARCHIVED (fragmentos, no son preguntas) | 3 |
| Preguntas en el banco (total) | 2 597 |
| **Practice Sets** (todos PUBLISHED) | **91** |
| **Full Practice Tests** (todos PUBLISHED) | **10** (40 módulos) |

| Origen | Área / sección | Sets o tests | Preguntas útiles |
|---|---|---:|---:|
| Practice Sets | Reading | 18 sets | 529 |
| Practice Sets | Writing | 15 sets | 259 |
| Practice Sets | Math | 58 sets | 826 |
| **Practice Sets** | | **91 sets** | **1 614** |
| FPT | R&W | 10 tests (20 módulos) | 540 |
| FPT | Math | 10 tests (20 módulos) | 440 |
| **FPT** | | **10 tests** | **980** |
| **Total** | | | **2 594** |

- **Ninguna pregunta está a la vez en un Practice Set y en un FPT.**
- Ninguna pregunta aparece en más de un Practice Set.
- No hay preguntas publicadas sueltas. Las 3 ARCHIVED no están en ningún set ni test.
- Calidad básica de las 2 594:
  - Todas tienen enunciado y clave de respuesta.
  - Todas las MC tienen 4 opciones y su clave es una letra de la A a la D.
- **103 preguntas no tienen explicación, y todas son de FPT.** En el corte anterior eran 123; las 20 de Practice Sets se completaron el 28 y el 29-09 con el rationale del ANS.
  - Se pueden responder porque tienen clave; solo no muestran la solución razonada.
  - Reparto de las 103:
    - FPT Math: 49 (Test 1: 44; Test 5: 1; Test 9: 4).
    - FPT R&W: 54 (todo el Test 4).
  - **Los 91 Practice Sets tienen explicación en sus 1 614 preguntas.**

---

### 4.2 Practice Sets (91)

Cada set pertenece a una sola habilidad (skill) y un nivel de dificultad. La dificultad de todas sus preguntas coincide con la del set.

Por set:
- Mínimo: 2 preguntas.
- Máximo: 131 preguntas (Words in Context EASY).
- Media: 17,7 preguntas.

#### Vista general por área y dificultad

| Área | EASY (sets / preg.) | MEDIUM (sets / preg.) | HARD (sets / preg.) | Total (sets / preg.) |
|---|---:|---:|---:|---:|
| Reading | 6 / 228 | 6 / 142 | 6 / 159 | 18 / 529 |
| Writing | 4 / 71 | 5 / 84 | 6 / 104 | 15 / 259 |
| Math | 19 / 265 | 19 / 302 | 20 / 259 | 58 / 826 |
| **Total** | **29 / 564** | **30 / 528** | **32 / 522** | **91 / 1 614** |

#### Reading — 18 sets · 529 preguntas

Recursos:
- Tipo: todas MC.
- Con imagen: 23 (gráficos de Command of Evidence).
- Con pasaje: 326.
- Con explicación: 529 (todas).

| Dominio | Sets | EASY | MEDIUM | HARD | Total |
|---|---:|---:|---:|---:|---:|
| Information and Ideas | 9 | 65 | 60 | 79 | 204 |
| Craft and Structure | 9 | 163 | 82 | 80 | 325 |
| **Total Reading** | **18** | **228** | **142** | **159** | **529** |

| Dominio | Habilidad | Sets | EASY | MEDIUM | HARD | Total |
|---|---|---:|---:|---:|---:|---:|
| Information and Ideas | Main Ideas and Details | 3 | 16 | 15 | 17 | 48 |
| Information and Ideas | Command of Evidence | 3 | 36 | 32 | 36 | 104 |
| Information and Ideas | Inferences | 3 | 13 | 13 | 26 | 52 |
| Craft and Structure | Words in Context | 3 | 131 | 56 | 54 | 241 |
| Craft and Structure | Text Structure and Purpose | 3 | 17 | 17 | 14 | 48 |
| Craft and Structure | Cross-Text Connections | 3 | 15 | 9 | 12 | 36 |

*Main Ideas and Details* se llamaba *Central Ideas and Details*. *Cross-Text Connections* estaba en *Information and Ideas*. Los dos cambios son del 2026-09-29.

#### Writing — 15 sets · 259 preguntas

Recursos:
- Tipo: todas MC.
- Con imagen: 0.
- Con pasaje: 69.
- Con explicación: 259 (todas).

| Dominio | Sets | EASY | MEDIUM | HARD | Total |
|---|---:|---:|---:|---:|---:|
| Expression of Ideas | 6 | 38 | 44 | 36 | 118 |
| Standard English Conventions | 9 | 33 | 40 | 68 | 141 |
| **Total Writing** | **15** | **71** | **84** | **104** | **259** |

| Dominio | Habilidad | Sets | EASY | MEDIUM | HARD | Total |
|---|---|---:|---:|---:|---:|---:|
| Expression of Ideas | Rhetorical Synthesis | 3 | 18 | 30 | 21 | 69 |
| Expression of Ideas | Transitions | 3 | 20 | 14 | 15 | 49 |
| Standard English Conventions | Boundaries | 6 | 16 | 21 (2 sets: 10 + 11) | 45 (3 sets: 14 + 16 + 15) | 82 |
| Standard English Conventions | Grammar and Structure (sets "Form, Structure, and Sense") | 3 | 17 | 19 | 23 | 59 |

#### Math — 58 sets · 826 preguntas

Recursos:
- Tipo: 649 MC y 177 NUMERIC (respuesta abierta).
- Con imagen: 162 (130 MC + 32 NUMERIC).
- Con explicación: 826 (todas; las 19 que faltaban se rellenaron el 2026-09-28 con el rationale del ANS).

| Dominio | Sets | EASY | MEDIUM | HARD | Total |
|---|---:|---:|---:|---:|---:|
| Algebra | 15 | 97 | 96 | 73 | 266 |
| Advanced Math | 9 | 53 | 87 | 67 | 207 |
| Problem-Solving and Data Analysis | 22 | 78 | 72 | 61 | 211 |
| Geometry and Trigonometry | 12 | 37 | 47 | 58 | 142 |
| **Total Math** | **58** | **265** | **302** | **259** | **826** |

Habilidades con el nombre y el orden oficiales del *SAT Math — Skills Tracker*:

| Dominio | Habilidad | Sets | EASY | MEDIUM | HARD | Total |
|---|---|---:|---:|---:|---:|---:|
| Algebra | Linear equations in one variable | 3 | 18 | 18 | 12 | 48 |
| Algebra | Linear functions | 3 | 23 | 22 | 17 | 62 |
| Algebra | Linear equations in two variables | 3 | 30 | 26 | 21 | 77 |
| Algebra | Systems of two linear equations in two variables | 3 | 15 | 17 | 14 | 46 |
| Algebra | Linear inequalities in one or two variables | 3 | 11 | 13 | 9 | 33 |
| Advanced Math | Nonlinear functions | 3 | 17 | 34 | 36 | 87 |
| Advanced Math | Nonlinear equations in one variable and systems of equations in two variables | 3 | 15 | 30 | 11 | 56 |
| Advanced Math | Equivalent expressions | 3 | 21 | 23 | 20 | 64 |
| Problem-Solving and Data Analysis | Ratios, rates, proportional relationships, and units | 3 | 14 | 15 | 7 | 36 |
| Problem-Solving and Data Analysis | Percentages | 3 | 15 | 9 | 10 | 34 |
| Problem-Solving and Data Analysis | One-variable data: Distributions and measures of center and spread | 4 | 16 | 13 | 18 (2 sets: #1 14 + #2 4) | 47 |
| Problem-Solving and Data Analysis | Two-variable data: Models and scatterplots | 3 | 13 | 11 | 10 | 34 |
| Problem-Solving and Data Analysis | Probability and conditional probability | 3 | 12 | 11 | 6 | 29 |
| Problem-Solving and Data Analysis | Inference from Statistics and Margin of Error | 3 | 6 | 10 | 4 | 20 |
| Problem-Solving and Data Analysis | Statistical Claims | 3 | 2 | 3 | 6 | 11 |
| Geometry and Trigonometry | Area and volume | 3 | 13 | 17 | 13 | 43 |
| Geometry and Trigonometry | Lines, angles, and triangles | 3 | 17 | 11 | 12 | 40 |
| Geometry and Trigonometry | Right triangles and trigonometry | 3 | 4 | 8 | 17 | 29 |
| Geometry and Trigonometry | Circles | 3 | 3 | 11 | 16 | 30 |

Cambio de recuento respecto al corte anterior:
- El 2026-09-28 se movieron 6 preguntas de *One-variable data HARD #1* a *Two-variable data HARD*.
- One-variable data HARD pasó de 24 a 18 preguntas; Two-variable data HARD, de 4 a 10.
- El total del dominio (211) no cambia.

Niveles con pocas preguntas (≤ 4):
- Circles EASY (3).
- Right triangles and trigonometry EASY (4).
- Inference from Statistics and Margin of Error HARD (4).
- One-variable data HARD #2 (4).
- Statistical Claims: EASY (2), MEDIUM (3).

Sobre los nombres de los sets:
- Los sets de Practice se llaman `Dominio - Skill - NIVEL`, con los nombres oficiales.
- *Equivalent expressions HARD* y *Nonlinear equations … HARD* llevan "#1", pero cada una tiene un solo set.

---

### 4.3 Full Practice Tests (10)

Los 10 tests (TEST 1 a TEST 10) tienen la misma estructura, que es la del SAT digital. Cada test tiene 98 preguntas, dura 134 min y tiene 8 preguntas de pretest (2 por módulo).

> **Observación:** en los 40 módulos, las preguntas marcadas como pretest (`isPretest`) son siempre la **#1 y la #2**. Es una regla del código, no información de la fuente: la promoción y el editor de FPT asignan `isPretest: order < 2`. Hoy **no afecta a la nota**, porque el ajuste `FPT_PRETEST_EXCLUSION` está apagado (valor por defecto; sin fila en `AppSetting` ni en local ni en prod) y todas las preguntas cuentan. Si se activa, las 2 primeras de cada módulo dejarán de contar.

Dificultad:
- Las preguntas de los FPT no se clasifican por habilidad. Usan temas genéricos de la ingesta ("Full Practice Test" / M1 y M2).
- La dificultad depende del módulo. Módulo 1 es la base (EASY) y Módulo 2 es el adaptativo (HARD).

| Sección | Módulos por test | Preguntas por módulo | Tiempo por módulo | Preguntas por test | Total (10 tests) |
|---|---:|---:|---:|---:|---:|
| R&W | 2 | 27 | 32 min | 54 | 540 |
| Math | 2 | 22 | 35 min | 44 | 440 |
| **Total** | **4** | | | **98** | **980** |

#### R&W — 540 preguntas

Recursos:
- Tipo: todas MC.
- Con pasaje: 540 (todas).
- Con imagen: 29.
- Con explicación: 486 (faltan 54, todas del Test 4).
- Pretest: 40.
- Dificultad: Módulo 1 (EASY) 270 y Módulo 2 (HARD) 270.

| Test | Módulo 1 | Módulo 2 | Total | Con imagen |
|---|---:|---:|---:|---:|
| TEST 1 | 27 | 27 | 54 | 2 |
| TEST 2 | 27 | 27 | 54 | 2 |
| TEST 3 | 27 | 27 | 54 | 2 |
| TEST 4 | 27 | 27 | 54 | 3 |
| TEST 5 | 27 | 27 | 54 | 3 |
| TEST 6 | 27 | 27 | 54 | 5 |
| TEST 7 | 27 | 27 | 54 | 2 |
| TEST 8 | 27 | 27 | 54 | 4 |
| TEST 9 | 27 | 27 | 54 | 3 |
| TEST 10 | 27 | 27 | 54 | 3 |
| **Total** | **270** | **270** | **540** | **29** |

#### Math — 440 preguntas

Recursos:
- Tipo: 331 MC y 109 NUMERIC (respuesta abierta).
- Con imagen: 88.
- Con explicación: 391 (faltan 49: Test 1 44, Test 5 1, Test 9 4).
- Pretest: 40.
- Dificultad: Módulo 1 (EASY) 220 y Módulo 2 (HARD) 220.

| Test | Módulo 1 | Módulo 2 | Total | NUMERIC | Con imagen |
|---|---:|---:|---:|---:|---:|
| TEST 1 | 22 | 22 | 44 | 12 | 2 |
| TEST 2 | 22 | 22 | 44 | 10 | 10 |
| TEST 3 | 22 | 22 | 44 | 13 | 7 |
| TEST 4 | 22 | 22 | 44 | 12 | 5 |
| TEST 5 | 22 | 22 | 44 | 9 | 8 |
| TEST 6 | 22 | 22 | 44 | 11 | 9 |
| TEST 7 | 22 | 22 | 44 | 14 | 9 |
| TEST 8 | 22 | 22 | 44 | 8 | 12 |
| TEST 9 | 22 | 22 | 44 | 11 | 15 |
| TEST 10 | 22 | 22 | 44 | 9 | 11 |
| **Total** | **220** | **220** | **440** | **109** | **88** |

---

## 5. Cómo se contó

- Una **pregunta útil** es una `Question` con `status = 'PUBLISHED'` que está en al menos un `PracticeSet` o `FullPracticeTest` publicado.
- Practice Sets:
  - La área se toma de `PracticeSet → Topic → Domain → Section`.
  - Reading = dominios *Craft and Structure* + *Information and Ideas*.
  - Writing = dominios *Standard English Conventions* + *Expression of Ideas*.
  - Math = sección `MATH`.
- FPT: la sección se toma de `FullPracticeTestModule.section` (`RW` / `MATH`).
- Los nombres de dominio y skill son los de la taxonomía oficial del 2026-09-29 (`lib/taxonomy-order.ts`), y las tablas siguen ese orden.
- Consultas de solo lectura con `better-sqlite3` sobre `dev.db`. Recuento repetido el 2026-09-30.
- En producción se contaron las mismas tablas dentro del contenedor `sat-platform-web-1` (`/db/dev.db`).
