# QA TEST 1 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente. Solo lectura (no se modificó contenido oficial).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 1/MATH/TEST 1 INNOVATOR MATH MOD 1 AND 2.pdf` (15 págs, capturas del reproductor).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 1/Reading and Writing/ Test 1 Module 1, 2B R&W.docx` (DOCX→PDF, 35 págs; 2 preguntas por página en orden).
- **Alineación:** Math por número de página del candidato (fiable); R&W secuencial (Q_n en página ⌈n/2⌉).
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son **capturas del reproductor tipo College Board** (botones NEXT/PREV QUESTION,
> flag "COME BACK LATER", marcas ✗ y a veces el % de alumnos). Ese *chrome* de UI es la causa de varios leaks.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `stem_annotation_leak` — sufijo `[tema / respuesta]` filtrado en el stem | **46** | Alta (masivo) | R&W (M1 y M2) |
| `option_text_wrong` — opciones equivocadas (duplicadas de otra pregunta) | 1 | Alta | Math M2 #8 |
| `ui_leak` — texto de botón UI / header de módulo dentro del contenido | 3 | Media | Math M1 #7, M1 #22, M2 #17 |
| `asset_placeholder_leak` — placeholder de tabla markdown sin resolver | 1 | Media | R&W M1 #18 |
| `option_label_leak` — la letra A-D antepuesta al texto de la opción | 2 opciones | Media | R&W M2 #22 (A y D) |
| `escaped_underscore` — blank `\_\_\_\_\_` (se renderiza literal en vez de `_____`) | 4 | Baja | R&W M1 #3, #17, #23; M2 #25 |
| `stimulus_ui_leak` — chrome de UI dentro del stimulus | 1 | Baja | R&W M1 #6 |
| `source_error` — error presente en la fuente misma (no es mal-parseo) | 1 | Info | R&W M1 #1 ("1965" → 1865) |

Ninguno de los defectos altera la **letra** de respuesta correcta detectada (incluido Math M2 #8, cuya
letra "C" sigue siendo correcta aunque el texto mostrado de las opciones esté mal).

---

## A. MATH (44/44 inspeccionadas)

### A1. `option_text_wrong` — Math Module 2 #8 (`cmsjrntl50084qmt1hc5osyku`) — **Alta**
- Publicado: stem "A line in the xy-plane contains the point (3, −5) and has a slope of 4/3. Which of the
  following points lies on the line?" con opciones **A) 7/27  B) 7/16  C) 7/11  D) 7/8**.
- Fuente (pág 10): las opciones correctas son **puntos**: A) (½, 1⅔)  B) (1⅔, −5)  C) (2, −6⅓)  D) (5, −5¼).
- Diagnóstico: las opciones se **duplicaron de M2 #7** (pregunta de probabilidad con esas fracciones).
- Acción: reemplazar el texto de las 4 opciones por los puntos de la fuente. (Respuesta correcta = C = (2, −6⅓); la letra ya es "C".)

### A2. `ui_leak` — Math Module 1 #7 (`cmsjrntj0007tqmt1c2t8cksm`) — **Media**
- Opción D publicada: `130° COMB BACK LATER` → fuente (pág 3): `130°`. Se filtró el botón "COME BACK LATER" (+ typo OCR "COMB").
- Acción: opción D = `130°`.

### A3. `ui_leak` — Math Module 1 #22 (`cmsjrntpq009bqmt16638bqyv`) — **Media**
- Opción D publicada: `√34 ## MATH` → fuente (pág 8): `√34`. Se filtró el header "MATH MODULE 2".
- Acción: opción D = `$\sqrt{34}$`.

### A4. `ui_leak` — Math Module 2 #17 (`cmsjrntoi008yqmt1qyb4yqwb`) — **Media**
- Stem publicado termina en `... where x ≠ √5? COMB. BACK LATER` → fuente (pág 13) sin ese sufijo.
- Acción: quitar `COMB. BACK LATER` del stem.

Las 40 preguntas Math restantes coinciden con la fuente (stem, opciones, imágenes, respuesta).

---

## B. READING & WRITING (54)

### B1. `stem_annotation_leak` — sufijo `[tema / respuesta]` en el stem — **Alta / MASIVO (46 preguntas)**
- Ejemplo (M1 #2, `cmsjro6qz062eqmt11k3t4pcx`): stem publicado =
  `"Which choice completes the text with the most logical and precise word?  [energy source / supplying]"`.
  La fuente (pág 1) NO tiene ese `[...]`: es una **anotación** (tema del pasaje / palabra-respuesta) que se
  filtró al final del stem durante el parseo.
- Alcance: **46 de 54** preguntas R&W (RW M1 #2-9, 11-24; RW M2 #1-8, 10-25). Es el defecto dominante de TEST 1
  y NO aparece (casi) en los otros tests → específico de cómo se parseó el DOCX de TEST 1 R&W.
- Acción: eliminar el sufijo `\s*\[[^\]]*\/[^\]]*\]\s*$` del stem de esas 46 preguntas (verificando que
  no forme parte legítima del enunciado).
- qids afectados:
  `cmsjro6qz062eqmt11k3t4pcx, cmsjro6rj062gqmt1oqq2nq4j, cmsjro6ry062iqmt167q7vqep, cmsjro6si062kqmt1jo98vchm,
   cmsjro6t2062mqmt1ygsnfw41, cmsjro6t9062oqmt1ajsgwh9w, cmsjro6tr062qqmt1xdf0klxy, cmsjro6u3062sqmt1v5rgw2e8,
   cmsjro6up062wqmt1xl1noqst, cmsjro6v2062yqmt1a5ho706e, cmsjro6vb0630qmt11vdv2lsc, cmsjro6vo0632qmt12ssh0k5n,
   cmsjro6w00634qmt1086wcwuv, cmsjro6w80636qmt1fq3atbft, cmsjro6wh0638qmt1huhh5s6l, cmsjro6wt063aqmt1085omb2i,
   cmsjro6x3063cqmt1l5kw2swl, cmsjro6xb063eqmt1f3anp4et, cmsjro6xj063gqmt10c041xtn, cmsjro6ya063iqmt16hc22zcy,
   cmsjro70i063kqmt1zlfv8shx, cmsjro713063mqmt13t6k0zga,
   cmsjro6ql062dqmt1kargnr1i, cmsjro6r8062fqmt1r4kabjcw, cmsjro6rt062hqmt1rjdbzrax, cmsjro6s7062jqmt139241es0,
   cmsjro6ss062lqmt1a9nqiisc, cmsjro6t6062nqmt10kq3jw8w, cmsjro6tk062pqmt1kknt3py0, cmsjro6tx062rqmt118kzhi2v,
   cmsjro6uh062vqmt1hkbem60k, cmsjro6uw062xqmt10ylzxqzb, cmsjro6v8062zqmt17xlo4gpt, cmsjro6vj0631qmt1kejaxi6u,
   cmsjro6vu0633qmt1303ptqpo, cmsjro6w30635qmt1jbb08rsy, cmsjro6wc0637qmt111m82gn4, cmsjro6wn0639qmt1nst4snh8,
   cmsjro6x0063bqmt1rhxkwtgs, cmsjro6x5063dqmt1xmlra6rh, cmsjro6xe063fqmt1hd3b1gfi, cmsjro6xm063hqmt1ffor3loj,
   cmsjro6zs063jqmt1tbq9ks7f, cmsjro70r063lqmt1tn98mdmh, cmsjro717063nqmt1qyve2dnv, cmsjro71h063pqmt1t05jqp02`

### B2. `asset_placeholder_leak` — R&W M1 #18 (`cmsjro6wt063aqmt1085omb2i`) — **Media**
- Opción D publicada: `administrators and [tbl-0.html](tbl-0.html)` → se filtró un placeholder de tabla
  markdown sin resolver. Debe quedar `administrators and`.

### B3. `stimulus_ui_leak` — R&W M1 #6 (`cmsjro6t2062mqmt1ygsnfw41`) — **Baja**
- El stimulus contiene chrome de UI filtrado (además del `[...]` en el stem). Revisar y limpiar.

### B4. `option_label_leak` — R&W M2 #22 (`cmsjro6zs063jqmt1tbq9ks7f`) — **Media**
- Opción A publicada: `A pilot error was reduced...` → fuente (pág 31): `pilot error was reduced...`.
- Opción D publicada: `D a discovery was made...` → fuente: `a discovery was made...`.
- Se filtró la letra de la opción (A, D) al inicio del texto. Acción: quitar el prefijo `^[A-D]\s`.
  (Respuesta correcta C, correcta.) Aislado: es la única pregunta de TEST 1 con este defecto.

### B5. `escaped_underscore` — R&W M1 #3, #17, #23; M2 #25 — **Baja**
- El blank del enunciado quedó como `\_\_\_\_\_` (guiones bajos escapados) y se renderiza literal en vez de `_____`.
- qids: `cmsjro6rj062gqmt1oqq2nq4j` (M1#3), `cmsjro6wh0638qmt1huhh5s6l` (M1#17), `cmsjro70i063kqmt1zlfv8shx` (M1#23), `cmsjro71h063pqmt1t05jqp02` (M2#25).
- Acción: reemplazar `\_` por `_` en esos stimulus. (Nota: aparece también en TEST 4, 7, 8 — 1 c/u.)

### B6. `source_error` (informativo, NO es mal-parseo) — R&W M1 #1 (`cmsjro6q9062cqmt1twe4e32v`)
- El stimulus dice "Abraham Lincoln's last public address, given April 11, **1965**". La fecha correcta es **1865**.
  El error **ya está en el DOCX fuente**, así que el parseo fue fiel. Corregir solo si se desea mejorar el contenido.

---

## Estado de la inspección — TEST 1 CERRADO ✔
- **Math (44):** inspección visual completa página por página (15 págs). ✔
- **R&W (54):** M1 #1-27 inspección visual completa (págs 1-16); M2 muestreo visual amplio
  (#1-9, #13-14, #22-25) + barrido automático de artefactos sobre las 54 (stem/opciones/stimulus).
  Contenido fiel a la fuente salvo los defectos listados; no hay opciones intercambiadas fuera de Math M2 #8.
- **Claves de respuesta:** ✔ **98/98 correctas**. Se compararon todas las respuestas publicadas contra
  `Answers Key Test 1_.docx` (tabla con R&W Module 1, R&W Module 2B, MATH Module 1, MATH Module 2) — 0 discrepancias
  (incluye NUMERIC como 18, 3/8, 24/25, 5/4, 8/3, 4/5, 7, 3, 91). No hay defectos de clave en TEST 1.

## Causa raíz del artefacto de corchetes (B1)
El `Test1 RW Answer Explanations.docx` contiene esas anotaciones en el encabezado de cada pregunta
(p.ej. "Question 2: ...precise word?  [energy source / supplying]"). El R&W se promovió tomando el stem
desde ese doc de explicaciones (fuente equivocada), arrastrando la anotación `[tema / respuesta]` al stem
publicado. El fix (quitar el sufijo) no afecta el enunciado real.
