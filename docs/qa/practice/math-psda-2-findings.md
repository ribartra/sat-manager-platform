# QA de contenido — Practice Sets MATH · Problem Solving and Data Analysis (Grupo 2)

- Fecha: 2026-09-22
- Dominio: Problem Solving and Data Analysis
- Temas (Grupo 2): Probability · Ratios, Rates, Proportions, and Units · Statistical Claims · Two-Variable Data
- Sets revisados: 12 (Probability E/M/H, Ratios E/M/H, Statistical Claims E/M/H, Two-Variable Data E/M/H) — 104 preguntas
- Método: Comparación read-only de la pregunta publicada (dev.db) contra el PDF de ejercicio y el PDF de respuestas (renders en scratch a 150 dpi). Confirmación visual de cada pregunta señalada por el pre-scan (`figure_ref_no_image`, `option_dup`) más barrido de texto de las no señaladas. Detección únicamente; sin escritura a datos ni a preguntas promovidas.
- Clases de defecto: ver `method.txt` (broken_question, image_missing, image_incomplete, option_dup, answer_key_wrong, etc.)

## Resumen de defectos

_(se completa al final)_

---
## Probability — EASY (set cmsjronvk0697qmt1mik7stgs, 12 q)

Patrón sistémico: preguntas de tabla de frecuencias donde los NÚMEROS solo viven en la tabla (no en el enunciado) y `imageUrl=null` → la tabla se perdió por completo; pregunta irresoluble. Answer keys correctas en todas las verificadas.

- cmsjro23103f9qmt1uqgmjk8c | Probability EASY | seq2/p2 | class=broken_question | sev=Crítica | current: enunciado sin la tabla (edad × nº visitas), imageUrl=null | expected: tabla 2×2 con totales (At least 40 = 105, Total = 135) | action: transcribir la tabla al enunciado o adjuntar imagen; key D=105/135 OK
- cmsjro23b03fgqmt1z5pg5im0 | Probability EASY | seq5/p5 | class=broken_question | sev=Crítica | current: "…summarized in the table above" pero sin tabla, imageUrl=null | expected: tabla texting behavior (Talks daily total=415, Total=799) | action: restituir tabla; key B=415/799 OK
- cmsjro23h03fjqmt1njro4jcq | Probability EASY | seq7/p7 | class=broken_question | sev=Crítica | current: "…as shown in the frequency table" sin frecuencias, imageUrl=null (NO señalada por el pre-scan) | expected: tabla igneous=10, metamorphic=33, sedimentary=27 (total 70) | action: restituir tabla; key D=10/70 OK
- cmsjro23k03fkqmt1fj5g1vcn | Probability EASY | seq8/p8 | class=broken_question | sev=Crítica | current: enunciado sin tabla, imageUrl=null | expected: tabla sports (Play: M312/F220; Not play: M?/F216; total 1000) | action: restituir tabla; key B=252 OK
- cmsjro23p03fpqmt1j6edxvy3 | Probability EASY | seq9/p9 | class=broken_question | sev=Crítica | current: solo el título "Colors of Marbles in a Bag", sin datos, imageUrl=null | expected: tabla Red=8, Blue=10, Green=22, Total=40 | action: restituir tabla; key D=10/40 OK
- cmsjro27003fqqmt1a4ozs83u | Probability EASY | seq10/p10 | class=broken_question | sev=Crítica | current: solo título "Customer Purchases at a Gas Station", sin datos, imageUrl=null | expected: tabla 2×2 (Gasoline not purchased total=50, Total=135) | action: restituir tabla; key D=50/135 OK
- cmsjro27j03frqmt1xyznb6xj | Probability EASY | seq11/p11 | class=broken_question | sev=Crítica | current: solo título "Number of High School Students…", sin datos, imageUrl=null | expected: tabla por año (2010: Valley=65, Total=140) | action: restituir tabla; key B=65/140 OK

Resto (seq1,3,4,6,12): sin incidencias — datos en el enunciado (seq12 tiene la tabla de voces transcrita en el texto), keys coherentes.

## Probability — HARD (set cmsjronya0699qmt160kuwri9, 6 q)

Answer keys verificadas correctas en las 6. Confirmadas las pistas previas.

- cmsjro1yi03b8qmt1s09vbmaj | Probability HARD | seq1/p1 | class=broken_question | sev=Alta | current: la tabla SÍ está transcrita (sangre/rhesus) pero se perdió el valor de probabilidad "1/9": "…blood type B is . What is the value of x?" | expected: "…is 1/9." | action: restituir "1/9"; key x=8 OK
- cmsjro1z503baqmt1zlc9lrm9 | Probability HARD | seq3/p3 | class=broken_question | sev=Crítica | current: tabla perdida por completo (solo etiquetas garbled "years years years / Group A/B/C"), y "at least 10" → "at least years", imageUrl=null | expected: tabla 3×3 (Group A: 7/14/9; totales col=30; A≥10=23, ≥10 total=60) | action: restituir tabla y "10"; key 23/60 OK
- cmsjro1zc03bbqmt1mnrfmehp | Probability HARD | seq4/p4 | class=(sin defecto) | sev=- | current: tabla 2013 State-Level Taxes transcrita en el enunciado con datos (39/4/6/1) | expected: igual | action: NINGUNA — falso positivo del pre-scan; key C=13.3% OK
- cmsjro1zk03bgqmt1gdcgk8sj | Probability HARD | seq5/p5 | class=broken_question | sev=Crítica | current: tabla perdida (solo "Site A Site B Total / Tulip / Daffodil / Total", sin números), imageUrl=null | expected: tabla Tulip A=35/B=15/T=50; Daffodil 31/21/52 | action: restituir tabla; key 0.7|7/10 OK
- cmsjro1zo03bhqmt132hr627q | Probability HARD | seq6/p6 | class=broken_question | sev=Crítica | current: "…90 participants… at least 10 years" pero sin números de tabla, imageUrl=null | expected: tabla 3×3 (Group A: 5/17/8; A≥10=25, ≥10 total=60) | action: restituir tabla; key B=5/12 OK

seq2 (Internet subscribers, NUMERIC 42): sin incidencias — enunciado completo, sin tabla; key OK.

## Probability — MEDIUM (set cmsjroo0l069bqmt13o7ht2f9, 11 q)

Answer keys verificadas correctas en todas. Ojo: 3 defectos NO fueron señalados por el pre-scan (seq4, seq8, seq10, NUMERIC con valores caídos).

- cmsjro14u02weqmt1gl8r8mxk | Probability MEDIUM | seq1/p1 | class=broken_question | sev=Crítica | current: solo título "Prices of 14 Different Cars", sin tabla, imageUrl=null | expected: tabla (Hybrid ≤25k=2, Total=14) | action: restituir tabla; key A=1/7 OK
- cmsjro14x02wfqmt1r1vwtn4t | Probability MEDIUM | seq2/p2 | class=broken_question | sev=Crítica | current: "…table above" sin tabla, imageUrl=null | expected: tabla kittens (Chocolate deep blue=12, Chocolate total=16) | action: restituir tabla; key D=12/16 OK
- cmsjro15x02wgqmt14vc11nqr | Probability MEDIUM | seq3/p3 | class=image_missing | sev=Crítica | current: imageUrl=/uploads/questions/2d58920d83e1e9e04d2c1c27.jpg pero la imagen es un recorte de la fracción "8/15" (valor de la opción D), NO la tabla | expected: tabla HR/Accounting (HR: Bachelor 4/Master 2; Acc: 3/6) | action: reemplazar imagen por la tabla real o transcribirla; key B=1/3 OK
- cmsjro16002whqmt1hc5onwbf | Probability MEDIUM | seq4/p4 | class=broken_question | sev=Crítica | current: "A box contains red pens and blue pens" — se cayeron "13" y "37" (NO señalada por pre-scan) | expected: "13 red pens and 37 blue pens" | action: restituir 13 y 37; key 13/50|0.26 OK
- cmsjro16402wiqmt13uep3edq | Probability MEDIUM | seq5/p5 | class=broken_question | sev=Alta | current: tabla penguin SÍ transcrita, pero se cayó el objetivo "1/3": "…closest to being of the total female…" | expected: "…closest to being 1/3 of the total female…" | action: restituir "1/3"; key A=Chinstrap OK
- cmsjro18202wnqmt1rrn3oggr | Probability MEDIUM | seq6/p6 | class=broken_question | sev=Crítica | current: título garbled + "The table above gives…" sin datos, imageUrl=null | expected: tabla Ages/Number (≥50=34, ≥60=10) | action: restituir tabla; key B=10/34 OK
- cmsjro18902woqmt137q4ddu2 | Probability MEDIUM | seq7/p7 | class=broken_question | sev=Crítica | current: solo título "Weekday and Weekend Day Rain…" sin datos, imageUrl=null | expected: tabla (No rain: weekend=16, total=64) | action: restituir tabla; key B=1/4 OK
- cmsjro18c02wpqmt1ufmfmsst | Probability MEDIUM | seq8/p8 | class=broken_question | sev=Crítica | current: "total of attendees… group A is and… group B is …" — se cayeron 275, 0.44, 0.24 (NO señalada por pre-scan) | expected: "275 attendees… A is 0.44… B is 0.24" | action: restituir valores; key 88 OK
- cmsjro18k02wrqmt10ae79v4j | Probability MEDIUM | seq10/p10 | class=broken_question | sev=Crítica | current: "Each vertex of a -sided polygon labeled with… letters through… the letter be at…" — se cayeron 14, A, N, D (NO señalada por pre-scan) | expected: "14-sided… 14 letters A through N… letter D" | action: restituir; key 1/14 OK
- cmsjro18q02wsqmt14tzzxuei | Probability MEDIUM | seq11/p11 | class=broken_question | sev=Crítica | current: "…table below…" sin datos, imageUrl=null | expected: tabla state parks (camping & no bici=5, total=37) | action: restituir tabla; key A=5/37 OK

seq9 (1,200 customers/day, MC B=1/10): sin incidencias — todos los datos en el enunciado; key OK.

## Ratios, Rates, Proportions, and Units — EASY (set cmsjroo34069dqmt1h80y2516, 14 q)

Dominio poco denso en figuras; keys verificadas por cálculo en todas. 2 defectos por caída de valores en el enunciado (seq7 sí señalada como falso "figure_ref"; seq8 es falso positivo — su tabla x/y está transcrita).

- cmsjro2l303lxqmt1v1wrnzb8 | Ratios EASY | seq7/p7 | class=broken_question | sev=Crítica | current: "The ratio of t to u is 1 to 2, and . What is the value of u?" (se cayó "t = 10") | expected: "…and t = 10." | action: restituir "t = 10"; key D=20 OK
- cmsjro2lq03maqmt1bakr6n9u | Ratios EASY | seq14/p14 | class=broken_question | sev=Crítica | current: "…is approximately of its weight… is approximately of its weight…" (se cayeron 9/10 Venus y 23/10 Jupiter) | expected: Venus 9/10, Jupiter 23/10 | action: restituir fracciones; key C=140 OK (confirmado en ANS)

Resto (seq1-6, seq8-13): sin incidencias. seq8 (tabla x/y 1-4,3-12,5-20,40-k) está transcrita en el enunciado, imageUrl=null correcto, key D=160 OK.

## Ratios, Rates, Proportions, and Units — MEDIUM (set cmsjroo6o069hqmt17qb40ao1, 15 q)

4 defectos: 1 valor caído, 1 corrupción de variable, y 2 answer_key truncados a entero (NO señalados por el pre-scan). Resto de keys verificadas por cálculo.

- cmsjro1si039bqmt1b4gb3dkt | Ratios MEDIUM | seq1/p1 | class=broken_question | sev=Crítica | current: "average speed of miles per hour… in yards per hour?" (se cayeron "20.300" y la nota "(1 mile = 1,760 yards)") | expected: 20.300 mph + nota de conversión | action: restituir; key 35728 OK
- cmsjro1tq03a2qmt1v7g17o7c | Ratios MEDIUM | seq10/p10 | class=broken_question | sev=Media | current: "When she works 2 hours, she earns 13.50z dollars" (variable z leída como "2" → enunciado inconsistente) | expected: "When she works z hours, she earns 13.50z dollars" | action: corregir 2→z; key A OK
- cmsjro1u703adqmt1cqywu1cg | Ratios MEDIUM | seq13/p13 | class=answer_key_wrong | sev=Alta | current: correctAnswer="4" | expected: 4.44 (0.555×8; ANS indica 4.44) | action: corregir key a "4.44"
- cmsjro1ub03aeqmt1d6psm1iz | Ratios MEDIUM | seq14/p14 | class=answer_key_wrong | sev=Alta | current: correctAnswer="25" | expected: 25.4 (o 127/5; ANS indica 25.4) | action: corregir key a "25.4|127/5"

Resto: sin incidencias. seq5 (tabla Food/Protein/Cost) transcrita, key D OK. seq9 (vaso "pictured above") es figura decorativa, volumen 473cc dado en texto, imageUrl=null correcto, key B OK.

## Ratios, Rates, Proportions, and Units — HARD (set cmsjroo50069fqmt1dqmavmda, 7 q)

2 defectos de enunciado. seq6: el pre-scan no lo marcó pero mi cálculo detectó divergencia key↔stem → el stem está corrupto (la key coincide con la fuente).

- cmsjro19a02x0qmt1szysgyie | Ratios HARD | seq4/p4 | class=broken_question | sev=Crítica | current: "taken from trees… edge of one of these cubes is centimeters. If this cube has a mass of grams" (se cayeron 25, 2.00, 2.56) | expected: 25 trees, edge 2.00 cm, mass 2.56 g | action: restituir; key 0.32|8/25 OK (confirmado en ANS)
- cmsjro19g02x2qmt1hwc8za4h | Ratios HARD | seq6/p6 | class=broken_question | sev=Alta | current: "$\frac{6n}{b}=6.7$ and $\frac{n}{bn}=26.8$" (ecuación corrupta: coeficiente y variable erróneos) | expected: fuente = "$\frac{4a}{b}=6.7$ and $\frac{a}{bn}=26.8$" | action: corregir stem a 4a/b y a/bn; key 1/16|0.0625 OK (deriva de la fuente, no del stem publicado)

Resto (seq1,2,3,5,7): sin incidencias, keys OK.

## Statistical Claims — EASY (set cmsjroocm069nqmt1ei281boa, 2 q)

sin incidencias — ambas preguntas de texto completo, sin figuras; keys D (seq1 muestra sesgada) y D (seq2 inferencia) OK.

## Statistical Claims — MEDIUM (set cmsjrooa4069lqmt1yy2olrg2, 3 q)

sin incidencias — texto completo (incl. numerales romanos I/II/1-2-3 con su contenido); keys A (Neither), C (all history profs Cal State), A (None) OK.

## Statistical Claims — HARD (set cmsjroo8h069jqmt1ch3nztht, 6 q)

2 defectos por caída de tabla y de números en enunciado+opciones. Las preguntas de generalización siguen respondibles pero el enunciado quedó incompleto.

- cmsjro28403g2qmt1z5yfnjbz | Stat Claims HARD | seq2/p2 | class=broken_question | sev=Alta | current: tabla 2×3 (Horas practicadas × Puntos) perdida/garbled sin números, imageUrl=null; además "selected teams" (falta 55), opt A "scored or more points" (falta 14), opt C "practiced for at least hours" (falta 3) | expected: tabla (3-5h: 6/4/10; >5h: 4/26/30; Total 10/30/40), 55 equipos, 40 en muestra, 14, 3 | action: restituir tabla y números; key D=All trivia teams in the tournament OK
- cmsjro28l03gmqmt1b1ewujq5 | Stat Claims HARD | seq6/p6 | class=broken_question | sev=Alta | current: "baobab trees that were years old… for consecutive years" (faltan 50, 17, 2); opciones B y D quedan IDÉNTICAS ("All the baobab trees that were years old in this habitat") por caída de 19/17 → option_dup | expected: 50, 17, 2; opt A "the 50…selected", B "19 years old", C "17…South Africa", D "17…this habitat" | action: restituir números; key D OK

Resto (seq1,3,4,5): sin incidencias, texto completo, keys B/B/C/C OK.

## Two-Variable Data — EASY (set cmsjroolb069tqmt1gpm3g8px, 13 q)

Dominio muy denso en gráficos. 10/13 preguntas tienen imagen: verificadas todas — son el scatterplot/gráfico correcto (no paneles de opciones ni figuras ajenas); seq2 y seq11 comparten legítimamente el mismo scatterplot Temp/Elevación. 3 defectos: gráficos requeridos con imageUrl=null.

- cmsjro1p1037mqmt1iz5u0dsh | Two-Variable Data EASY | seq3/p3 | class=image_missing | sev=Crítica | current: imageUrl=null; "results… along with the graph of a quadratic function that models the data" pero el gráfico "Vehicle Stopping Distance" no está | expected: gráfico cuadrático stopping-distance | action: adjuntar imagen; key C=210 OK
- cmsjro1po037xqmt1ghnxk1ot | Two-Variable Data EASY | seq6/p6 | class=image_missing | sev=Crítica | current: imageUrl=null; "line of best fit for the data in the scatterplot" sin scatterplot | expected: scatterplot (puntos ~(1,6)…(5,1), decreciente) | action: adjuntar; key A=y=-x+6 OK
- cmsjro1r9038sqmt19lje3i7n | Two-Variable Data EASY | seq13/p13 | class=image_missing | sev=Crítica | current: imageUrl=null; "best model for the data in the scatterplot" sin scatterplot | expected: scatterplot parabólico | action: adjuntar; key B=2x²-11x+20 OK

Resto (seq1,2,4,5,7,8,9,10,11,12): sin incidencias — imágenes presentes y correctas, keys OK.

## Two-Variable Data — MEDIUM (set cmsjrooig069rqmt1y5ly7sve, 11 q)

El set más dañado: 9 defectos. 7 scatterplots requeridos con imageUrl=null + 2 enunciados con LaTeX/valores caídos (seq9, seq10 — este último colapsa las 4 opciones). seq3 (tablas "nonlinear") está OK: datos en texto de opción E imágenes de opción correctas. seq7 texto puro OK.

- cmsjro1rc038tqmt1ql0ibuy2 | TVD MEDIUM | seq1/p1 | class=image_missing | sev=Crítica | current: null; scatterplot con línea de mejor ajuste ausente (pide y en x=32) | expected: scatterplot | action: adjuntar; key C=2.4 OK
- cmsjro1rg038uqmt16t8niie6 | TVD MEDIUM | seq2/p2 | class=image_missing | sev=Crítica | current: null; "scatterplot above" ausente | expected: scatterplot | action: adjuntar; key A=y=3x+0.8 OK
- cmsjro1rn038wqmt1obu1s7w3 | TVD MEDIUM | seq4/p4 | class=image_missing | sev=Crítica | current: null; scatterplot "Railroad Museum Visitors" ausente | expected: scatterplot | action: adjuntar; key A=n=16,090+4,680t OK
- cmsjro1rr038xqmt10mgsbptn | TVD MEDIUM | seq5/p5 | class=image_missing | sev=Crítica | current: null; scatterplot high-jump/long-jump ausente | expected: scatterplot | action: adjuntar; key C=y=3.30x+0.82 OK
- cmsjro1ru038yqmt1zgd1w3p5 | TVD MEDIUM | seq6/p6 | class=image_missing | sev=Crítica | current: null; scatterplot "charities" + línea de mejor ajuste ausente | expected: scatterplot | action: adjuntar; key B=7% OK
- cmsjro1ry038zqmt1x1siifxe | TVD MEDIUM | seq8/p8 | class=image_missing | sev=Crítica | current: null; scatterplot ausente (pide y en x=25.5) | expected: scatterplot | action: adjuntar; key C=8.2 OK
- cmsjro1s10390qmt11dgeqn1n | TVD MEDIUM | seq9/p9 | class=broken_question | sev=Crítica | current: "…the data point with and the y-value predicted… at ?" (se cayó "x = 1" dos veces) + imageUrl=null (scatterplot ausente) | expected: "x = 1" en ambos + scatterplot | action: restituir x=1 y adjuntar imagen; key A=1 OK
- cmsjro1s70395qmt178649wa5 | TVD MEDIUM | seq10/p10 | class=broken_question | sev=Crítica | current: stem "values of and for ?" y las 4 opciones perdieron 2^x, 2x+2, x>0 → A≡B ("For all , it is true that .") y C≡D (option_dup) | expected: "2^x and 2x+2 for x>0"; opciones con las expresiones | action: restituir LaTeX de stem y opciones; key C OK
- cmsjro1sd039aqmt18qgr3d06 | TVD MEDIUM | seq11/p11 | class=image_missing | sev=Crítica | current: null; scatterplot ausente (pide pendiente de la línea) | expected: scatterplot | action: adjuntar; key B=-0.8 OK

Resto (seq3 tablas nonlinear con datos en opciones + imágenes de opción correctas; seq7 texto puro): sin incidencias.

## Two-Variable Data — HARD (set cmsjroof0069pqmt1l9pzylyn, 4 q)

2 defectos (scatterplots con imageUrl=null). seq1 tiene imagen correcta (Protein/Fat); seq2 es tabla transcrita (falso positivo del pre-scan).

- cmsjro13v02vqqmt1x61kj4dx | TVD HARD | seq3/p6 | class=image_missing | sev=Crítica | current: null; scatterplot "Size and Sale Price of Houses in Town H" ausente | expected: scatterplot | action: adjuntar; key B=y=100x+100 OK
- cmsjro13y02vrqmt18ihfb28k | TVD HARD | seq4/p7 | class=image_missing | sev=Crítica | current: null; scatterplot "Electric Energy Generated by Nuclear Sources" ausente | expected: scatterplot (parábola invertida) | action: adjuntar; key D=-1.674x²+19.76x+745.73 OK

Resto: seq1 (imagen Protein/Fat presente y correcta, key C=1.5 OK) y seq2 (tabla Account A/B transcrita en el enunciado, imageUrl=null correcto, key A OK): sin incidencias.

---
## Resumen de defectos — 9 sets Grupo 2 (Ratios / Statistical Claims / Two-Variable Data)

Sets revisados: 9 (75 preguntas). Defectos: 24.

- image_missing (Crítica): 12 — TVD EASY seq3/6/13; TVD MEDIUM seq1/2/4/5/6/8/11; TVD HARD seq3/4. Scatterplot/gráfico requerido para resolver, promovido con imageUrl=null (defecto sistémico del dominio).
- broken_question (Crítica/Alta/Media): 10 — Ratios EASY seq7/14; Ratios MEDIUM seq1/10; Ratios HARD seq4/6; Stat Claims HARD seq2/6; TVD MEDIUM seq9/10. Valores/tablas/expresiones LaTeX caídos del enunciado u opciones (2 de ellos, Stat HARD seq6 y TVD MED seq10, además producen option_dup; TVD MED seq9 además tiene image_missing).
- answer_key_wrong (Alta): 2 — Ratios MEDIUM seq13 (key "4" vs 4.44) y seq14 (key "25" vs 25.4). Respuesta NUMERIC truncada a entero → marcaría mal la respuesta correcta.

Sets limpios (sin incidencias): Statistical Claims EASY y Statistical Claims MEDIUM.
Todas las answer keys verificadas contra el PDF de respuestas coinciden, salvo las 2 answer_key_wrong anteriores.

