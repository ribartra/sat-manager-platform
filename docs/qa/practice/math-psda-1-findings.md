# Content QA — MATH Practice Sets — Problem Solving & Data Analysis (Group 1)

- **Fecha:** 2026-09-22
- **Dominio:** Problem Solving and Data Analysis
- **Temas (Group 1):** Inference and Margin of Error · One-Variable Data · One-Variable Data: Distributions and Measures · Percentages
- **Sets revisados (10):** IMoE EASY/MEDIUM/HARD · One-Variable Data EASY/MEDIUM/HARD · One-Var Distributions & Measures HARD · Percentages EASY/MEDIUM/HARD
- **Total preguntas:** ~107
- **Método:** Comparación read-only de la pregunta publicada (dump resuelto de dev.db) contra la página fuente del PDF de ejercicios y su PDF de respuestas. Detección únicamente (no se modifica dev.db ni Questions promovidas). Clases y severidad según `scratchpad/method.txt`. Foco: caída sistémica de valores inline (números renderizados como imagen que OCR dejó en blanco) en stems y opciones; figuras/tablas requeridas sin imagen.

## Resumen de defectos

_(se completa al final)_

---

## Hallazgos por set

### Inference and Margin of Error — EASY (setId=cmsjron9n068pqmt142nib7ga, 6 q)

- Q1/seq1 page1: sin incidencias (6/20·50=15 → C ✓)
- cmsjrnzz402f1qmt1nwwhg9up | IMoE EASY | seq2/page2 | class=broken_question | sev=Crítica | current: stem "...mean weight of all handbags... is , with an associated margin of error of ." y opciones "between and" (valores numéricos perdidos, pregunta irresoluble) | expected: media = 27.8 oz, margen = 0.02 oz; A/B/C "between 27.78 oz and 27.82 oz", D "27.8 oz" | action: re-transcribir valores inline (renderizados como imagen) en stem y opciones; clave A correcta
- Q3/seq3 page3: sin incidencias (7/50·14,878≈2,100 → B ✓)
- Q4/seq4 page4: sin incidencias (media 56 · 253≈14,168 → 13,500–14,500 → C ✓)
- Q5/seq5 page5: sin incidencias (38%±5.5% = 32.5–43.5% → C ✓)
- Q6/seq6 page6: sin incidencias (37±3 = 34–40 → C ✓)

### Inference and Margin of Error — HARD (setId=cmsjronct068rqmt1qpr4cs70, 4 q)

- cmsjro0j702noqmt1mbo41mn0 | IMoE HARD | seq1/page1 | class=image_missing | sev=Crítica | current: stem "Poll Results\n\nThe table shows the results of a poll..." sin datos de la tabla e imageUrl null (pregunta irresoluble) | expected: tabla Poll Results — Angel Cruz 483, Terry Smith 320 | action: adjuntar/transcribir la tabla; clave B correcta ((483-320)/803·6424=1,304)
- Q2/seq2 page2: sin incidencias (17/26·46,800=30,600 → C ✓)
- Q3/seq3 page3: sin incidencias — tabla (A 52%/4.2%, B 48%/1.6%) SÍ transcrita en stem; figure_ref falso positivo; clave D ✓
- Q4/seq4 page4: sin incidencias — tabla texting SÍ transcrita en stem; figure_ref falso positivo; clave D ✓ (30%±3% → dudoso 35%)

### Inference and Margin of Error — MEDIUM (setId=cmsjronfl068tqmt1h8czyxxp, 10 q)

- Q1/seq1 page1: sin incidencias (20/80·1500=375 → D ✓)
- cmsjro0gg02krqmt1s31wfjg6 | IMoE MEDIUM | seq2/page2 | class=broken_question | sev=Crítica | current: stem "...proportion... is , with margin of error of ." y opciones con valores en blanco | expected: proporción 0.49, margen 0.04; A "between 0.45 and 0.53", B "less than 0.45", C "exactly 0.49", D "greater than 0.53" | action: re-transcribir valores inline; clave A correcta
- Q3/seq3 page3: sin incidencias (30% de largemouth bass → D ✓)
- Q4/seq4 page4: sin incidencias (4.5±0.5=4–5 → D ✓)
- cmsjro0gq02l6qmt1horod148 | IMoE MEDIUM | seq5/page5 | class=broken_question | sev=Crítica | current: stem "...estimated that of all adults... nature shows, with margin of error of ." y opciones en blanco | expected: n=720, 32%, margen 3.41%; A "More than 35.41%", B "Between 28.59% and 35.41%" | action: re-transcribir valores inline; clave B correcta
- cmsjro0gv02lbqmt1vy3978uo | IMoE MEDIUM | seq6/page6 | class=broken_question | sev=Crítica | current: stem "...boxes with approximately pounds... period is pounds, margin pounds" y opciones en blanco | expected: 23 lb; 344 cajas; 8-hour; 23.1 lb; margen 0.19 lb; A "between 22.91 and 23.29 pounds" | action: re-transcribir valores inline; clave A correcta
- cmsjro0h202lgqmt1kwd0pqrz | IMoE MEDIUM | seq7/page7 | class=broken_question | sev=Crítica | current: stem sin valores y opciones A y C idénticas ("of the socks are defective") — flag option_dup por caída de valores | expected: 310 socks; 12%; margen 3.62%; A "3.62%", B "between 8.38% and 15.62%", C "12%", D "more than 15.62%" | action: re-transcribir valores inline; clave B correcta
- Q8/seq8 page8: sin incidencias (15%±2% de 10,000 = 1,300–1,700 → B ✓)
- Q9/seq9 page9: sin incidencias (35%±3% de 50,000 → ~16,750 → C ✓)
- cmsjro0hc02lnqmt1wacza8ef | IMoE MEDIUM | seq10/page10 | class=broken_question | sev=Crítica | current: stem "...mean value... is , margin of error of ." y opciones "between and" | expected: media 20.5, margen 1; A "between 19.5 and 21.5" | action: re-transcribir valores inline; clave A correcta

### One-Variable Data — EASY (setId=cmsjroni3068vqmt1guubp1ns, 16 q)

- Q1/seq1 page1: sin incidencias (mediana de 2,2,2,3,4,4,11 = 3 → B ✓; imageUrl = lista de datos como imagen, benigno)
- cmsjro0hq02lxqmt1n3f8z214 | One-Var EASY | seq2/page2 | class=broken_question | sev=Crítica | current: stem con lista de datos en blanco (", , , , , , , ,") y 4 opciones idénticas "Number Frequency" (contenido de tablas perdido) | expected: datos 4,4,4,4,8,8,8,13,13; A) 4→4,8→3,13→2 | action: re-transcribir lista de datos y las 4 tablas de frecuencia de las opciones; clave A correcta
- cmsjro0ht02m2qmt1o503bjet | One-Var EASY | seq3/page3 | class=broken_question | sev=Crítica | current: stem sin los datos (los data sets se renderizaron como imagen y se perdieron) | expected: Data set A: 72,73,73,76,76; Data set B: 61,64,74,85,x → x=86 | action: transcribir los data sets al stem; clave C correcta
- Q4/seq4 page4: sin incidencias
- Q5/seq5 page5: sin incidencias (media de 6,8,16,4,17,26,8,5,5,5 = 10 ✓)
- Q6/seq6 page6: sin incidencias (imageUrl = tabla real temps Houston; low mean 48.8 → A ✓)
- cmsjro0i802miqmt1nbi95jnd | One-Var EASY | seq7/page7 | class=broken_question | sev=Crítica | current: stem sin los datos (data sets renderizados como imagen y perdidos) | expected: Data set A: 1,2,3,4,5,6,7 (media 4); Data set B: 1,1,2,2,3,3,4 (media ≈2.29) → A>B | action: transcribir los data sets al stem; clave D correcta
- cmsjro0ib02mnqmt1w57uicda | One-Var EASY | seq8/page8 | class=image_missing | sev=Crítica | current: stem "...box plot above... median" con imageUrl null (box plot esencial ausente) | expected: box plot de acres (mediana ≈7,000) → B 7,067 | action: adjuntar el box plot; clave B correcta
- Q9/seq9 page9: sin incidencias (tabla wheels transcrita; rango 24-19=5 → B ✓)
- Q10/seq10 page10: sin incidencias — datos en stem, mediana 77 → B ✓; figure_ref falso positivo
- Q11/seq11 page11: sin incidencias (tabla países transcrita; media 22 → B ✓)
- Q12/seq12 page12: sin incidencias (tabla internships transcrita → C)
- Q13/seq13 page13: sin incidencias (tabla temps transcrita → D)
- Q14/seq14 page14: sin incidencias (imageUrl = bar graph real; media 4.2 → B ✓)
- cmsjro0j102nmqmt15f57wmm2 | One-Var EASY | seq15/page15 | class=image_missing | sev=Crítica | current: stem "The bar graph shows the distribution..." con imageUrl null (bar graph esencial ausente) | expected: bar graph nacimientos (Aug 50, Jul 40, dif 10) → D | action: adjuntar el bar graph; clave D correcta
- cmsjro0j402nnqmt19tbhmp2b | One-Var EASY | seq16/page16 | class=image_missing | sev=Crítica | current: stem "...books were collected by group ?" con imageUrl null y valores perdidos ("414", "10", "1") | expected: bar graph libros; "...414 books... by 10 groups... group 1?" → grupo 1 = 30 | action: adjuntar bar graph + re-transcribir valores inline; clave NUMERIC 30 correcta

### One-Variable Data — HARD (setId=cmsjronk7068xqmt1crefirfr, 4 q)

- Q1/seq1 page1: sin incidencias (tabla score freq transcrita; medianas B=6, A=5 → dif 1 ✓)
- cmsjrnzyt02euqmt18iagq73n | One-Var HARD | seq2/page2 | class=answer_key_wrong | sev=Alta | current: correctAnswer="2" | expected: 2.6 (o 13/5) — confirmado en ANS PDF (Andrew media 2.8; Maria media 2.9; x=17.4-14.8=2.6) | action: corregir clave NUMERIC a "2.6|13/5" (tabla en stem OK, no es figure_ref real)
- cmsjrnzyw02evqmt18qvf94lm | One-Var HARD | seq3/page3 | class=image_missing | sev=Crítica | current: stem "The results from 7 of the states are given in the table above..." sin datos e imageUrl null | expected: tabla — A 21.9%, B 27.9%, C 25.9%, D 19.5%, E 30.1%, F 36.4%, G 35.5% (mediana 7 estados 27.9%; |27.9-26.95|=0.95) | action: adjuntar/transcribir tabla; clave B correcta
- cmsjrnzz002f0qmt1s9ifqiau | One-Var HARD | seq4/page4 | class=broken_question | sev=Crítica | current: stem "Data set A consists of the heights of objects and has a mean of meters..." (todos los números perdidos) | expected: A: 75 objetos, media 25; B: 50 objetos, media 65; C: 125 objetos → media (1875+3250)/125=41 | action: re-transcribir valores inline; clave NUMERIC 41 correcta

### One-Variable Data — MEDIUM (setId=cmsjronlw068zqmt1q1r8vyfl, 13 q)

- cmsjro0tm02srqmt1ob3ask0d | One-Var MEDIUM | seq1/page1 | class=image_missing | sev=Crítica | current: stem "The histograms summarize..." con imageUrl null (2 histogramas Company A/B esenciales ausentes) | expected: histogramas (A concentrado, B bimodal/disperso) → A menor SD | action: adjuntar histogramas; clave A correcta
- Q2/seq2 page2: sin incidencias (media 5.6 / suma 28 = 1/5 ✓)
- Q3/seq3 page3: sin incidencias (→ B)
- cmsjro0wc02t2qmt1s8jt6xn4 | One-Var MEDIUM | seq4/page4 | class=broken_question | sev=Alta | current: stem "...what is the value of ?" (expresión |a-b| perdida, renderizada como imagen) | expected: "what is the value of |a−b|?" → 9 enteros consecutivos: media=mediana → 0 | action: re-transcribir la expresión |a−b|; clave NUMERIC 0 correcta
- cmsjro0wj02t3qmt1j0b6a9hq | One-Var MEDIUM | seq5/page5 | class=broken_question | sev=Crítica | current: stem sin los data sets (renderizados como imagen y perdidos) | expected: A: nueve 5; B: nueve 5 y 100 → medias distintas (5 vs 14.5), medianas iguales (5) → "Only the means are different" | action: transcribir los data sets; clave A correcta
- Q6/seq6 page6: sin incidencias (→ B)
- Q7/seq7 page7: sin incidencias (→ C)
- Q8/seq8 page8: sin incidencias — tabla gas stations transcrita; mediana $3.699 → C ✓ (figure_ref falso positivo; bestExPage bajo era artefacto)
- cmsjro0x802tnqmt1zkrwmlip | One-Var MEDIUM | seq9/page9 | class=image_missing | sev=Crítica | current: stem "Data set A has values and is represented by the dot plot shown. Data set B is created by adding to each..." con imageUrl null (dot plot ausente + valores "15" y "46" perdidos) | expected: dot plot (22-26, 15 valores); "adding 46" → mediana B>A, rangos iguales | action: adjuntar dot plot + re-transcribir "15" y "46"; clave A correcta
- cmsjro0xd02tsqmt1qm7ef91v | One-Var MEDIUM | seq10/page10 | class=answer_key_wrong | sev=Alta | current: correctAnswer="1" | expected: 1.3 (o 13/10) — confirmado en ANS PDF (mediana 2013 47.7 − mediana 2012 46.4 = 1.3) | action: corregir clave NUMERIC a "1.3|13/10" (tabla tourist arrivals SÍ transcrita en stem)
- Q11/seq11 page11: sin incidencias (tabla ages transcrita; mode 18<median 19<mean 20 → A ✓)
- Q12/seq12 page12: sin incidencias (tabla men's height transcrita → C ✓)
- Q13/seq13 page13: sin incidencias (→ A)

### One-Variable Data: Distributions and Measures — HARD (setId=cmsjron67068nqmt1xgavoopb, 20 q)

Dominio data-heavy: 13 de 20 preguntas dependen de una figura/tabla (box plots, scatterplots, dot plots, histogramas, tablas de frecuencia) que fue DESCARTADA en la promoción (imageUrl null). Todas las claves de respuesta verificadas contra el ANS PDF: 20/20 correctas.

- cmsjro0jw02ofqmt1lfzgrc83 | Distributions&Measures HARD | seq1/page1 | class=image_missing | sev=Crítica | current: stem "The box plots summarize the masses..." con imageUrl null (box plots Group 1/2 esenciales ausentes) | expected: box plots (medianas G1=25, G2=24 kg) → C | action: adjuntar box plots; clave C correcta
- cmsjro0jz02okqmt1701ofkw4 | Distributions&Measures HARD | seq2/page2 | class=image_missing | sev=Crítica | current: stem "The scatterplot shows..." exponential model, imageUrl null | expected: scatterplot decreciente (b entre 0 y 1) → A (0.83) | action: adjuntar scatterplot; clave A correcta
- cmsjro0k502omqmt1mvtvw4zk | Distributions&Measures HARD | seq4/page4 | class=image_missing | sev=Crítica | current: stem "The scatterplot shows... data set E. A line of best fit is shown..." imageUrl null | expected: scatterplot LOBF (E: y=12+1.5x → F ×3.9: y=46.8+5.9x) → A | action: adjuntar scatterplot; clave A correcta
- cmsjro0k802onqmt1ffhbjeba | Distributions&Measures HARD | seq5/page5 | class=image_missing | sev=Crítica | current: stem "Value Data set A frequency Data set B frequency\n...each consist of values. The table shows..." — tabla de frecuencias descartada y nº "27" perdido | expected: tabla (30/34/38/42/46 con freqs A y B; media A≈40.5 > B≈35.5) → A | action: adjuntar/transcribir tabla + valor "27"; clave A correcta
- cmsjro0mu02oxqmt115tm7jux | Distributions&Measures HARD | seq7/page7 | class=broken_question | sev=Crítica | current: stem "...its equation is . What does..." — la ecuación y=0.096x−0.488 (necesaria para resolver) fue perdida del stem; también scatterplot ausente | expected: "its equation is y=0.096x−0.488" (pendiente 0.096 $/año) → A | action: re-transcribir la ecuación inline (y adjuntar scatterplot); clave A correcta
- cmsjro0nt02p2qmt1r4dj2w5m | Distributions&Measures HARD | seq8/page8 | class=image_missing | sev=Crítica | current: stem "The two box plots show..." número de libros, imageUrl null | expected: box plots (rango A=5, rango B=9; dif=4) → 4 | action: adjuntar box plots; clave NUMERIC 4 correcta
- cmsjro0o502p3qmt1lq2qc8ge | Distributions&Measures HARD | seq9/page9 | class=image_missing | sev=Crítica | current: stem "The dot plots represent the distributions..." imageUrl null (dot plots A/B esenciales ausentes) | expected: dot plots simétricos (medianas iguales=13, SD distinta) → A (I only) | action: adjuntar dot plots; clave A correcta
- cmsjro0oe02p8qmt1zl7gdabj | Distributions&Measures HARD | seq10/page10 | class=image_missing | sev=Crítica | current: stem "Weight (pounds) Frequency\nThe frequency table summarizes... of tortoises. A weight of pounds is added..." — tabla descartada y valores "71"/"39"/"72" perdidos | expected: tabla Weight/Frequency (13→12,...,20→7; mediana=17); "39 pounds added" → media sube, mediana igual → B | action: adjuntar/transcribir tabla + valores; clave B correcta
- cmsjro0oj02pdqmt1xid6a3qh | Distributions&Measures HARD | seq11/page11 | class=image_missing | sev=Crítica | current: stem "The table shown summarizes the number of employees at each of the 17 restaurants..." — cuerpo de la tabla (rangos empleados/nº restaurantes) descartado, imageUrl null | expected: tabla (2-7:2, 8-13:4, 14-19:2, 20-25:7, 26-31:2; 9º restaurante en rango 20-25) → D (21) | action: adjuntar/transcribir tabla; clave D correcta
- cmsp5xn8o00010vo02ttre16s | Distributions&Measures HARD | seq12/page12 | class=image_missing | sev=Crítica | current: stem "Two data sets of 23 integers each are summarized in the histograms shown..." imageUrl null (2 histogramas A/B esenciales ausentes) | expected: histogramas (misma forma, A 20-60, B 10-50; menor dif de medias=1) → B | action: adjuntar histogramas; clave B correcta
- cmsjro0ov02poqmt1i2bj7y3i | Distributions&Measures HARD | seq15/page15 | class=image_missing | sev=Crítica | current: stem "The scatterplot above shows a company's ice cream sales..." imageUrl null | expected: scatterplot LOBF (pendiente ~33, intercepto ~84) → D (d=33t+84) | action: adjuntar scatterplot; clave D correcta
- cmsjro0oz02ppqmt1rlgzr4q2 | Distributions&Measures HARD | seq16/page16 | class=image_missing | sev=Crítica | current: stem "The dot plot represents a data set of the number of bursts for eruptions... an additional eruption with bursts is added... new data set of eruptions..." — dot plot ausente y valores "13"/"11"/"14" perdidos | expected: dot plot (1-5, 13 puntos); "13 eruptions", "11 bursts", "14 eruptions" → sólo la media sube → C (II only) | action: adjuntar dot plot + re-transcribir valores; clave C correcta
- cmsjro0p302puqmt1p38eg710 | Distributions&Measures HARD | seq17/page17 | class=stem_option_leak | sev=Baja | current: stem termina con encabezado suelto "Value Frequency" (las tablas van correctamente transcritas en las opciones A-D) | expected: stem sin el encabezado duplicado | action: quitar "Value Frequency" residual del final del stem; clave A correcta
- cmsjro0pa02q3qmt1mcedz699 | Distributions&Measures HARD | seq19/page20 | class=image_missing | sev=Crítica | current: stem "The scatterplot shows... the number of days after January , . ...on January to ...on January ?" — scatterplot ausente y fechas "11"/"13"/"15" perdidas | expected: scatterplot (días desde 1 enero; y=6 en día 2 = ene 13, y=15 en día 4 = ene 15); rate=(15−6)/2=4.5 | action: adjuntar scatterplot + re-transcribir fechas; clave NUMERIC 4.5|9/2 correcta
- Q3/seq3 page3: sin incidencias (data set en stem: 9 enteros dados, mayor=52 → NUMERIC 52 ✓)
- Q6/seq6 page6: sin incidencias (texto puro; ±7 sobre 27 nºs → SD cambia → D ✓)
- Q13/seq13 page13: sin incidencias (tabla Value/Frequency transcrita en stem; media=mediana → 0 → A ✓)
- Q14/seq14 page14: sin incidencias (texto puro; 116−84=32 → C ✓)
- Q18/seq18 page19: sin incidencias (texto puro; 134−118.75=15.25 → D ✓)
- Q20/seq20 page21: sin incidencias (imageUrl=scatterplot real correcto; 57×5=285 → NUMERIC 285 ✓)

### Percentages — EASY (setId=cmsjronnm0691qmt1238fxpjb, 15 q)

sin incidencias. 15/15 claves correctas (verificadas por cálculo directo / tabla). Falsos positivos de suspects aclarados: seq10 (Call Ratings) y seq15 (US minimum wage) tienen la tabla SÍ transcrita en el stem (no image_missing); seq7 tiene imageUrl real (tabla "Medical Information" 63%+13% de 1200 = 912 → C ✓). Aritmética verificada: Q1 72→B, Q2 $5→D, Q3 37→B, Q4 14→B, Q5 $40→D, Q6 $12→C, Q8 92%→D, Q9 72min→D, Q10 11%→B, Q11 145800→D, Q12 47→B, Q13 294→B, Q14 $21→C, Q15 60%→B.

### Percentages — MEDIUM (setId=cmsjronrr0695qmt1yr36jz67, 9 q)

3 preguntas con valores/tabla renderizados como imagen y perdidos en la promoción. Claves verificadas: 9/9 correctas (valores recuperados de la fuente confirman la respuesta almacenada).

- cmsjro1um03agqmt12iof2uzv | Percentages MEDIUM | seq2/page2 | class=image_missing | sev=Crítica | current: stem "The table summarizes... Number of Group objects A B C D Total\n...group C is of ... group A. What is the value of ?" — cuerpo de la tabla descartado y "p%"/"?" perdidos | expected: tabla (A=375, B=54, C=690, D=81, Total=1200); p=690/375·100=184 | action: adjuntar/transcribir tabla + variable p; clave NUMERIC 184 correcta
- cmsjro1uz03awqmt1fkxfht8x | Percentages MEDIUM | seq6/page6 | class=broken_question | sev=Crítica | current: stem "In a group, % of the items are red. Of all the red items..., % also have stripes..." con "40%"/"30%" perdidos; opciones A-D publicadas como "%" en blanco (sin números, todas idénticas) | expected: stem con 40% y 30%; opciones 10%/12%/70%/75%; 0.40·0.30=12% → B | action: re-transcribir valores del stem y opciones; clave B correcta
- cmsjro1v703b2qmt1ehawfbmw | Percentages MEDIUM | seq8/page8 | class=broken_question | sev=Crítica | current: stem "...people attended the first... of the people who attended the first... attended the second..., and of the people who..." — valores "1,250"/"72%"/"36%" perdidos | expected: 1250·0.72·0.36=324 | action: re-transcribir valores inline; clave NUMERIC 324 correcta
- Q1/seq1 page1: sin incidencias (texto puro; 800·0.8²=512 → B ✓)
- Q3/seq3 page3: sin incidencias (5.44% → D ✓)
- Q4/seq4 page4: sin incidencias (318/1.06=300 → C ✓)
- Q5/seq5 page5: sin incidencias (k=68, r=1.36 → C ✓)
- Q7/seq7 page7: sin incidencias (1.09x → A ✓)
- Q9/seq9 page9: sin incidencias (1.3M·0.15·6=1,170,000 → C ✓)

### Percentages — HARD (setId=cmsjronps0693qmt19m07n3pf, 10 q)

3 preguntas con valores/gráfico renderizados como imagen y perdidos. Claves verificadas: 10/10 correctas por valor (una observación de formato en Q2).

- cmsjrnzsk02d6qmt1vksp2h10 | Percentages HARD | seq2/page2 | class=broken_question | sev=Crítica | current: stem "...can contain a maximum of phosphorus by mass. If a sample... has a mass of grams..." — "0.001%" y "140" perdidos | expected: 0.001% de 140 g = 0.0014 g | action: re-transcribir valores inline; NOTA: clave almacenada "0014" debería ser "0.0014" (revisar formato NUMERIC del punto decimal)
- cmsjrnzsv02d9qmt1o6e7s59v | Percentages HARD | seq5/page5 | class=broken_question | sev=Crítica | current: stem "...purchase price of dollars each... consumer price that is of the purchase price. After months,... discounted price that is off the consumer price..." — "5.00"/"270%"/"4"/"70%" perdidos | expected: 5·2.70=13.50; 13.50·0.30=4.05 | action: re-transcribir valores inline; clave NUMERIC 4.05|81/20 correcta
- cmsjrnzt202dbqmt1pzivfk4d | Percentages HARD | seq7/page7 | class=image_missing | sev=Crítica | current: stem "The line graph shows... If is the percent decrease... what is the value of p?" — line graph ausente (imageUrl null) y "p%" perdido; puntos clave (2003,40) y (2007,10) sólo en el gráfico | expected: line graph; p=(40−10)/40·100=75 | action: adjuntar line graph + re-transcribir "p%"; clave NUMERIC 75 correcta
- Q1/seq1 page1: sin incidencias (texto puro; 1−0.37·0.37·0.42=94.25% → C ✓)
- Q3/seq3 page3: sin incidencias (z=22.5, w=47.25 → 189/4|47.25 ✓)
- Q4/seq4 page4: sin incidencias (b=4.7, a=9.87 → 9.87|987/100 ✓)
- Q6/seq6 page6: sin incidencias (a=0.3b, c=1.8a=0.54b → 27/50|0.54 ✓)
- Q8/seq8 page8: sin incidencias (tabla Subscriptions transcrita; 5%→2.5%, 5880·1.025=6027 → B ✓)
- Q9/seq9 page9: sin incidencias (texto puro; p=5x → B ✓)
- Q10/seq10 page10: sin incidencias (texto puro; students 15%=6 → total 40, 18−10=8 → NUMERIC 8 ✓)
