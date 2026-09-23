# QA de contenido — MATH Practice Sets — Dominio: Algebra

- Fecha: 2026-09-22
- Dominio: **Algebra** (Linear Equations One Variable, Linear Equations Two Variables, Linear Functions, Linear Inequalities, Systems of Two Linear Equations)
- Alcance: 15 sets, 267 preguntas
- Método: comparación read-only de la pregunta PUBLICADA contra el PDF de ejercicio (fuente) y el PDF de respuestas. Solo detección; no se modifica dev.db ni las Questions promovidas. Se confirma visualmente cada sospechoso de la cola de prioridad y se escanea el resto por texto, abriendo la página fuente cuando algo parece mal. Clases y severidades por `method.txt`.
- Lead sistémico verificado: ecuaciones/tablas/gráficas mostradas como imagen en los PDFs de College Board fueron DESCARTADAS del stem publicado (y en varios MC también los VALORES de las opciones), quedando huecos tipo "If , the value of is between" y opciones "(A) and".

## Resumen de defectos

_(se completa al final)_

---

## Hallazgos por set

### Algebra - Linear Equations in One Variable - EASY (setId=cmsjrolb30677qmt1g5ib2611, nQ=18)

- cmsjrnz8t027yqmt1x5jaq93x | LinEq 1-Var EASY | seq17/page17 | class=broken_question | sev=Crítica | current: "In the given equation, k is a constant. If the equation has infinitely many solutions, what is the value of k?" (sin ecuación, imageUrl null) | expected: ecuación gobernante `6x + k = 6x + 5` sobre el enunciado (imagen de math descartada; sin ella es irresoluble) | action: anteponer la ecuación al stem (LaTeX). correctAnswer=5 correcto, no tocar.

Verificado: seq7 lleva su ecuación `10 = 2x + 4` en imagen enlazada (no es crop de UI), answer B correcto. Resto: LaTeX/enunciados autocontenidos, sin gaps.
sin incidencias: seq 1-16, 18.

### Algebra - Linear Equations in One Variable - MEDIUM (setId=cmsjrole10679qmt16i99x3nl, nQ=18)

- cmsjrnymq01yvqmt1kypfinkg | LinEq 1-Var MEDIUM | seq1/page1 | class=broken_question | sev=Crítica | current: enunciado sin ecuación y sin la `x` ("selling tape dispensers", "interpretation of ") | expected: `15,000 = 2.00x - 4,500`; "x tape dispensers"; interpretación de `2.00x`; opción A "...selling x tape dispensers" | action: restaurar ecuación/término y la `x`. ans A correcto.
- cmsjrnymx01z5qmt1y8nq3m50 | LinEq 1-Var MEDIUM | seq3/page3 | class=broken_question | sev=Crítica | current: "The equation above can be used to find how many years n..." (sin ecuación) | expected: ecuación `2n + 6 = 14` | action: restaurar ecuación. ans B correcto.
- cmsjrnyn201zaqmt1e5kd78en | LinEq 1-Var MEDIUM | seq4/page4 | class=broken_question | sev=Crítica | current: "In the given equation, is a constant... value of ?" (NUMERIC, sin ecuación/variable) | expected: `2x + 16 = a(x + 8)`; "a is a constant"; "value of a" | action: restaurar ecuación + variable a. ans 2 correcto.
- cmsjrnyn701zbqmt1fsd3nwzh | LinEq 1-Var MEDIUM | seq5/page5 | class=broken_question | sev=Crítica | current: "In the given equation, b is a constant. If the equation has no solution, what is the value of b?" (sin ecuación) | expected: `(b - 2)x = 8` | action: restaurar ecuación. ans A(2) correcto.
- cmsjrnynf01zlqmt1rzrkm9y7 | LinEq 1-Var MEDIUM | seq7/page7 | class=broken_question | sev=Crítica | current: "In the equation above..." (sin ecuación); opciones todas "(X) and" (valores perdidos) [confirma suspect option_dup/option_word_fragment] | expected: `a(3 - x) - b = -1 - 2x`; A: a=2,b=1; B: a=2,b=7; C: a=-2,b=5; D: a=-2,b=-5 | action: restaurar ecuación + valores de opciones. ans B correcto.
- cmsjrnynu0202qmt1oy9cfymb | LinEq 1-Var MEDIUM | seq12/page12 | class=broken_question | sev=Crítica | current: "earns revenue of for each tablet... earned in profit... expenses of ." (NUMERIC, 3 valores $ perdidos) | expected: revenue `$14`/tablet; profit `$406`; expenses `$112`; nota "(profit = total revenue - total expenses)" | action: restaurar los 3 valores. ans 37 correcto.

sin incidencias: seq2, 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18.

### Algebra - Linear Equations in One Variable - HARD (setId=cmsjrol830675qmt185jyxfj9, nQ=12)

- cmsjrnz43024pqmt1hvxs3vdb | LinEq 1-Var HARD | seq2/page2 | class=broken_question | sev=Crítica | current: "If , the value of is between..." opciones "(A) and"..."(D) and" | expected: `(x-5)/7 = (x-5)/9`, "value of x-5"; A: -9 y -7; B: -3 y 3; C: 4.5 y 5.5; D: 6.75 y 9.25 | action: restaurar ecuación + valores. ans B correcto.
- cmsjrnz4d024vqmt126v4shyk | LinEq 1-Var HARD | seq4/page4 | class=broken_question | sev=Crítica | current: "The equation , where a and b are constants, has no solutions..." con I./II./III. vacíos | expected: `9x+5 = a(x+b)`; I. a=9; II. b=5; III. b≠5/9 | action: restaurar ecuación + condiciones I/II/III. ans D correcto.
- cmsjrnz4j0250qmt1f3kcdfin | LinEq 1-Var HARD | seq5/page5 | class=broken_question | sev=Crítica | current: "If , the value of is between..." opciones "(A) and"..."(D) and" | expected: `(x+6)/3 = (x+6)/13`, "value of x+6"; A: -7 y -3; B: -2 y 2; C: 2 y 7; D: 8 y 13 | action: restaurar ecuación + valores. ans B correcto.
- cmsjrnz4t0256qmt110z12wxp | LinEq 1-Var HARD | seq7/page7 | class=broken_question | sev=Crítica | current: "In the given equation, is a constant. The equation has no solution. What is the value of ?" (sin ecuación) | expected: `3(kx+13) = (48/17)x + 36`; k constante | action: restaurar ecuación display. ans 16/17 correcto.
- cmsjrnz4x0257qmt1awmfnk3a | LinEq 1-Var HARD | seq8/page8 | class=broken_question | sev=Crítica | current: "How many solutions does the equation have?" (sin ecuación) | expected: "...the equation `10(15x-9) = -15(6-10x)` have?" | action: restaurar ecuación inline. ans C correcto.
- cmsjrnz5c025jqmt1evmadlq5 | LinEq 1-Var HARD | seq12/page12 | class=broken_question | sev=Crítica | current: "In the given equation, and are constants, and . If the equation has infinitely many solutions..." (sin ecuación) | expected: `(12x+28)/4 - s/13 = r(x-8)`; s,r constantes, s>0 | action: restaurar ecuación display. ans 403 correcto.

sin incidencias: seq1, 3, 6, 9, 10, 11.


### Algebra - Linear Inequalities - EASY (setId=cmsjrom8w067rqmt1vr7jf524, nQ=11)

- cmsjrnyfu01wvqmt1qq7mkdyu | LinIneq EASY | seq2/page2 | class=broken_question | sev=Crítica | current: desigualdad del stem descartada y 4 opciones colapsadas a texto idéntico ("length and width , perimeter ≤ .") [confirma suspect option_dup] | expected: `2l + 2w ≤ 27`; par (l,w)=(8,3); A: length 3, width 8, ≤27; B: length 8, width 3, ≤27; C: length 3, width 8, ≥27; D: length 8, width 3, ≥27 | action: restaurar desigualdad, par (8,3) y valores num/≤/≥ por opción. ans B correcto.
- cmsjrnyge01x4qmt1m7fqupwy | LinIneq EASY | seq7/page7 | class=broken_question | sev=Crítica | current: desigualdad del stem en blanco ("satisfies the inequality ?") y pares I./II./III. vacíos (NO estaba en la cola de sospechosos) | expected: `5x - 3y < 4`; I.(1,1), II.(2,5), III.(3,2) | action: restaurar desigualdad y los 3 pares (x,y). ans C correcto.

sin incidencias: seq 1, 3, 4, 5, 6, 8, 9, 10, 11.

### Algebra - Linear Inequalities - HARD (setId=cmsjrom0v067nqmt122dfwkci, nQ=9)  [sin flags previos; hallado por escaneo]

- cmsjrnzg902b2qmt1fkbvt19a | LinIneq HARD | seq3/page3 | class=broken_question | sev=Crítica | current: "Anthony will spend at most to purchase small cheese pizzas and large... interpretation of in this context?" (desigualdad y variables perdidas, imageUrl null) | expected: `11x + 14y ≤ 115`; "at most $115... x small... y large"; "interpretation of 14y" | action: restaurar desigualdad y $115/x/y/14y. ans C correcto.
- cmsjrnzgi02b8qmt1jszyr07l | LinIneq HARD | seq5/page5 | class=broken_question | sev=Crítica | current: "The formula above is Ohm's law... potential difference of volts." (fórmula I=V/R y "6n" perdidos) | expected: fórmula `I = V/R`; "potential difference of 6n volts" | action: restaurar fórmula y "6n". ans 20 correcto.
- cmsjrnzgo02baqmt1tdn4633e | LinIneq HARD | seq7/page7 | class=broken_question | sev=Crítica | current: "A number is at most less than times the value of . If the value of is , what is the greatest possible value of ?" (todos los números/variables perdidos) | expected: "A number x is at most 2 less than 3 times the value of y. If y is -4, greatest possible value of x?" | action: restaurar x,2,3,y,-4. ans -14 correcto.

sin incidencias: seq1, 2, 4, 6, 8, 9.

### Algebra - Linear Functions - EASY (setId=cmsjroltz067lqmt172ck5qko, nQ=23)

- cmsjrnzc0028mqmt1chk4on61 | LinFunc EASY | seq7/page7 | class=image_missing | sev=Crítica | current: "Some values of the linear function f are shown in the table above" — sin tabla, imageUrl null | expected: tabla x|f(x): 1|5, 3|13, 5|21 | action: adjuntar/transcribir tabla. ans C(4x+1) correcto.
- cmsjrnzch028oqmt1nx59qz47 | LinFunc EASY | seq9/page9 | class=broken_question | sev=Alta | current: "The equation below estimates the distance d... which of the following does 45 represent?" — ecuación perdida | expected: `d = 45t` | action: insertar ecuación. ans C correcto.
- cmsjrnzcn028tqmt1l66zudlq | LinFunc EASY | seq10/page10 | class=broken_question | sev=Crítica | current: "The function gives the estimated height, , of the fluid... interpretation of in this context?" — definición y valor 39 perdidos | expected: `f(x)=39-0.18x`, altura en cm, x días; interpretación de `39` | action: restaurar f(x) y "39"/"in cm". ans A correcto.
- cmsjrnzct028yqmt1idhnfbz2 | LinFunc EASY | seq11/page11 | class=broken_question | sev=Crítica | current: "In the equation above, T represents Brittany's total take-home pay..." — ecuación perdida | expected: `T = 1,000 + 18h` | action: insertar ecuación. ans B(32) correcto.
- cmsjrnzd9029aqmt1rgl7hzu5 | LinFunc EASY | seq15/page15 | class=image_missing | sev=Crítica | current: stem referencia tabla, imageUrl null | expected: tabla Area|Water: 2,520|4,536; 3,780|6,804; 5,040|9,072 | action: adjuntar/transcribir tabla. ans B(1.8x) correcto.
- cmsjrnzdf029cqmt185a2bgmt | LinFunc EASY | seq17/page17 | class=image_missing | sev=Crítica | current: "The graph shows the estimated temperature y..." imageUrl null | expected: recta temp vs presión, ~(1.5,200) pendiente 100 hasta (9,1000); en x=6 → 700 | action: adjuntar gráfica. ans C(700) correcto.
- cmsjrnzdm029iqmt14vy8g7wy | LinFunc EASY | seq19/page19 | class=broken_question | sev=Crítica | current: "modeled by the function P defined above, where is the population t years after 1990... interpretation of the equation ?" — P(t)=250+10t y P(30)=550 perdidos | expected: `P(t)=250+10t`; interpretación de `P(30)=550` | action: restaurar ecuaciones. ans C correcto.

Notas: suspects seq16/seq22 tienen pendiente+intercepto/punto en el texto (no requieren figura) → sin incidencia; seq23 tiene sus 4 gráficas de opción presentes, ans D(y=2x-5) correcto; seq6 gráfica de stem presente y correcta.
sin incidencias: seq 1,2,3,4,5,6,8,12,13,14,16,18,20,21,22,23.

### Algebra - Linear Functions - HARD (setId=cmsjrolnl067hqmt1k4znj7ma, nQ=17)

- cmsjrnzef02a0qmt1mq9nx3p8 | LinFunc HARD | seq2/page2 | class=broken_question | sev=Crítica | current: "The equation gives the corresponding temperature , ... temperature of kelvins, where . If a substance has a temperature of degrees Fahrenheit..." (ecuación + números perdidos) | expected: `h = 9(v-273.15)/5 + 32`, v>0; substance temp = 467.33 °F | action: restaurar ecuación y 467.33. ans 515 correcto.
- cmsjrnzel02a4qmt1a26jmfr5 | LinFunc HARD | seq4/page4 | class=broken_question | sev=Crítica | current: "The formula relates the length , in cm, ... to the weight w ... meaning of the 2" (fórmula perdida) | expected: `l = 30 + 2w` | action: restaurar fórmula. ans D correcto.
- cmsjrnzeo02a9qmt14arxr9gt | LinFunc HARD | seq5/page5 | class=image_missing | sev=Crítica | current: "The table above shows some values of x and their corresponding values f(x)..." imageUrl null | expected: tabla x=[-11,-10,-9,-8], f(x)=[21,18,15,12] | action: transcribir/adjuntar tabla. ans B(-4,0) correcto.
- cmsjrnzez02acqmt19tp54rqw | LinFunc HARD | seq8/page8 | class=broken_question | sev=Crítica | current: "For the function , for all values of , where is a positive constant. If , what is the value of ?" (math perdido) | expected: `f(cx) = x - 8`, c>0, `f(2)=35`, hallar c | action: restaurar ecuaciones. ans 2/43|0.0465 correcto.
- cmsjrnzf802afqmt1yc8dz5v4 | LinFunc HARD | seq11/page11 | class=image_missing | sev=Crítica | current: "the table shows three values of x and their corresponding values of f(x)..." imageUrl null | expected: tabla x=[1,2,3], f(x)=[-64,0,64] | action: transcribir/adjuntar tabla. ans D(192) correcto.
- cmsjrnzfb02agqmt1r9kz20gu | LinFunc HARD | seq12/page12 | class=broken_question | sev=Crítica | current: "...modeled by the function F defined below, where is the average price per gallon x months after September 1. The constant 2.74..." (definición F perdida) | expected: `F(x) = 2.74 - 0.19(x - 3)` | action: restaurar definición. ans D correcto.
- cmsjrnzfg02alqmt192hmchr3 | LinFunc HARD | seq13/page13 | class=broken_question | sev=Crítica | current: "The functions and are defined as and . If the function is defined as , what is the x-coordinate..." (definiciones perdidas) | expected: `f(x)=¼x-9`, `g(x)=¾x+21`, `h(x)=f(x)+g(x)` | action: restaurar definiciones. ans -12 correcto.
- cmsjrnzfq02aoqmt1puhjz0l1 | LinFunc HARD | seq16/page16 | class=image_missing | sev=Crítica | current: "The table shows two values of and their corresponding values of . The graph ... passes through the point . What is the value of ?" imageUrl null | expected: tabla x=[-12,6], y=[-45,45]; punto (¼, a) | action: transcribir/adjuntar tabla + punto. ans 16.25|65/4 correcto.

sin incidencias: seq1, 3, 6, 7, 9, 10, 14, 15, 17.

### Algebra - Systems of Two Linear Equations - EASY (setId=cmsjromb5067tqmt1nxc91ae0, nQ=15)

- cmsjrnz5f025kqmt1hvjk6sj7 | Systems EASY | seq1/page1 | class=broken_question | sev=Crítica | current: "In the given system of equations, a is a constant. If the system has infinitely many solutions, what is the value of a?" — sin ecuaciones | expected: sistema `2x + 7y = 9` / `8x + 28y = a` | action: anteponer las dos ecuaciones. ans C(36) correcto (a=4·9).
- cmsjrnz630263qmt1q2d0naej | Systems EASY | seq8/page8 | class=broken_question | sev=Crítica | current: "If is the solution to the given system of equations, what is the value of y?" — ecuaciones perdidas y token (x,y) descartado | expected: `x + y = 20` / `2(x + y) + 3y = 85`; "If (x, y) is the solution…" | action: anteponer ecuaciones y restaurar "(x, y)". ans B(15) correcto.
- cmsjrnz6d026aqmt1mtkbzizr | Systems EASY | seq11/page11 | class=image_missing | sev=Crítica | current: "The graph of a system of linear equations is shown…", imageUrl null [confirma suspect figure_ref_no_image] | expected: gráfica xy con rectas que se cortan en (2,3) | action: adjuntar gráfica fuente. ans C(2,3) correcto.
- cmsjrnz6n026hqmt1hjhcecl7 | Systems EASY | seq14/page14 | class=image_missing | sev=Crítica | current: "A system of two linear equations is graphed in the xy-plane below." "Which of the following points is the solution…", imageUrl null (NO estaba en la cola) | expected: gráfica xy con rectas que se cortan en (3,9) | action: adjuntar gráfica fuente. ans A(3,9) correcto.

sin incidencias: seq2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 15.

### Algebra - Linear Inequalities - MEDIUM (setId=cmsjrom5j067pqmt1n2z9npxv, nQ=13)

- cmsjrnyon020jqmt155smks69 | LinIneq MEDIUM | seq4/page4 | class=broken_question | sev=Crítica | current: "Which point ( , ) is a solution to the given inequality in the -plane?" y todas las opciones "( , )" (desigualdad y valores de opción perdidos) [suspect option_dup: no eran duplicadas, quedaron en blanco] | expected: `y < -4x + 4`; A.(-4,0) B.(0,5) C.(2,1) D.(2,-1) | action: restaurar desigualdad y los 4 pares. ans A correcto.
- cmsjrnypa020tqmt107mu6ebc | LinIneq MEDIUM | seq10/page10 | class=broken_question | sev=Crítica | current: "Which of the following ordered pairs (x, y) satisfies the system of inequalities above?" sin sistema, imageUrl null (NO flageada) | expected: sistema `y ≤ 3x + 1` / `x - y > 1` | action: añadir el sistema al stem. ans D correcto.
- cmsjrnypl020wqmt13inxzee3 | LinIneq MEDIUM | seq13/page13 | class=broken_question | sev=Crítica | current: NUMERIC "onetime fee of  to rent the venue and  per attendee… budget of ." (3 valores $ perdidos) | expected: `$35` renta, `$10.25` por asistente, budget `$200` | action: restaurar $35/$10.25/$200. ans 16 correcto.
- cmsjrnype020uqmt180342x45 | LinIneq MEDIUM | seq11/page11 | class=option_text_wrong | sev=Media | current: opción D como texto crudo `25,000 > \frac{4,332}{2,712}t` sin delimitadores (A-C texto plano); el `\frac{}` se muestra literal | expected: opción D como fracción renderizada `25,000 > (4,332/2,712)t` (valores correctos, 4,332 es distractor deliberado) | action: envolver opción D en `$…$`. Solo render, no cambia valores.

sin incidencias: seq1, 2, 3, 5, 6, 7, 8, 9, 12.

### Algebra - Systems of Two Linear Equations - HARD (setId=cmsjromej067xqmt1lh3j2m9p, nQ=14)  [sin flags previos; hallado por escaneo]

- cmsjro0pv02q6qmt1m8k4chb0 | Systems HARD | seq2/page2 | class=broken_question | sev=Crítica | current: "In the given system of equations, is a constant. If the system has no solution, what is the value of ?" (ambas ecuaciones y nombre de constante perdidos) | expected: sistema `(3/2)y - (1/4)x = 2/3 - (3/2)y` / `(1/2)x + 3/2 = py + 9/2`; "p is a constant… value of p?" | action: restaurar ecuaciones + `p`. ans 6 correcto.
- cmsjro0py02q7qmt15r81gg8x | Systems HARD | seq3/page3 | class=broken_question | sev=Crítica | current: "In the given system of equations, is a constant. If the system has no solution, what is the value of ?" (ecuaciones y constante perdidas) | expected: sistema `4x - 6y = 10y + 2` / `ty = 1/2 + 2x`; "t is a constant… value of t?" | action: restaurar ecuaciones + `t`. ans 8 correcto.
- cmsjro0qv02qvqmt1gzbch0u9 | Systems HARD | seq13/page13 | class=broken_question | sev=Crítica | current: "In the given system of equations, is a constant. In the xy-plane, the graphs... intersect at the point , where is a constant. What is the value of ?" (ecuaciones, w, punto, q perdidos) | expected: sistema `-x - wy = -337` / `2x - wy = 47`; "w is a constant… intersect at (q, 19), where q is a constant. value of w?" | action: restaurar ecuaciones + w + (q,19) + q. ans 11 correcto.

sin incidencias: seq1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14.

### Algebra - Linear Equations in Two Variables - EASY (setId=cmsjrolga067bqmt1qy4h9kkj, nQ=31)

- cmsjrnyy30235qmt1igtglrkc | LinEq 2-Var EASY | seq0/page19 | class=broken_question | sev=Crítica | current: type=NUMERIC, ans "D"; el STEM es la RACIONAL de respuesta ("Choice D is correct. It's given that the graph shows…"), sin pregunta/opciones/gráfica | expected: MC "The graph shows the linear relationship between x and y. Which table gives three values of x and their corresponding values of y?" gráfica por (0,-5),(1,-3),(2,-1) + 4 tablas; ans D | action: reconstruir como MC desde la página real (gráfica + 4 tablas), adjuntar gráfica.
- cmsjrnyy30235qmt1igtglrkc | LinEq 2-Var EASY | seq0/page19 | class=type_mismatch | sev=Alta | current: type=NUMERIC con respuesta-letra "D" | expected: MC | action: cambiar type NUMERIC→MC.
- cmsjrnyyc0238qmt1tqc7zadv | LinEq 2-Var EASY | seq3/page3 | class=broken_question | sev=Crítica | current: "A shipping company charged a customer $25… The equation above represents…" (ecuación perdida) | expected: `3a+4b=25` | action: insertar ecuación. ans B correcto.
- cmsjrnyyg023dqmt10uvdzu40 | LinEq 2-Var EASY | seq4/page4 | class=broken_question | sev=Alta | current: "The equation above relates the number of minutes… what does 75 represent?" (ecuación perdida) | expected: `x+y=75` | action: insertar ecuación. ans C correcto.
- cmsjrnyyp023jqmt1by1u1w8l | LinEq 2-Var EASY | seq6/page6 | class=broken_question | sev=Crítica | current: "A total of paper straws… interpretation of in this context?"; opciones A/C y B/D idénticas (perdieron 24/73) [suspect option_dup] | expected: "A total of 364… `3x+4y=364`… interpretation of (x,y)=(24,73)?"; A) 24 triangles→73 rectangles; B) 24→73 straws; C) 73→24 rectangles; D) 73→24 straws | action: restaurar 364, ecuación, (24,73) y valores de opción. ans A correcto.
- cmsjrnyys023oqmt1xhqxlmt7 | LinEq 2-Var EASY | seq7/page7 | class=broken_question | sev=Crítica | current: "The equation models the relationship… How many pieces… 30 minutes?" (ecuación perdida) | expected: `y=0.1x` | action: insertar ecuación. ans B correcto.
- cmsjrnyyw023tqmt1heotosww | LinEq 2-Var EASY | seq8/page8 | class=image_missing | sev=Crítica | current: imageUrl null; "Which... is an equation of the graph shown in the xy-plane above?" | expected: recta por (0,-1) pendiente -1/4 | action: adjuntar gráfica. ans A correcto.
- cmsjrnyz90241qmt1xo8m2ip3 | LinEq 2-Var EASY | seq11/page11 | class=broken_question | sev=Alta | current: "Mario purchased 4 binders… best interpretation of 24?" (ecuación perdida) | expected: `4x+3y=24` | action: insertar ecuación. ans C correcto.
- cmsjrnyzk0244qmt11g2ft2cc | LinEq 2-Var EASY | seq15/page15 | class=image_missing | sev=Crítica | current: imageUrl null; "The table shows three values of x and their corresponding values of y…" sin datos | expected: tabla x:0,1,2 → y:18,13,8 | action: adjuntar/transcribir tabla. ans D correcto.
- cmsjrnyzw0247qmt1z4q6h0bj | LinEq 2-Var EASY | seq18/page18 | class=image_missing | sev=Crítica | current: imageUrl null; "The graph shows the linear relationship between x and y…" | expected: recta por (0,-5),(1,-3),(2,-1) | action: adjuntar gráfica. ans D correcto.
- cmsjrnyzz0248qmt12w1lpoq9 | LinEq 2-Var EASY | seq19/page20 | class=image_missing | sev=Crítica | current: imageUrl null; "The table above shows some pairs of x values and y values…" sin tabla | expected: tabla x:1,2,3,4 → y:5,7,9,11 | action: adjuntar/transcribir tabla. ans A correcto.
- cmsjrnz0d024cqmt1kk05hyfn | LinEq 2-Var EASY | seq23/page24 | class=image_missing | sev=Crítica | current: imageUrl null; "What is the y-intercept of the line graphed?" | expected: recta con y-intercept (0,5) | action: adjuntar gráfica. ans C correcto.
- cmsjrnz0h024dqmt1n50dbo5p | LinEq 2-Var EASY | seq24/page25 | class=broken_question | sev=Alta | current: "In the equation above, F represents… interpretation for the number 7.00?" (ecuación perdida) | expected: `F=2.50x+7.00y` | action: insertar ecuación. ans B correcto.
- cmsjrnz0w024lqmt1mmufoxwl | LinEq 2-Var EASY | seq28/page29 | class=image_missing | sev=Crítica | current: imageUrl null; "What is the y-intercept of the line graphed?" | expected: recta con y-intercept (0,8) | action: adjuntar gráfica. ans D correcto.
- cmsjrnz3p024mqmt193yp03oh | LinEq 2-Var EASY | seq29/page30 | class=broken_question | sev=Crítica | current: NUMERIC; "The y-intercept of the graph of in the xy-plane is . What is the value of ?" (ecuación y punto perdidos) | expected: "y-intercept of `y=-6x-32`… is (0,y). value of y?" | action: insertar `y=-6x-32` y (0,y). ans -32 correcto.
- cmsjrnz3v024nqmt18jifuzjf | LinEq 2-Var EASY | seq30/page31 | class=image_missing | sev=Crítica | current: imageUrl null; "What is the equation of the line shown in the xy-plane above?" | expected: recta por (0,3) y (1,0), pendiente -3 | action: adjuntar gráfica. ans B correcto.

Falso positivo (NO defecto): seq22/page23 (cmsjrnz0a024bqmt1bge45g2a) flageada figure_ref_no_image pero `y=34x+81` está inline y no requiere figura; ans A correcto.
sin incidencias: seq1, 2, 5, 9, 10, 12, 13, 14, 16, 17, 20, 21, 22, 25, 26, 27.

### Algebra - Linear Functions - MEDIUM (setId=cmsjrolpc067jqmt1b8tg8qgj, nQ=22)
- cmsjrnys9021xqmt117pau780 | LinFunc MEDIUM | seq1/page1 | class=answer_key_wrong | sev=Alta | current: correctAnswer "2" | expected: 2.6 (fuente "The correct answer is 2.6"; 0.6+4(0.5)=2.6; 13/5) | action: corregir clave a "2.6|13/5".
- cmsjrnyv9021zqmt1l31z8me6 | LinFunc MEDIUM | seq3/page3 | class=broken_question | sev=Crítica | current: "The equation below models... The graph of this equation is a line." (ecuación ausente) | expected: `y = 120 − 25x` | action: insertar la ecuación en el stem. ans correcto.
- cmsjrnyvg0224qmt12oq2ympo | LinFunc MEDIUM | seq4/page4 | class=broken_question | sev=Crítica | current: "line has a slope of and a y-intercept of . What is the x-coordinate..." | expected: "line k has a slope of 5 and a y-intercept of (0, −35)" | action: restaurar pendiente 5 y y-intercept (0,−35). ans correcto.
- cmsjrnyvk0225qmt1zbbo40kc | LinFunc MEDIUM | seq5/page5 | class=image_missing | sev=Crítica | current: "The table gives the average time t..." sin tabla, imageUrl null | expected: tabla Distance/Average time: 0.32→8, 0.56→14, 0.68→17 (t=25d) | action: adjuntar/transcribir tabla. ans correcto.
- cmsjrnyvq0226qmt107flle78 | LinFunc MEDIUM | seq6/page6 | class=broken_question | sev=Crítica | current: opciones A≡D "Each game costs ." y B≡C "The video game system costs ." (valores $ perdidos) | expected: A "$25 cada juego", B "$100 la consola", C "$25 la consola", D "$100 cada juego" | action: restaurar valores $ en las 4 opciones. ans correcto.
- cmsjrnyvq0226qmt107flle78 | LinFunc MEDIUM | seq6/page6 | class=image_missing | sev=Crítica | current: imageUrl null; stem referencia "The graph of the function f" | expected: recta de (0,100) a (10,350), pendiente 25 | action: adjuntar gráfica.
- cmsjrnyw9022gqmt12ekc83wd | LinFunc MEDIUM | seq10/page11 | class=broken_question | sev=Crítica | current: "Some values of the linear function f are shown in the table above. What is the value of ?" (tabla + f(3) perdidos) | expected: tabla x/f(x): 0→−2, 2→4, 6→16; pide f(3)=7 | action: restaurar tabla y "f(3)". ans correcto.
- cmsjrnywj022mqmt1uw8ndtuz | LinFunc MEDIUM | seq12/page13 | class=image_missing | sev=Crítica | current: "The graph above shows the distance traveled d..." imageUrl null | expected: recta por origen, pendiente 2 (d vs m) | action: adjuntar gráfica. ans correcto.
- cmsjrnywq022nqmt11sawy3io | LinFunc MEDIUM | seq13/page14 | class=image_missing | sev=Crítica | current: título "Population of Greenleaf, Idaho" pero tabla ausente, imageUrl null | expected: tabla Year/Population: 2000→862, 2010→846 | action: adjuntar/transcribir tabla. ans correcto.
- cmsjrnywv022oqmt1mqlhjq2t | LinFunc MEDIUM | seq14/page15 | class=broken_question | sev=Crítica | current: "The function f is defined by , where m and b are constants. If and , what is the value of m?" | expected: `f(x)=mx+b`; `f(0)=18`, `f(1)=20` | action: restaurar definiciones. ans correcto.
- cmsjrnyx7022uqmt1gkvkpedj | LinFunc MEDIUM | seq16/page18 | class=broken_question | sev=Alta | current: "The equation above represents the speed y..." (ecuación ausente; aún respondible) | expected: `y = 18 − 5x` | action: insertar ecuación. ans correcto.
- cmsjrnyxd022zqmt1x8xmj8kb | LinFunc MEDIUM | seq17/page19 | class=image_missing | sev=Crítica | current: "the table shows four values of x and their corresponding values of g(x)... value of b?" tabla ausente, imageUrl null | expected: tabla x/g(x): 1→54, 2→51, 3→48, 4→45 (b=57) | action: adjuntar/transcribir tabla. ans correcto.
- cmsjrnyxn0231qmt1u8uip15r | LinFunc MEDIUM | seq19/page21 | class=image_missing | sev=Crítica | current: título "Energy per Gram of Typical Macronutrients" pero tabla ausente, imageUrl null | expected: tabla Protein 4.0/16.7, Fat 9.0/37.7, Carb 4.0/16.7 (k=4.2x) | action: adjuntar/transcribir tabla. ans correcto.
- cmsjrnyxr0232qmt1fwcsyt5e | LinFunc MEDIUM | seq20/page22 | class=broken_question | sev=Crítica | current: "The function is defined by . What is the -coordinate of the -intercept...?" (función perdida) | expected: `f(x) = −9x + 9` | action: restaurar la función. ans correcto.
- cmsjrnyxz0234qmt16q0dxub9 | LinFunc MEDIUM | seq22/page24 | class=broken_question | sev=Crítica | current: "A company's total cost , in dollars, to produce x shirts is given by the function above, where m is a constant and ." | expected: `c(x) = mx + 500`, x>0 (+500 esencial p/ 3500) | action: restaurar c(x)=mx+500 y x>0. ans correcto.

sin incidencias: seq2, 7, 8, 9, 11, 15, 18, 21 (seq2/7/11/15 fueron falsos positivos de figure_ref_no_image). Claves: 21/22 OK, solo seq1 mal.

### Algebra - Linear Equations in Two Variables - HARD (setId=cmsjrolig067dqmt11l08grw7, nQ=21)
- cmsjrnzgy02bdqmt1rgy2w8oa | LinEq 2-Var HARD | seq1/page1 | class=image_missing | sev=Crítica | current: "The table shows two values of x…" sin tabla ni imageUrl | expected: tabla x/y: −18/−48, 7/52 | action: adjuntar/transcribir tabla. ans D correcto (172/7).
- cmsjrnzh102beqmt1511oyppa | LinEq 2-Var HARD | seq2/page2 | class=answer_key_wrong | sev=Alta | current: correctAnswer "1" | expected: 1.5 (ANS: 0.10x=0.15 → x=1.5) | action: corregir clave a "1.5|3/2". Decimal truncado a "1".
- cmsjrnzh802bgqmt14276i4fx | LinEq 2-Var HARD | seq4/page4 | class=broken_question | sev=Crítica | current: "The line with the equation is graphed…" (ecuación ausente) | expected: `(4/5)x + (1/3)y = 1` | action: insertar la ecuación.
- cmsjrnzh802bgqmt14276i4fx | LinEq 2-Var HARD | seq4/page4 | class=answer_key_wrong | sev=Alta | current: correctAnswer "1" | expected: 1.25|5/4 (ANS: "The correct answer is 1.25") | action: corregir clave. Decimal truncado a "1".
- cmsjrnzkm02bmqmt1q7r24a34 | LinEq 2-Var HARD | seq6/page6 | class=broken_question | sev=Crítica | current: "…won green tokens and red tokens worth a total of points. The given equation represents…" | expected: `5G + 45R = 380`, "G","R","380" | action: restaurar ecuación y variables. ans 40 correcto.
- cmsjrnzkp02bnqmt15jryorva | LinEq 2-Var HARD | seq7/page7 | class=image_missing | sev=Crítica | current: "Line is shown in the xy-plane. Line (not shown) is perpendicular…" imageUrl null | expected: gráfica de línea k por (−6,0) y (0,−5) (pendiente −5/6); etiquetas k,j perdidas | action: adjuntar gráfica y restaurar etiquetas. ans 1.2|6/5 correcto.
- cmsjrnzkv02boqmt1zcj0m9dc | LinEq 2-Var HARD | seq8/page8 | class=broken_question | sev=Media | current: "…what is the value of ?" (falta "k+n"; el token quedó como imageUrl 59dc29fb, no inline) | expected: "value of `k+n`" inline | action: inyectar "k+n" en el stem. ans 30 correcto.
- cmsjrnzkx02bpqmt16ubtjpy8 | LinEq 2-Var HARD | seq9/page9 | class=broken_question | sev=Crítica | current: "The graph of is translated down units…" | expected: `9x − 10y = 19`, down `4` | action: restaurar ecuación y "4". ans 59/9 correcto.
- cmsjrnzlb02buqmt14xwwo7l3 | LinEq 2-Var HARD | seq12/page12 | class=answer_key_wrong | sev=Alta | current: correctAnswer "1" | expected: 1.5|3/2 (ANS: "The correct answer is 1.5"; 16 claveles=$24 → $1.50) | action: corregir clave. Decimal truncado a "1". (imageUrl del scatter OK)
- cmsjrnzlr02c1qmt1dppthhen | LinEq 2-Var HARD | seq15/page15 | class=broken_question | sev=Crítica | current: "line passes through the point and is parallel to the line represented by the equation. If line also passes through the point, what is the value of?" | expected: puntos (0,0),(3,d); eqn `y=8x+2` | action: restaurar puntos y ecuación. ans 24 correcto.
- cmsjrnzlv02c2qmt1g7pxwy7t | LinEq 2-Var HARD | seq16/page16 | class=broken_question | sev=Crítica | current: "line has a slope of and an x-intercept of. What is the y-coordinate of the y-intercept…" | expected: slope `−5/3`, x-int `(−6,0)` | action: restaurar valores. ans −10 correcto.
- cmsjrnzly02c3qmt1kon4ux33 | LinEq 2-Var HARD | seq17/page17 | class=broken_question | sev=Crítica | current: "intersects the y-axis at the point and passes through the point. If the point lies on line k…" | expected: puntos `(0,−6)`,`(2,2)`,`(20,w)` | action: restaurar puntos. ans 74 correcto.
- cmsjrnzm102c4qmt1gvukqkgf | LinEq 2-Var HARD | seq18/page18 | class=broken_question | sev=Crítica | current: "Line is defined by. Line is perpendicular to line…What is the slope of line?" | expected: eqn `4y + 8x = 6`; etiquetas p,r | action: restaurar ecuación. ans 1/2|0.5 correcto.
- cmsjrnzm402c5qmt13rx4n5ax | LinEq 2-Var HARD | seq19/page19 | class=image_missing | sev=Crítica | current: "the table shows three values of x and their corresponding values of y." sin tabla, imageUrl null | expected: tabla x/y: 18/130, 23/160, 26/178 | action: adjuntar/transcribir tabla. ans D (−17/6,0) correcto.

Falsos positivos figure_ref_no_image (inline/imagen presente, sin defecto): seq11 (`7x+2y=−31`), seq13 (opciones-imagen presentes y correctas, ans C), seq20 (`ax+ky=6` con puntos inline), seq21 (tabla en markdown inline).
sin incidencias: seq3, seq5 (img gráfica OK, ans B), seq10, seq11, seq13, seq14 (img gráfica OK, ans A), seq20, seq21.

### Algebra - Linear Equations in Two Variables - MEDIUM (setId=cmsjrolkk067fqmt1zhtgoak9, nQ=26)
- cmsjrnyhk01xhqmt1vl19jojd | LinEq 2-Var MED | seq1/page1 | class=broken_question | sev=Crítica | current: "Line is defined by. Line is perpendicular to line…What is the slope of line?" | expected: eqn `y = −(17/3)x + 5`; etiquetas k,j | action: restaurar ecuación. ans 3/17 correcto.
- cmsjrnyhp01xiqmt1aw1ztg4p | LinEq 2-Var MED | seq2/page2 | class=broken_question | sev=Crítica | current: stem sin `(8,10)`, `36 m`, ni etiquetas x/y; opciones A-D con los valores en metros perdidos ("The length is , and the width is .") | expected: punto (8,10), perímetro 36 m; A "10/8 menos que perím", B "10/8", C "8/10", D "8/10 menos que perím" | action: restaurar stem y valores de las 4 opciones (además imageUrl null: adjuntar la gráfica (0,18)-(18,0)). ans C correcto.
- cmsjrnyhu01xnqmt1dkf5z42i | LinEq 2-Var MED | seq3/page3 | class=broken_question | sev=Crítica | current: "…cost a total of , … The given equation represents…" | expected: eqn `24.5x + 24.75y = 641`, total `$641` | action: restaurar ecuación y total. ans 0.25|1/4 correcto.
- cmsjrnyhx01xoqmt153zfn5yh | LinEq 2-Var MED | seq4/page4 | class=broken_question | sev=Crítica | current: "The equation represents the number of blue tiles, , and green tiles, ,…-square-inch…needs blue tiles…" | expected: eqn `7g + 7b = 840`, `840`-sq-inch, `71` blue tiles | action: restaurar ecuación y números. ans 49 correcto.
- cmsjrnyic01xsqmt1akw6zrud | LinEq 2-Var MED | seq8/page8 | class=broken_question | sev=Alta | current: "…for the remaining y hours. If , what is the value of y?" (condición ausente) | expected: `x = 1` | action: insertar "x=1". ans 3 correcto.
- cmsjrnyig01xtqmt17w0tdh36 | LinEq 2-Var MED | seq9/page9 | class=image_missing | sev=Crítica | current: "The table shows three values of x…" tabla ausente, imageUrl null | expected: tabla x/y: 1/11, 2/16, 3/21 | action: adjuntar/transcribir tabla. ans A correcto.
- cmsjrnyik01xuqmt10g7pzpu4 | LinEq 2-Var MED | seq10/page10 | class=image_missing | sev=Crítica | current: "The table shows four values of x…" tabla ausente, imageUrl null | expected: tabla x/y: −6/65, −3/56, 3/38, 6/29 | action: adjuntar/transcribir tabla. ans A correcto.
- cmsjrnyj001y1qmt16gja3p9k | LinEq 2-Var MED | seq13/page13 | class=broken_question | sev=Crítica | current: "Lily made cups of jam. Lily then filled small containers and large containers…The equation represents…interpretation of in this context?" | expected: `36` cups, eqn `4x + 6y = 36`, término `6y` | action: restaurar. ans C correcto.
- cmsjrnyjq01yfqmt1mx9gz4bx | LinEq 2-Var MED | seq19/page19 | class=broken_question | sev=Alta | current: stem `y = (5π/13) − 23` (constante, pendiente 0) | expected: `y = (5x/13) − 23` (la "x" fue mal-OCR como "π") | action: corregir "π"→"x". ans 5/13 correcto.
- cmsjrnyjt01ygqmt11o9mmtpw | LinEq 2-Var MED | seq20/page20 | class=broken_question | sev=Crítica | current: stem sin `63`, eqn ni etiquetas; opciones A-D con "6" perdido ("Each side of figure B has a length of inches.") | expected: perím `63`, eqn `3x + 6y = 63`, coef `6` en opciones | action: restaurar stem y valor "6" de las 4 opciones. ans A correcto.
- cmsjrnyjx01ylqmt1rqsenzra | LinEq 2-Var MED | seq21/page21 | class=image_missing | sev=Crítica | current: "The table shows three values of x…where n is a constant…" tabla ausente, imageUrl null | expected: tabla x/y: −6/(n+184), −3/(n+92), 0/n | action: adjuntar/transcribir tabla. ans A (−92/3) correcto.
- cmsjrnyk101ymqmt137ykwbgt | LinEq 2-Var MED | seq22/page22 | class=broken_question | sev=Crítica | current: "…a -hectare park and a -hectare residential area. The total number of trees is. The equation represents…" | expected: `2`-ha, `35`-ha, `3,934` trees, eqn `2x + 35y = 3,934` | action: restaurar. ans A correcto.
- cmsjrnym501ytqmt1293q2zuv | LinEq 2-Var MED | seq25/page25 | class=broken_question | sev=Crítica | current: "…has a slope of and passes through the point. The equation defines the line, where and are constants. What is the value of?" | expected: slope `9`, punto `(0,−5)`, eqn `y = px + r`, pide `p` | action: restaurar. ans 9 correcto.
- cmsjrnymm01yuqmt1k6h2o9n3 | LinEq 2-Var MED | seq26/page26 | class=image_missing | sev=Crítica | current: gráfica ausente (imageUrl null); además etiqueta de eje "Number of sweatshirts" filtrada al inicio del stem | expected: gráfica por (0,35) y (90,0) | action: adjuntar gráfica y quitar la etiqueta filtrada (stimulus_ui_leak, Baja). ans B (7x+18y=630) correcto.

sin incidencias: seq5, seq6, seq7, seq11, seq12 (img gráfica y=−x−8 OK, ans C), seq14, seq15 (img tabla OK, ans C), seq16, seq17, seq18, seq23, seq24. Claves de estas verificadas correctas.

### Algebra - Systems of Two Linear Equations - MEDIUM (setId=cmsjromcs067vqmt16g57edj4, nQ=17)
- cmsjrnypx0213qmt1wvpd8dbq | Systems 2-Lin MED | seq3/page3 | class=image_missing | sev=Crítica | current: "…same solution as the system of equations graphed above?" imageUrl null | expected: gráfica de dos rectas que se cortan en (3/2, 0) | action: adjuntar gráfica. ans A correcto.
- cmsjrnypx0213qmt1wvpd8dbq | Systems 2-Lin MED | seq3/page3 | class=stem_option_leak | sev=Media | current: "y=0" (1ª ecuación de la opción A) quedó pegada al final del stem y las opciones quedaron desalineadas | expected: A={y=0, x=3/2}, B={y=3/2, x=0}, C={y=0, x=1}, D={y=1, x=0} | action: reagrupar cada opción como sistema de 2 ecuaciones.
- cmsjrnyqc021cqmt1lnk719ck | Systems 2-Lin MED | seq6/page6 | class=broken_question | sev=Crítica | current: "One of the two equations…is given." pero la ecuación dada está ausente | expected: `y = (2/7)x + 3` | action: insertar la ecuación dada. ans D (b=3) correcto.
- cmsjrnyrr021hqmt15w3ssr3g | Systems 2-Lin MED | seq11/page11 | class=broken_question | sev=Crítica | current: "…the graph of intersects the graph of at the point. What is the value of a?" | expected: `y = x + 3`, `y = 2x − 6`, punto `(a,b)` | action: restaurar ecuaciones y punto. ans C (9) correcto.
- cmsjrnyrx021mqmt1r2rvlh2s | Systems 2-Lin MED | seq12/page12 | class=broken_question | sev=Crítica | current: "If the system of equations above has solution, what is the value of?" (ecuaciones y objetivo ausentes) | expected: `4x + 5y = 100`, `5x + 4y = 62`, solución `(x,y)`, pide `x+y` | action: restaurar ecuaciones y objetivo. ans C (18) correcto.

Falso positivo: seq13 (opciones-imagen 6af4/44051/7f9c86/520de9 presentes y correctamente asignadas; verificada la C, ans C).
sin incidencias: seq1, seq2, seq4, seq5, seq7, seq8, seq9, seq10, seq13, seq14, seq15, seq16, seq17. Claves de estas verificadas correctas.
