# QA TEST 6 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente + barrido automático de artefactos (`scripts/qa/scan-artifacts.mjs`).
Solo lectura (no se modificó contenido oficial).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 6/MATH/INNO TEST 6 MATH MOD 1, 2B.pdf` (19 págs).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf` (36 págs, capturas
  del reproductor tipo College Board, ~2 preguntas por página en orden).
- **Alineación:** Math por número de página del candidato (fiable); R&W secuencial.
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.
- **Claves:** `TEST 6 ANS KEY.docx`, `Test6_Math_Answer_Explanations.docx`, `Test6_RW_Answer_Explanations.docx`.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — stem truncado (falta el enunciado real / los datos) | **2** | **Crítica** | Math M1#8, Math M2#12 |
| `option_text_wrong` — opción reemplazada por un duplicado (roto) del stimulus completo | **2** | **Crítica** | R&W M2#7 (opt A), R&W M2#16 (opt A) |
| `stimulus_bleed` — el stimulus/opción de una pregunta se filtra dentro de otra (frontera mal cortada) | **1** | **Crítica** | R&W M1#7 (opt D) |
| `stimulus_bleed` — el inicio del stimulus de la pregunta siguiente queda pegado al final del stimulus actual | **13** | Alta (sistemático) | R&W M1 (7) y M2 (6) |
| `stimulus_bleed` — falta la intro / primeras palabras del stimulus (corte al inicio) | **2** | Media | R&W M1#4, R&W M2#6 |
| `stem_annotation_leak` — anotación `(tema / respuesta)` entre paréntesis filtrada en el stem | **4** | Media | R&W M1#20, M1#21, M2#7, M2#16 |
| `stimulus_ui_leak` — header de página ("MODULE 1 R&W") filtrado al inicio del stimulus | 1 | Baja | R&W M1#1 |
| `stem_number_leak` — el nº de pregunta ("2.", "15.") antepuesto al stem (cosmético, sistemático) | **60** | Baja | R&W (17) y Math (43) |
| `source_error` | 0 | — | No se detectaron errores propios de la fuente |

Ninguno de los defectos anteriores altera la **letra**/valor de respuesta correcta detectado: los 98
`correctAnswer` publicados coinciden con la fuente autoritativa (ver sección de claves). El defecto
dominante de TEST 6 es el **bleed sistemático de frontera** entre preguntas consecutivas de R&W
(comparable, por su carácter específico de este test, al artefacto de corchetes `[tema/respuesta]`
de TEST 1) — ver causa raíz al final.

---

## A. MATH (44/44 inspeccionadas página por página)

### A1. `broken_question` — Math Module 1 #8 (`cmsjrnvsm00xpqmt1r7yupxmu`) — **Crítica**
- Publicado (stem completo, NUMERIC): *"8. Victoria gathered 10 sticks in a forest and measured
  their lengths in inches. The lengths of the sticks are shown."* — y nada más. `stimulus` = `null`.
- Fuente (pág 3): el mismo texto introductorio, seguido de la lista de datos
  `4.2, 6.3, 4.6, 2.0, 3.4, 7.3, 4.1, 5.7, 8.3, 9.1` y de la pregunta real
  *"What is the mean length, in inches, of the sticks?"*.
- Diagnóstico: el parseo cortó el stem justo antes de los datos; **falta tanto la lista de números
  como el enunciado de la pregunta**. El alumno no puede saber qué se le pide. La respuesta
  (`5.5`) es correcta y coincide con la `explanation` almacenada (que sí contiene los 10 valores),
  pero esa explicación no es visible antes de responder.
- Acción: completar el stem con la lista de datos y la pregunta final tal como aparecen en la fuente.

### A2. `broken_question` — Math Module 2 #12 (`cmsjrnvua00xyqmt14touuur7`) — **Crítica**
- Publicado (stem, MC): *"12. In a data set, the mean is 10, the median is 10, the middle three
  values are 10, and the largest value is greater than"* — corta a mitad de frase. `stimulus` = `null`.
- Fuente (pág 14): *"...and the largest value is greater than 10. If the largest value is removed
  from the data set, which of the following correctly represents the changes to the mean and
  median?"*.
- Diagnóstico: el stem quedó truncado exactamente en `"than"`, perdiendo el resto de la premisa y
  la pregunta completa. Las opciones (A–D) sí están completas y son inferibles con esfuerzo, pero
  la pregunta tal como se muestra no tiene sentido gramatical ni comunica qué se pide.
- Acción: completar el stem con el texto que falta. Respuesta correcta `B`, ya correcta.

Las 42 preguntas Math restantes (incluidas todas las imágenes/gráficas: M1#1,2,3,4,9,10,11,13,14,15,16,
20,21,22; M2#2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,21,22) coinciden con la fuente en stem, opciones,
imágenes y respuesta. Se verificaron visualmente todas las 19 páginas del PDF Math y se contrastaron los
`imageUrl` de las preguntas con gráfico contra la captura de página (tablas, dispersogramas, funciones,
figuras geométricas): sin swaps ni recortes.

---

## B. READING & WRITING (54/54 inspeccionadas: 36 páginas fuente + barrido automático)

### B1. `stimulus_bleed` (en opción) — R&W Module 1 #7 (`cmsjrnwef012gqmt1uquaehwe`) — **Crítica**
- Opción D publicada: *"It resembles the shape of the Dia Chelsea sculpture. "The Monkey's Paw" is
  a 1902 American short story by W.W. Jacobs. It is often considered a "three wishes" tale, as it
  features a magical talisman, the monkey's paw, which grants its owner three wishes, but always at
  an unintended cost. Thus a major theme of the story is to be wary of trying to fix the inevitable,
  as demonstrated when Sergeant-Major Morris says the following: ______"*
- Fuente (pág 4): la opción D real es solo *"It resembles the shape of the Dia Chelsea sculpture."*
  El resto del texto es el **stimulus completo de la pregunta siguiente (M1#8)**, que se filtró y
  quedó pegado al final de esta opción.
- Diagnóstico: falla de corte de frontera entre preguntas — la opción D "se comió" el inicio del
  bloque de la pregunta 8. Esto corrompe visualmente la opción que el alumno lee como respuesta D.
  Respuesta correcta = C, no afectada.
- Acción: truncar la opción D a *"It resembles the shape of the Dia Chelsea sculpture."*

### B2. `option_text_wrong` (duplicado roto del stimulus) — R&W Module 2 #7 (`cmsjrnwel012lqmt1nl1zxrxv`) — **Crítica**
- Opción A publicada: *"study led by Dr. Robin Dunbar aimed to investigate the role of laughter in
  social bonding and prosocial, or altruistic, behavior. The experiment recruited 66 subjects to
  watch a comedy or control video alone or in groups. ... The findings suggest that social bonding
  and prosociality may be driven by different factors and may have different impacts depending on
  the individual."* — es decir, el **stimulus completo** (sin la "A" inicial), no una opción real.
- Fuente (pág 21): la opción A real es *"To provide a summary of the study's findings related to how
  laughter positively influences some behavior but not others."*
- Diagnóstico: la opción A quedó reemplazada por un duplicado corrupto del stimulus. Respuesta
  correcta = D, no afectada, pero la opción A mostrada al alumno es ilegible/sin sentido como
  respuesta.
- Nota: esta pregunta también tiene `stem_annotation_leak` (ver B5).
- Acción: reemplazar el texto de la opción A por *"To provide a summary of the study's findings
  related to how laughter positively influences some behavior but not others."*

### B3. `option_text_wrong` (duplicado roto del stimulus, ya contaminado) — R&W Module 2 #16 (`cmsjrnwgw014qqmt11sl2gzpf`) — **Crítica**
- Opción A publicada: duplica el stimulus completo de la pregunta (que a su vez ya está contaminado
  con el bleed de M2#17, ver B4) en vez de contener el texto real de la opción A.
- Fuente (pág 30): la opción A real es *"successfully complete the task because the presence of
  others will socially facilitate their performance."*
- Diagnóstico: mismo patrón que B2 — la opción A fue reemplazada por un duplicado (roto) del
  stimulus en vez del texto de opción real. Respuesta correcta = C, no afectada.
- Nota: esta pregunta también tiene `stem_annotation_leak` (ver B5) y `stimulus_bleed` en cola (B4).
- Acción: reemplazar el texto de la opción A por *"successfully complete the task because the
  presence of others will socially facilitate their performance."*

### B4. `stimulus_bleed` — inicio de la pregunta siguiente pegado al final del stimulus actual — **Alta (sistemático, 13 casos)**
Patrón repetido: el `stimulus` de la pregunta *N* termina correctamente en el blank (`_____`), pero
a continuación aparece pegado —sin salto de párrafo— el **stimulus completo de la pregunta *N+1***.
La pregunta *N+1* en sí misma sí tiene su propio stimulus correcto (el texto queda duplicado, una vez
como cola contaminante de *N* y otra vez, correctamente, como cuerpo de *N+1*).

| qid | Ubicación | Pág. | Bleed de |
|---|---|---|---|
| `cmsjrnwgg0145qmt1ut696w4u` | R&W M1#14 | 10 | inicio de M1#15 ("Soft robotics is an emerging field of...") |
| `cmsjrnwgt014lqmt17m35ggyt` | R&W M1#16 | 11 | inicio de M1#17 ("Wyoming, notable for being...") |
| `cmsjrnwh60155qmt1u16p1fqt` | R&W M1#18 | 12 | inicio de M1#19 ("Languages are rich with idiomatic...") |
| `cmsjrnwhr015jqmt13y29sxg3` | R&W M1#22 | 14 | inicio de M1#23 ("The expedition led by Lewis and Clark...") |
| `cmsjrnwi2015nqmt1j5ryyc6x` | R&W M1#24 | 15 | inicio de M1#25 ("The Oxford comma can lead to legal disputes...") |
| `cmsjrnwid015rqmt1mqzo7guo` | R&W M1#26 | 16 | inicio de M1#27 (notas sobre Herschel) |
| `cmsjrnwgw014qqmt11sl2gzpf` | R&W M2#16 | 30 | inicio de M2#17 ("In 2006, Laura Bush...") — ver también B3 |
| `cmsjrnwha0156qmt1ec89rwme` | R&W M2#18 | 31 | inicio de M2#19 ("Photographer Jennie Ross Cobb...") |
| `cmsjrnwhl015hqmt1rrn10fxa` | R&W M2#20 | 32 | inicio de M2#21 ("Tetrachromacy, a condition...") |
| `cmsjrnwht015kqmt1qqwaiggw` | R&W M2#22 | 33 | inicio de M2#23 ("From 2000 to 2006, the price...") |
| `cmsjrnwi5015oqmt1pcip1a0a` | R&W M2#24 | 34 | inicio de M2#25 ("Most people are familiar with...") |
| `cmsjrnwif015sqmt1osjyo64w` | R&W M2#26 | 35 | inicio de M2#27 (notas sobre Bob Ross) |

Variante inversa (1 caso adicional): en **R&W M1#6** (`cmsjrnwe1012eqmt111s0ocfy`, pág 3) el stimulus
queda **prependido** (al inicio, no al final) con el texto de la **opción D de la pregunta anterior**
(M1#5: *"By admitting that ebooks are only suitable for people who prioritize convenience over the
overall reading experience"*), antes del verdadero inicio del stimulus (*"The following text is from
Horatio Alger's 1872 novel..."*). La opción D de M1#5 en sí está intacta; solo M1#6 quedó contaminado.

- Acción para los 13 casos: recortar el stimulus en el punto donde termina el blank/pregunta actual y
  empieza el texto duplicado de la siguiente pregunta (fácil de detectar: el texto se repite palabra
  por palabra al inicio del stimulus de *N+1*).

### B5. `stem_annotation_leak` (variante paréntesis) — 4 preguntas — **Media**
A diferencia de TEST 1 (que usa corchetes `[tema / respuesta]`), en TEST 6 la anotación filtrada usa
paréntesis con fragmentos separados por `/`, tomada del encabezado de la pregunta en el documento de
explicaciones:

- **R&W M1#20** (`cmsjro62j05nxqmt14ice94zf`, pág equivalente 1 del PDF real): stem publicado = *"Which
  choice completes the text so that it conforms to the conventions of Standard English? **(Candide /
  Leonard Bernstein / satirical undertones made _____ a favorite)**"*.
- **R&W M1#21** (`cmsjro63d05nyqmt1ywr1rvg1`): *"...Standard English? **(Long Beach earthquake / _____
  proved particularly damaging to school buildings)**"*.
- **R&W M2#7** (`cmsjrnwel012lqmt1nl1zxrxv`): *"Which choice best states the function of the underlined
  sentence in the text as a whole? **(Dr. Robin Dunbar / laughter study / underlined: '...')**"*.
- **R&W M2#16** (`cmsjrnwgw014qqmt11sl2gzpf`): *"Which choice most logically completes the text?
  **(Zajonc 'dominant response' effect / presence of others improves proficient tasks / unfamiliar
  complex task / individual is likely to _____)**"*.

Causa raíz confirmada para M1#20/#21: en la BD (`IngestQuestionCandidate`), ambas preguntas fueron
promovidas desde `Test6_RW_Answer_Explanations.docx` (no desde el PDF real de preguntas
`INNOVATOR TEST 6 RW.pdf`), con `pageNumber = 1` (página del doc de explicaciones, no la página real).
El documento de explicaciones antepone justamente esa anotación `(tema / detalle)` al enunciado de cada
pregunta — igual que en TEST 1 — y aquí se arrastró al stem publicado. Se verificó en la fuente (pág 13
del PDF real) que estas dos preguntas **no** llevan esa anotación y son, por lo demás, idénticas
(stem, 4 opciones, respuesta) a lo publicado.

Para M2#7 y M2#16 la anotación está igualmente presente en el stem, pero sus candidatos en BD sí
apuntan al PDF real de preguntas (págs 21 y 30 respectivamente) — la causa exacta de cómo se coló esa
anotación en estos dos casos no se pudo determinar con certeza (posible contaminación cruzada con el
doc de explicaciones durante el emparejamiento de respuesta); se deja señalado como incierto.

- Acción: eliminar el sufijo entre paréntesis `\s*\([^)]*\)\s*$` (o su bloque intermedio) del stem de
  las 4 preguntas, verificando que no forme parte legítima del enunciado (no lo es en ninguno de los
  4 casos).

### B6. `stimulus_bleed` (falta intro / corte al inicio) — 2 preguntas — **Media**
- **R&W M1#4** (`cmsjrnwbn012aqmt1z3x4mrbh`, pág 2): el stimulus publicado empieza directamente en
  *"In politics, the two great forces, commerce and empire..."*. La fuente antepone la línea de
  atribución *"The following text is from Anna Julia Cooper's 1892 book A Voice From the South."*,
  ausente en lo publicado. La cita en sí es fiel; solo falta la atribución.
- **R&W M2#6** (`cmsjrnwe7012fqmt1fxiy6t5e`, pág 20): el stimulus publicado empieza a mitad de frase:
  *"spider is often mischaracterized as the most dangerous in the world..."* — falta el sujeto de la
  oración, **"The Australian "daddy longlegs""**, presente en la fuente. Más severo que el caso
  anterior porque el texto publicado no es gramaticalmente completo desde su primera palabra.
- Acción: anteponer el texto faltante a cada stimulus.

### B7. `stimulus_ui_leak` — R&W Module 1 #1 (`cmsjrnwau0124qmt1maz72mj9`) — **Baja**
- Stimulus publicado empieza con *"MODULE 1 R&W One of the largest empires in history was the Mongol
  Empire..."* — el fragmento `"MODULE 1 R&W"` es el header de la página fuente (título
  "INNOVATOR TEST 6 / MODULE 1 R&W"), filtrado al inicio del stimulus real.
- Acción: quitar el prefijo `"MODULE 1 R&W "` del stimulus.

### B8. `stem_number_leak` — 17 preguntas R&W — **Baja (cosmético)**
El número de pregunta ("2.", "4.", "6.", "8.", "15.", "17.", "19.", "23.", "25." en M1; "2.", "4.",
"6.", "17.", "19.", "21.", "23.", "25." en M2) queda antepuesto al stem, igual que el patrón ya
documentado en TEST 2–5. No afecta el contenido ni la respuesta; ver tabla resumen para el listado
de qids completo (recuperable con `node scripts/qa/scan-artifacts.mjs "TEST 6"`, clave `stemNum`).

Las 37 preguntas R&W restantes (M1#2,3,5,9,10,11,12,13,17,19,26,27; M2#1,2,3,4,5,8,9,10,11,12,13,14,15,
17,19,21,23,25,27, y las imágenes de tabla M1#9,#11,#12,#13 y M2#14) coinciden con la fuente en
stimulus, opciones, imágenes y respuesta, salvo por el `stem_number_leak` cosmético donde aplica.

---

## Estado de la inspección — TEST 6 CERRADO ✔
- **Math (44):** inspección visual completa página por página (19 págs), incluidas todas las
  imágenes/gráficas. ✔
- **R&W (54):** inspección visual completa página por página (36 págs) + barrido automático de
  artefactos sobre las 54 preguntas (stem/opciones/stimulus). ✔
- **Claves de respuesta:** ✔ **98/98 correctas** frente a la fuente autoritativa. Se comparraron
  las 98 respuestas publicadas contra `TEST 6 ANS KEY.docx`; se detectaron **2 discrepancias**
  aisladas en la tabla cruda de esa clave (R&W M2#18: la clave dice `D`, R&W M2#20: la clave dice
  `C`). En ambos casos `Test6_RW_Answer_Explanations.docx` explica y confirma una respuesta distinta
  (`C` y `D` respectivamente) con justificación gramatical completa, y **lo publicado ya coincide con
  el documento de explicaciones** (no con la tabla cruda). Conclusión: no hay defecto en el contenido
  publicado; la tabla `TEST 6 ANS KEY.docx` tiene un error aislado en esas dos filas. Math (44/44) fue
  además comparado contra `Test6_Math_Answer_Explanations.docx` (fuente ya usada para reconstruir la
  clave de Math en un pase previo, ver memoria "Test6 Math refine") y coincide en las 44 preguntas sin
  discrepancias.

## Causa raíz de los defectos dominantes
1. **Bleed de frontera entre preguntas (B1, B4)**: al extraer cada pregunta del PDF renderizado
   (2 preguntas por página, sin separador estructural fuerte entre el bloque de opciones de una
   pregunta y el stimulus de la siguiente), el parser tomó una ventana de texto demasiado amplia y
   arrastró el inicio del bloque siguiente. Es sistemático dentro de TEST 6 (13 casos claros + 2
   variantes), a diferencia de TEST 1 (donde el defecto dominante era el corchete de anotación) o de
   TEST 4/5 (bleed de opciones puntual, no de stimulus completo).
2. **Duplicado de stimulus como opción A (B2, B3)**: en preguntas donde el bleed de B4 ya había
   corrompido el stimulus, ese mismo bloque de texto (potencialmente mal delimitado por el parser)
   terminó también copiado como si fuera el texto de la opción A, sustituyendo la opción real.
3. **Anotación entre paréntesis (B5)**: igual que en TEST 1 (corchetes), proviene del encabezado de
   pregunta del documento de explicaciones (`Question N: ... (tema / detalle)`). Confirmado para 2 de
   4 casos vía `IngestQuestionCandidate.sourceFileId` apuntando al `.docx` de explicaciones en vez del
   PDF de preguntas real.
