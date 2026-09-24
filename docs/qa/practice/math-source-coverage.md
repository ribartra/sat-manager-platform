# Cobertura de fuentes — MATH Practice (texto + OCR + inspección visual)

- **Fecha:** 2026-09-24 · **read-only** (nada escrito a `dev.db` ni a producción).
- **Pregunta:** ¿existe material fuente para los topics de Math que aparecen como **"No sets yet"** en el Content Map, que se haya perdido por páginas-imagen sin texto seleccionable o por archivos Word sin convertir?
- **Veredicto:** **NO.** Los 20 topics con fuente están cargados; los 4 vacíos (**Exponential Functions, Polynomials, Quadratic Functions, Radical Equations**) **no tienen material en ninguna forma** — ni texto, ni imagen, ni Word. Confirmado por **tres vías independientes** que convergen.

## Universo

`files_to_load/PRACTICE EXERCISES/EXERCISES MATH/` — única fuente (no hay carpeta `data` oculta). **116 PDF · 1764 páginas · 0 `.docx`.** 20 carpetas-topic (4 dominios). Los 30 `.docx` del repo están en `MOCK EXAMS/` (explicaciones de mock exams) — no son practice sets.

**Word→PDF:** nada que convertir en Math practice (0 docx). Nota técnica: el `ingest_service/Dockerfile` **no** incluye LibreOffice/soffice (solo `build-essential libgl1 libglib2.0-0`), así que hoy no puede docx→pdf headless; solo haría falta añadir `libreoffice-writer` si en el futuro llega práctica en Word (y aun así el pipeline parsea docx directo con `python-docx`).

## Método — tres vías

1. **Texto (parser).** Extracción de texto de los 116 PDF y búsqueda de keywords. Motor: `pdftotext` en host (el contenedor `ingest-service` estaba **detenido**; su parser real es `pdfplumber`/`extract_pdf_text`, `ingest_service/app/main.py:2249`, equivalente para este fin). Scripts: `scratchpad/math-keyword-scan.mjs`.
2. **Texto OCR de la DB.** Búsqueda en `IngestQuestionCandidate` (stem/stimulus/rawJson) de los **832 candidatos** Math — esto incluye lo que el ingest **sí** OCR'eó de páginas-imagen. Script: `scratchpad/cand-keywords.mjs`.
3. **Inspección visual.** Renderizado (`pdftoppm`) e inspección ocular de las **18 páginas-imagen** (las que tienen <20 caracteres de texto seleccionable). Imprescindible porque en Math el OCR del ingest **descartó** contenido image-rendered (defecto sistémico ya documentado), así que ni el texto ni el OCR de la DB son fiables en esas páginas.

## Resultado del scan de keywords (vías 1 y 2 coinciden)

| Keyword (topic vacío) | Texto (host) | Texto OCR (DB) | ¿Dónde aparece? |
|---|---|---|---|
| **radical** | 0 | 0 | — ausente en todo Math |
| **reciprocal** | 0 | 0 | — ausente |
| **transformation** | 0 | 0 | — ausente |
| exponential | 5 archivos | sí | **incidental** dentro de Nonlinear Functions, Two-Var Data, Data/Mean (ya cargados) |
| polynomial | 3 archivos | sí | **incidental** dentro de Equivalent Expressions, Nonlinear Functions (ya cargados) |
| quadratic | 5 archivos | sí | **incidental** dentro de Nonlinear Equations/Functions, Two-Var Data (ya cargados) |

Lo poco de quadratic/polynomial/exponential que existe está **dentro de sets ya cargados** — que es donde el College Board agrupa esos conceptos (Nonlinear Equations/Functions, Equivalent Expressions). **No hay ningún archivo dedicado** a los 4 topics vacíos.

## Punto ciego cerrado — las 18 páginas-imagen (vía 3, inspección visual)

De 1764 páginas, solo 18 son imagen sin texto seleccionable, en 14 archivos, **todas dentro de las 20 carpetas ya cargadas**. Veredicto visual:

| Archivo (carpeta cargada) | Pág. | Qué es (visto) |
|---|---|---|
| ADVANCED MATH/NON LINEAR FUNCTIONS/Non Linear Functions EASY | 4 | figura: gráfica de curva (cúbica) de una pregunta |
| ADVANCED MATH/NON LINEAR EQUATIONS/Non Linear Equations MED | 21 | figuras de **opciones C/D** (dos gráficas) de una pregunta |
| PSDA/DATA AND MEAN/Data Distribut, mean Hard | 18 | fragmento de tabla (fila desbordada "100 | 8") |
| ADVANCED MATH/EQUIVALENT EXPRESSION/ANS HARD 1EQUIV EXPRES | 31 | ANS: página casi en blanco (label "Hard") |
| ADVANCED MATH/NON LINEAR EQUATIONS/ANS Non Linear Equations MED | 21 | ANS: figura/casi en blanco |
| ADVANCED MATH/NON LINEAR FUNCTIONS/ANS NON LINEAR FUNCT HARD | 5,16,25,40,57 | ANS: páginas casi en blanco (spillover) / figura |
| ADVANCED MATH/NON LINEAR FUNCTIONS/ANS Non Linear Functions MED | 18 | ANS: casi en blanco |
| ALGEBRA/LINEAR EQUATIONS ONE VARIABLE/ANS Linear Eq One Variable MED | 3 | ANS: figura/casi en blanco |
| ALGEBRA/SYSTEMS.../ANS Systems 2 Lin Equat 2 Var MED | 15 | ANS: casi en blanco |
| GEOMETRY/AREAS AND VOLUMES/ANS Area and Volume MED | 3 | ANS: casi en blanco |
| GEOMETRY/RIGHT TRIANGLES.../ANS Right Triangles and Trig HARD | 15 | ANS: en blanco |
| PSDA/DATA AND MEAN/Data Distribut, mean ANS HARD | 38 | ANS: label "Hard" |
| PSDA/ONE VARIABLE DATA/ANS One Var. Data EASY | 10 | ANS: figura/casi en blanco |
| PSDA/PROBABILITY/ANS Probability Med | 7 | ANS: casi en blanco |

Ninguna contiene contenido de un topic distinto ni preguntas ocultas: son **figuras/gráficas de opciones/tablas de preguntas de sets ya cargados**, o **páginas de spillover casi en blanco** de los PDF de respuestas.

## Cobertura por topic (Math)

**20 topics con fuente → los 20 cargados** (58 sets publicados). **15 nodos "No sets yet"**, de tres tipos:

- **① Sin material (4):** Exponential Functions, Polynomials, Quadratic Functions, Radical Equations — **0 archivos** (texto ni imagen ni Word). No se pueden llenar con nada de lo que hay en disco.
- **② Duplicados/legacy de taxonomía (8):** Triangles, Trigonometry, Volume and Area, Ratios and Proportions, Statistics, Linear Equations, Systems of Equations, Inequalities — su contenido **ya está cargado** bajo un nombre más específico.
- **③ Placeholders de Full Practice Test (3):** Full Practice Test — Math, M1, M2.

## Conclusión y recomendación

- **No hay fuente perdida.** Todo lo que existe en disco (incluidas las páginas-imagen y considerando el docx) está cargado y publicado. Los 4 topics vacíos están vacíos porque **no existe material** para ellos, no por un fallo de parseo/OCR/conversión.
- **Para llenarlos** hace falta **aportar PDFs (o Word) de ejercicios** de Exponential Functions / Polynomials / Quadratic Functions / Radical Equations. Al colocarlos en `…/EXERCISES MATH/Advanced Math/<Topic>/` (nombre que normalice al Topic de la DB) el pipeline de ingest los promueve como los demás (el `Topic` ya existe, seed `prisma/seed-taxonomy.ts`).
- **Alternativa cosmética:** limpieza de taxonomía — ocultar/fusionar los 8 nodos duplicados + 3 placeholders para que el Content Map no muestre "No sets yet" engañosos.
