# QA de contenido — Practice Sets · Dominio Advanced Math

- Fecha: 2026-09-22
- Dominio: **Advanced Math** (Equivalent Expressions, Nonlinear Equations, Nonlinear Functions)
- Sets (9): Equivalent Expressions EASY/MEDIUM/HARD-#1; Nonlinear Equations EASY/MEDIUM/HARD-#1; Nonlinear Functions EASY/MEDIUM/HARD — 207 preguntas.
- Método: comparación visual (solo detección, DB read-only) de cada pregunta publicada contra su PDF fuente de ejercicio y su PDF de respuestas, siguiendo `scratchpad/method.txt`. Se confirman visualmente todos los sospechosos deterministas (`scratchpad/practice/_suspects/advanced.txt`), toda respuesta NUMERIC con `keyAns=null` (valor solo en imagen de la clave) y el lead conocido (Nonlinear Functions MEDIUM #27). Escaneo de texto barato para las no marcadas; se abre la página solo si el texto parece incorrecto.
- Formato de hallazgo: `qid | set + dificultad | seqN/pág | class=<clase> | sev=<Alta/Media/Baja/Crítica> | current: <publicado> | expected: <fuente> | action: <fix>`.

## Resumen de defectos

9 sets revisados (207 preguntas). **46 preguntas con defecto** en 6 sets; 3 sets limpios.

Defectos por clase (clase primaria por pregunta):
- **broken_question: 34** — ecuación/función/sistema/tabla/valores-de-opción renderizados como imagen fueron ELIMINADOS al ingerir; el stem queda gramatical pero sin las matemáticas (o con placeholders vacíos "  "). Defecto sistémico dominante.
- **image_missing: 9** — figura/gráfica esencial ausente (`imageUrl` null) en preguntas "the graph shown/above".
- **answer_key_wrong: 2** — claves publicadas incorrectas vs ANS (ver abajo).
- **redundant_ui_image: 1** — imagen de opción duplicada en el stem de una pregunta "which graph".

Sets limpios (sin incidencias): Equivalent Expressions EASY, Equivalent Expressions HARD-#1, Nonlinear Equations HARD-#1.

Claves de respuesta erróneas (Alta prioridad):
- Nonlinear Functions MEDIUM p27 (qid cmsjrnybd01wjqmt1z0jj2is4): publicado **2**, correcto **2.5** (lead confirmado).
- Nonlinear Functions MEDIUM p21 (qid cmsjrnyai01vxqmt17jd8wlzq): publicado **D (1994)**, correcto **B (1989)** (Moore's law).

Todas las demás claves verificadas (incl. cada NUMERIC con keyAns=null contra su página ANS) coinciden con la fuente.

Distribución por set: EE-EASY 0 · EE-MEDIUM 2 · EE-HARD 0 · NEQ-EASY 5 · NEQ-MEDIUM 10 · NEQ-HARD 0 · NF-EASY 7 · NF-HARD 7 · NF-MEDIUM 15.

---

## Hallazgos por set

### Advanced Math - Equivalent Expressions - EASY (setId=cmsjrol870677qmt1... , nQ=21)
Escaneo de texto: todos los stems traen su expresión algebraica en LaTeX (ninguna caída de ecuación-imagen); ninguna pregunta requiere figura; 0 sospechosos deterministas. Claves: 21/21 pubAns == ANS (MC, todas verificadas matemáticamente en muestreo). **sin incidencias**

### Advanced Math - Equivalent Expressions - MEDIUM (setId=cmsjrol0d0679qmt1... , nQ=23)
- `cmsjrnxvf01o4qmt1acaba9sv | Equivalent Expressions MEDIUM | p14 | class=broken_question | sev=Alta | current: stem = "Which of the following is equivalent to the expression above?" (sin expresión) | expected: fuente muestra la expresión `x^2 + 6x + 4` sobre esa pregunta | action: reinsertar el stem `x^2+6x+4` (opciones y clave B correctas). Nota menor: opciones renderizan el cuadrado en línea "(x + 3) 2 - 5".`
- `cmsjrnxw501p3qmt14y7h88qt | Equivalent Expressions MEDIUM | p22 | class=broken_question | sev=Alta | current: stem = "~~২~~ √ x ³ y ⁵" (índice de raíz = dígito bengalí, radicando y⁵) | expected: fuente = `∛(x^3 y^6)` (raíz cúbica, y a la 6) | action: corregir el stem a la raíz cúbica de x^3 y^6; clave B (xy^2) correcta.`
- Claves NUMERIC con valor-imagen verificadas contra ANS: p8=4 ✓, p10=5/2·2.5 ✓, p11=32 ✓. Resto de stems traen su LaTeX y claves MC 20/20 coinciden.
- Defectos: broken_question ×2.

### Advanced Math - Equivalent Expressions - HARD - #1 (setId=cmsjrokrp0675qmt1... , nQ=20)
Escaneo de texto: 20/20 stems traen su expresión en LaTeX (excepto #18 p18 que usa texto plano con superíndices unicode "(7532 + 100y²) + 10(10y² - 110)", legible y correcto — no defecto). 0 sospechosos deterministas. Claves NUMERIC valor-imagen verificadas: p4=-419 ✓, p5=.0177·4/225 ✓, p9=.09·9/100 ✓, p15=8 ✓ (por OCR ANS) y p7=7/6 ✓, p18=6632 ✓ (vistas en ANS). MC 12/12 coinciden. **sin incidencias**

### Advanced Math - Nonlinear Equations - EASY (setId=cmsjrokv5066tqmt1kk0y19x1, nQ=15)
- `cmsjrnxx801pfqmt1t08uoppj | Nonlinear Equations EASY | p5 | class=broken_question | sev=Crítica | current: stem = "What is one possible solution to the given equation?" (sin ecuación) | expected: fuente muestra `|x - 2| = 9` | action: reinsertar `|x-2|=9` en el stem; clave 11|-7 correcta.`
- `cmsjrnxxj01piqmt1e3ddffp7 | Nonlinear Equations EASY | p8 | class=broken_question | sev=Crítica | current: stem = "If  is a solution to the system of equations above, which of the following is a possible value of x?" (sin el sistema ni el par (x,y)) | expected: fuente muestra el sistema `x + y = 12`, `y = x^2` e "If (x, y) is a solution..." | action: reinsertar el sistema y el par ordenado; clave D correcta.`
- `cmsjrnxya01q0qmt1faegg5dv | Nonlinear Equations EASY | p14 | class=broken_question | sev=Crítica | current: stem = "How many distinct real solutions are there to the given equation?" (sin ecuación) | expected: fuente muestra `3x^2 - 15x + 18 = 0` | action: reinsertar la ecuación; clave B (exactamente dos) correcta.`
- `cmsjrnxxf01phqmt1fsh7fx65 | Nonlinear Equations EASY | p7 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph of a system... is shown" sin figura | expected: fuente muestra parábola tangente a la recta y=1 en (4,1) | action: adjuntar la gráfica del sistema; clave D (4,1) correcta.`
- `cmsjrnxxy01puqmt1ghid1gnm | Nonlinear Equations EASY | p12 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph of a system... is shown" sin figura | expected: fuente muestra recta y curva que se cortan en (2,4) | action: adjuntar la gráfica; clave C (2,4) correcta.`
- Claves verificadas (incl. NUMERIC valor-imagen p1=117 ✓). Resto sin incidencias.
- Defectos: broken_question ×3, image_missing ×2.

### Advanced Math - Nonlinear Equations - MEDIUM (setId=cmsjrokzu066xqmt1ox99soly, nQ=30)
Defecto sistémico masivo: ecuaciones/sistemas renderizados como imagen fueron eliminados al ingerir, dejando el stem sin la(s) ecuación(es). Claves verificadas en ANS: todas correctas.
- `cmsjrnxhg01goqmt1t1hhhwf6 | Nonlinear Equations MEDIUM | p1 | class=broken_question | sev=Crítica | current: "In the equation above... How many times does the graph of the equation above intersect the graph of the equation  in the xy-plane?" (faltan ambas ecuaciones) | expected: `y = ax^2 - c` y `y = a + c` | action: reinsertar ambas ecuaciones; clave C.`
- `cmsjrnxho01guqmt1kmacjlbu | Nonlinear Equations MEDIUM | p3 | class=broken_question | sev=Crítica | current: falta el sistema y las 4 opciones vacías (solo "and") | expected: sistema `y = x^2 - 1`, `y = 3`; opciones A (2,3)&(-2,3), B (2,4)&(-2,4), C (3,8)&(-3,8), D (√2,3)&(-√2,3) | action: reinsertar sistema + valores de opciones; clave A.`
- `cmsjrnxi601hbqmt1cq6h3q8u | Nonlinear Equations MEDIUM | p8 | class=broken_question | sev=Crítica | current: "If (x, y) is a solution of the system of equations above..." (falta sistema) | expected: `y = x^2`, `2y + 6 = 2(x + 3)` | action: reinsertar sistema; clave A.`
- `cmsjrnxin01hkqmt126lbj8ff | Nonlinear Equations MEDIUM | p13 | class=broken_question | sev=Crítica | current: "A solution to the given system of equations is . Which... value of xy?" (falta sistema y el par) | expected: `x^2 = 6x + y`, `y = -6x + 36`; "(x,y)" | action: reinsertar; clave A.`
- `cmsjrnxjc01hyqmt1fxk13388 | Nonlinear Equations MEDIUM | p19 | class=broken_question | sev=Crítica | current: "In the equation above, a is a constant and . If the equation has two integer solutions..." (falta ecuación y condición a>0) | expected: `x^2 - ax + 12 = 0`, `a > 0` | action: reinsertar; clave 7|8|13.`
- `cmsjrnxjt01i6qmt15nad36a9 | Nonlinear Equations MEDIUM | p24 | class=broken_question | sev=Crítica | current: "...y-coordinate of the point of intersection of the graphs of  and ?" (faltan ecuaciones) | expected: `y = (x-1)^2` y `y = 2x - 3` | action: reinsertar; clave 1.`
- `cmsjrnxjz01i8qmt16pkqtfxe | Nonlinear Equations MEDIUM | p26 | class=broken_question | sev=Crítica | current: "If the ordered pair  satisfies the system of equations above..." (falta sistema y par) | expected: `y = x^2 - 4x + 4`, `y = 4 - x` | action: reinsertar; clave 0|3.`
- `cmsjrnxml01ioqmt1up20zbi2 | Nonlinear Equations MEDIUM | p30 | class=broken_question | sev=Crítica | current: "If  is a solution to the system of equations above..." (falta sistema y par) | expected: `y = x + 1`, `y = x^2 + x` | action: reinsertar; clave A.`
- `cmsjrnxmo01itqmt1bajti7cy | Nonlinear Equations MEDIUM | p31 | class=image_missing | sev=Crítica | current: imageUrl null; "...graphed in the xy-plane above. How many solutions?" sin figura | expected: fuente muestra parábola + recta que se cortan en 2 puntos | action: adjuntar la gráfica; clave C.`
- `cmsjrnxjj01hzqmt1tq5nhspe | Nonlinear Equations MEDIUM | p20 | class=redundant_ui_image | sev=Media | current: stem lleva imageUrl (d7bde656...) que es un duplicado de la gráfica de la opción B (pregunta "which graph represents..." no debe llevar figura en el stem) | expected: stem solo con las ecuaciones `y = x^2 + 1.7`, `y = 1.7 - x` (presentes) y 4 opciones-gráfica | action: quitar la imagen del stem; clave A correcta.`
- Claves NUMERIC valor-imagen verificadas: p1=C, p2=-3, p14=8|9, p19=7|8|13, p24=1, p26=0|3 (+#12 a=3 por cálculo, stem completo). MC restantes coinciden.
- Defectos: broken_question ×8, image_missing ×1, redundant_ui_image ×1.

### Advanced Math - Nonlinear Equations - HARD - #1 (setId=cmsjrokp8..., nQ=11)
Escaneo de texto: 11/11 stems traen su ecuación en LaTeX; 0 sospechosos deterministas; ninguna requiere figura. Claves NUMERIC valor-imagen: p2=6, p4=94, p7=51, p9=31, p10=50 (OCR ANS) y p5=-3 (visto en ANS). MC 6/6 coinciden (verificadas por cálculo). **sin incidencias**

### Advanced Math - Nonlinear Functions - EASY (setId=cmsjrol480671qmt1q22ge6x3, nQ=17)
Defecto sistémico: gráficas/funciones/valores en imagen eliminados al ingerir. Claves verificadas (por gráfica fuente + ansindex): todas correctas.
- `cmsjrnxqe01m8qmt1m0ndg1em | Nonlinear Functions EASY | p10 | class=image_missing | sev=Crítica | current: imageUrl null; stem con basura de ejes OCR ("y 10 9 8 ... x O 1 2...") y las 4 opciones sin números ("The marble's height was  inches above the ground  seconds...") | expected: fuente muestra parábola (y-int 8, mín (4,2)); opciones con valores (A 0/8s, B 8/al empezar, C mín 0, D mín 8) | action: adjuntar gráfica, quitar leak de ejes, restaurar números de opciones; clave B. (también broken_question + stimulus_ui_leak)`
- `cmsjrnxqi01mdqmt11g0xkr4e | Nonlinear Functions EASY | p11 | class=broken_question | sev=Crítica | current: "The function gives... years after... where . ...statement " is approximately equal to " ..." (falta función y valores; opciones sin números) | expected: `f(x)=240,000(1.22)^x`, `0<x≤10`, "f(5) ≈ 648,650"; opciones con 5 años/648,650 etc. | action: restaurar función, dominio, valores y números de opciones; clave A.`
- `cmsjrnxqm01miqmt1t676opuh | Nonlinear Functions EASY | p12 | class=image_missing | sev=Crítica | current: imageUrl null; "The quadratic function graphed above..." sin figura | expected: fuente muestra parábola (diversidad vs elevación, pico ~1250 m) | action: adjuntar la gráfica; clave C (1,250).`
- `cmsjrnxqv01moqmt1xulfuzv3 | Nonlinear Functions EASY | p14 | class=broken_question | sev=Crítica | current: "The function f is defined above. What is the value of ?" (falta definición y argumento) | expected: `f(x)=(x+0.25x)(50-x)`, "value of f(20)" | action: restaurar función y f(20); clave C (750).`
- `cmsjrnxqz01mtqmt1xdv9pr38 | Nonlinear Functions EASY | p15 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph of the polynomial function , where , is shown. The y-intercept... is . What is the value of ?" | expected: fuente muestra gráfica polinómica con y-int (0,-3); "f", "y=f(x)", "(0,y)" | action: adjuntar gráfica + restaurar texto; clave -3. (image_missing + broken_question)`
- `cmsjrnxr601mzqmt1untahx0h | Nonlinear Functions EASY | p17 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph of is shown... The value of is an integer. What is the value of ?" | expected: fuente muestra gráfica y=f(x) (curva recíproca, f(0)=3) | action: adjuntar gráfica + restaurar "y=f(x)"/"f(0)"; clave 3. (image_missing + broken_question)`
- `cmsjrnxra01n0qmt198kbds32 | Nonlinear Functions EASY | p18 | class=broken_question | sev=Crítica | current: "The given equation models... over  months, where ... after the end of May , where . ..." (falta ecuación, fechas, dominio; opciones sin números) | expected: `y = -1/4 x^2 + 2x + 29`, "8 months", "May 2012", `0≤x≤8`; opciones May/June 2012 con 0/29 | action: restaurar ecuación, fechas y números de opciones; clave B (May 2012, 29).`
- No defectos: #1 (imagen gráfica real, y-int (0,-5)), #3 (tabla 0/0,1/1,2/8,3/27 presente + 4 opciones-gráfica; clave B; falso positivo del flag), #4 (imagen real, (0,2)), #12 (función `f(x)=x^2+4` presente + 4 opciones-gráfica; clave D), y #2/#5/#6/#7/#8/#15 (texto completo).
- Defectos: image_missing ×4 (p10, p12, p15, p17), broken_question ×3 como clase primaria (p11, p14, p18) + broken_question secundario en p10/p15/p17 y stimulus_ui_leak en p10.

### Advanced Math - Nonlinear Functions - HARD (setId=cmsjrol29066zqmt1k0gjfzt0, nQ=36)
La mayoría de las 36 traen su función/ecuación completa en LaTeX (muchos flags figure_ref son falsos positivos: función dada, no requiere figura). Claves verificadas: todas correctas (incl. NUMERIC valor-imagen p20=13, p32=8 vistas en ANS; p1/p5/p18/p21/p25/p27/p33 por OCR ANS).
- `cmsjrnx8c01ctqmt18j1s1xf6 | Nonlinear Functions HARD | p4 | class=broken_question | sev=Alta | current: 4 opciones sin números ("...during the  years was ." / "...in  was .") | expected: A durante 5 años=1,708; B durante 5 años=9,000; C en 1997=1,708; D en 1997=9,000 (stem con función `f(x)=9,000(0.66)^x` completo) | action: restaurar valores de opciones; clave D.`
- `cmsjrnx8p01d4qmt1rcuyj79f | Nonlinear Functions HARD | p7 | class=broken_question | sev=Crítica | current: tabla sin datos ("Number of bacteria per Day milliliter... 1 2 3") y objetivo "reach ?" | expected: tabla Día1=2.5×10^5, Día2=5.0×10^5, Día3=1.0×10^6; objetivo 5.12×10^8 | action: restaurar tabla y objetivo; clave D (Day 12).`
- `cmsjrnx9l01dkqmt10z6hae2n | Nonlinear Functions HARD | p15 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph of y=f(x) is shown, where f(x)=ab^x+c..." sin figura | expected: fuente muestra curva exponencial decreciente con asíntota ~ -7 (no corta y=0) | action: adjuntar la gráfica; clave D (Zero).`
- `cmsjrnx9q01dpqmt12qclxdgq | Nonlinear Functions HARD | p16 | class=broken_question | sev=Crítica | current: "The table above gives selected values of a polynomial function p..." sin tabla | expected: tabla x/p(x): -2/5, -1/0, 0/-3, 1/-1, 2/0 | action: restaurar la tabla; clave D ((x+1)(x-2)).`
- `cmsjrnxaz01e1qmt1wrnj5kzg | Nonlinear Functions HARD | p28 | class=broken_question | sev=Crítica | current: "The function h is defined above... If the zeros of the function are 6, and 7..." (falta función y el cero -5) | expected: `h(x)=x^3+ax^2+bx+c`; ceros -5, 6, 7 | action: restaurar función y el cero -5; clave 210.`
- `cmsjrnxbb01e4qmt1ml439wkz | Nonlinear Functions HARD | p31 | class=broken_question | sev=Media | current: "The quadratic function above models... If  is graphed..." (falta ecuación y "y=h(x)"; referencia "above" colgante) | expected: `h(x)=-16x^2+100x+10`, "y=h(x)" | action: restaurar ecuación y y=h(x); clave D. (respondible por interpretación pese al hueco)`
- `cmsjrnxef01elqmt13v07uy5o | Nonlinear Functions HARD | p34 | class=broken_question | sev=Crítica | current: "The functions g and h are defined by the given equations... I.  II. " (ambas ecuaciones vacías) | expected: I. `g(x)=18(1.16)(1.4)^(x+2)`, II. `h(x)=18(1.4)^(x+4)` | action: restaurar I y II; clave D.`
- Defectos: broken_question ×6, image_missing ×1.

### Advanced Math - Nonlinear Functions - MEDIUM (setId=cmsjrol670673qmt12t2nanmb, nQ=34)
Defecto sistémico (función/ecuación/tabla en imagen eliminadas) + DOS defectos de clave de respuesta (incluye el lead conocido). Claves verificadas contra ANS.
- `cmsjrnybd01wjqmt1z0jj2is4 | Nonlinear Functions MEDIUM | p27 | class=answer_key_wrong | sev=Alta | current: pubAns "2" | expected: fuente (ANS) indica 2.5 (5/2): cae 20→sube 10→cae→sube 5→cae→sube 2.5 entre el 3º y 4º rebote | action: corregir la clave a "2.5|5/2". (LEAD confirmado)`
- `cmsjrnyai01vxqmt17jd8wlzq | Nonlinear Functions MEDIUM | p21 | class=answer_key_wrong | sev=Alta | current: pubAns "D" (1994) | expected: fuente (ANS) "Choice B is correct" → 1989 (Moore: 275,000→550,000 en 1987→1,100,000 en 1989) | action: corregir la clave a B. Stem completo (por eso no marcado como broken).`
- `cmsjrny5d01udqmt17rul3ypq | Nonlinear Functions MEDIUM | p1 | class=broken_question | sev=Crítica | current: falta función, "2012", "4,000" y números de opciones | expected: `f(x)=4,000(0.75)^x`, x años tras 2012, x≤7; interpretación de 4,000 | action: restaurar; clave A.`
- `cmsjrny5k01unqmt10s729ei5 | Nonlinear Functions MEDIUM | p3 | class=broken_question | sev=Crítica | current: "The function S above models..." sin función | expected: `S(n)=38,000a^n` | action: restaurar; clave C (1.04).`
- `cmsjrny5n01usqmt1vpxinvsu | Nonlinear Functions MEDIUM | p4 | class=broken_question | sev=Crítica | current: "The equation above estimates... interpretation of 5,640" sin ecuación | expected: `D=5,640(1.9)^t` | action: restaurar; clave D.`
- `cmsjrny5r01uxqmt1lqr91cvn | Nonlinear Functions MEDIUM | p5 | class=image_missing | sev=Crítica | current: imageUrl null; "Which... could be the equation of the graph shown?" sin figura | expected: fuente muestra polinomio con x-int en -5,0,4 (tangente en -5) | action: adjuntar la gráfica; clave B.`
- `cmsjrny5x01uzqmt1rsj67y7i | Nonlinear Functions MEDIUM | p7 | class=broken_question | sev=Crítica | current: "For the given function , the graph of ... passes through the point , where is a constant..." (falta función, y=f(x), (0,b)) | expected: `f(x)=x^5+9x+17`; punto (0,b) | action: restaurar; clave 17.`
- `cmsjrny6301v5qmt1m0xkbk5y | Nonlinear Functions MEDIUM | p9 | class=broken_question | sev=Crítica | current: "If the given function is graphed... x-coordinate of an x-intercept?" (falta función) | expected: `f(x)=(x+6)(x-4)` | action: restaurar; clave -6|4.`
- `cmsjrny6c01v8qmt11zzyt5v0 | Nonlinear Functions MEDIUM | p12 | class=broken_question | sev=Crítica | current: "...modeled by the function . ...best interprets the equation ?" (falta función y h(1.4)=1.64) | expected: `h(x)=-16x^2+20x+5`; `h(1.4)=1.64` | action: restaurar; clave A.`
- `cmsjrny6s01vlqmt11tzn2f1s | Nonlinear Functions MEDIUM | p17 | class=broken_question | sev=Crítica | current: "The equation gives... interpretation of the number in this context?" (falta ecuación y el número 5) | expected: `E(t)=5(1.8)^t`; interpretación de 5 | action: restaurar; clave A.`
- `cmsjrny9p01vvqmt14dhfb8gb | Nonlinear Functions MEDIUM | p19 | class=broken_question | sev=Crítica | current: "The table above gives the values of the function f..." sin tabla | expected: tabla x/f(x): 0/5, 1/(5/2), 2/(5/4), 3/(5/8) | action: restaurar tabla; clave D.`
- `cmsjrnyat01w2qmt1iyx3aaj2 | Nonlinear Functions MEDIUM | p22 | class=broken_question | sev=Crítica | current: "The function above models the height h... What does the number 72 represent?" sin función | expected: `h(t)=-16t^2+110t+72` | action: restaurar; clave A.`
- `cmsjrnyay01w7qmt1c7wtwjq0 | Nonlinear Functions MEDIUM | p23 | class=broken_question | sev=Crítica | current: "The function N defined above..." sin función | expected: `N(d)=115(0.90)^d` | action: restaurar; clave D.`
- `cmsjrnyb901weqmt14hir6f3i | Nonlinear Functions MEDIUM | p26 | class=broken_question | sev=Crítica | current: "the function above models the airflow ... what angle gives the greatest airflow?" sin función | expected: `f(θ)=-0.28(θ-27)^2+880` | action: restaurar; clave C (27).`
- `cmsjrnybj01wlqmt1p488w8bu | Nonlinear Functions MEDIUM | p29 | class=broken_question | sev=Crítica | current: "The table shows the exponential relationship..." sin tabla | expected: tabla Time/Total: 0/670.00, 1/674.02, 2/678.06 | action: restaurar tabla; clave B.`
- No defectos (falsos positivos de flag): #16, #20, #24, #31 (which-graph, ecuación `y=4(2^x)` + 4 opciones-gráfica presentes, clave D correcta), #34; resto de MC de texto completo con clave correcta.
- Defectos: broken_question ×12, image_missing ×1, answer_key_wrong ×2.
