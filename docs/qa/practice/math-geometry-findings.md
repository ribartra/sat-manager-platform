# Content QA — MATH Practice Sets — Geometry and Trigonometry

- **Fecha:** 2026-09-22
- **Dominio:** Geometry and Trigonometry (Area and Volume, Circles, Lines/Angles/Triangles, Right Triangles and Trigonometry)
- **Alcance:** 12 practice sets · 142 preguntas
- **Método:** QA de contenido de solo lectura sobre preguntas MATH promovidas vs. PDFs fuente (ejercicio + ANS). Se comparó cada registro publicado (stem, opciones, imagen, clave) contra la página fuente renderizada y la página de respuestas. Dominio con muchos diagramas: se dio prioridad a defectos de imagen. Sospechosos priorizados: imágenes enlazadas como ANSWER_FIELD (posible crop del panel de respuesta en lugar de la figura) y referencias a figura sin imagen (imageUrl null). Renders cacheados en scratchpad; imágenes publicadas en `public/uploads/questions/`. Se verificaron claves en preguntas marcadas.
- **Clases de defecto:** ver `scratchpad/method.txt`. Severidad: answer_key_wrong=Alta; image_missing/broken_question/type_mismatch=Crítica/Alta; redundant_ui_image/image_incomplete/option_text_wrong/option_dup=Media; stem_number_leak/escaped_underscore/option_label_leak=Baja.

## Resumen de defectos

_(se completa al final)_

---

## Hallazgos por set

### Geometry and Trigonometry - Circles - EASY
`cmsjro0jq02o9qmt1622n8v5v | Circles EASY | seq2/p2 | class=image_missing | sev=Alta | current: imageUrl null; stem "…minor arc  ?" (arc label dropped) | expected: figure shows circle O with diameters AC⊥BD (right-angle mark at O → central ∠AOC=90°); este 90° solo aparece en la figura | action: adjuntar la figura del círculo y restaurar la etiqueta de arco "AC"; clave A(=9) correcta`
_(seq1, seq3 sin incidencias — seq3 fue falso positivo figure_ref: ecuación dada en el texto)_

### Geometry and Trigonometry - Circles - HARD
`cmsjro0yq02ulqmt13xhh5yaw | Circles HARD | seq12/p12 | class=image_missing | sev=Alta | current: imageUrl null | expected: figura muestra círculo O con A,B,C,D y ángulo central x°(=100) sobre arco ADC; el layout/cuál-arco solo está en la figura | action: adjuntar figura; clave B(=13π) correcta`
`cmsjro0z402uoqmt15f1z1kge | Circles HARD | seq15/p15 | class=image_missing | sev=Media | current: imageUrl null | expected: figura muestra círculo O con A,B (arriba) y C; el punto C se define SOLO en la figura (necesario para OC=radio=18) | action: adjuntar figura (borderline: ∠OAB=30 en texto, pero C indefinido sin figura); clave B(=12π) correcta`
_(seq4 y seq8 falsos positivos figure_ref: ecuaciones en el texto; seq3 clave "-52" verificada CORRECTA; resto sin incidencias)_

### Geometry and Trigonometry - Circles - MEDIUM
`cmsjro05i02h9qmt1nzk40o50 | Circles MEDIUM | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null | expected: figura muestra círculo unitario con T(-1,0),P(1,0) en eje x y Q,R arriba; el layout del diámetro (P,T opuestos) solo está en la figura | action: adjuntar figura; clave C(=2π/3) correcta`
`cmsjro05y02hhqmt1z27xhrx5 | Circles MEDIUM | seq7/p7 | class=broken_question | sev=Media | current: stem "…can be written as , where a is a constant" (expresión perdida) | expected: stem fuente "…can be written as aπ, where a is a constant" | action: restaurar "aπ" en el stem; sigue resoluble, clave 4 correcta`
_(seq1 y seq11 falsos positivos figure_ref: álgebra de completar cuadrados, sin figura; resto sin incidencias)_


### Geometry and Trigonometry - Area and Volume - EASY
`cmsjrnzxe02e1qmt1yeq5hv36 | Area and Volume EASY | seq2/p2 | class=broken_question | sev=Media | current: stem "The volume V of a right rectangular prism is ," (fórmula ℓwh y variable ℓ perdidas) | expected: "…is ℓwh, where ℓ is the length…" | action: restaurar "ℓwh"/"ℓ"; imagen del prisma (6/3/2 cm) OK; clave A(=36) correcta`
`cmsjrnzy802eoqmt1bzeg44vh | Area and Volume EASY | seq9/p9 | class=image_missing | sev=Alta | current: imageUrl null; stem cita "The table gives the perimeters…" pero SIN datos de la tabla | expected: tabla Perímetro TUV=50, XYZ=150 (esenciales) | action: adjuntar/transcribir la tabla; clave C(=18) correcta`
`cmsjrnzyh02eqqmt1gtwaiw2p | Area and Volume EASY | seq11/p11 | class=broken_question | sev=Alta | current: stem "length of  meters, a width of  meters, and a height of  meters" (las 3 dimensiones perdidas) | expected: length 11, width 8, height 10 | action: restaurar dimensiones 11/8/10; clave 880 correcta`
_(seq12 imagen (triángulos JKL/RST) OK, stem completo en BD "…perimeter of triangle RST?" — el corte visto en el dump era truncado a 300 chars, NO defecto; clave A(=324) correcta)_
_(seq1,3-8,10,12,13 sin incidencias)_

### Geometry and Trigonometry - Area and Volume - HARD
`cmsjro02502goqmt1bz8awepk | Area and Volume HARD | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null; stem "The three points shown define a circle…" | expected: figura con 3 puntos (2,6),(6,10),(6,2) — coordenadas solo en la gráfica | action: adjuntar la gráfica; clave 8 correcta (centro (6,6), r=4)`
`cmsjro02s02gzqmt1lek7ga7r | Area and Volume HARD | seq11/p11 | class=image_missing | sev=Alta | current: imageUrl null; stem "…triangle formed by connecting the three points shown" | expected: gráfica xy con 3 puntos (≈(-3,4),(5,3),(3,-3)) — coordenadas solo en la figura | action: adjuntar la gráfica; clave 24.5|49/2 correcta`
_(seq1-2,4-10,12-13 sin incidencias; seq10 es pregunta añadida vía ANSWER_KEY, stem completo OK)_

### Geometry and Trigonometry - Area and Volume - MEDIUM
`cmsjrnzq302cgqmt1s3y0hqw3 | Area and Volume MEDIUM | seq2/p2 | class=image_missing | sev=Alta | current: imageUrl null; stem "The glass pictured above…What is the value of k" — falta la fórmula del volumen | expected: figura del vaso con "Volume = 7πk³/48" (esencial para resolver) + dimensiones k, k/2 | action: adjuntar figura/fórmula; clave D(=10.11) correcta`
`cmsjrnzr802ctqmt1ufca9fsm | Area and Volume MEDIUM | seq11/p11 | class=broken_question | sev=Alta | current: stem "A right circular cylinder has a volume of . If the height…" (valor 45π perdido) | expected: "…a volume of 45π." | action: restaurar "45π"; clave A(=3) correcta`
`cmsjrnzrn02d0qmt1o13gwbqd | Area and Volume MEDIUM | seq13/p13 | class=image_missing | sev=Alta | current: imageUrl null; stem "The three points shown define a circle…" | expected: gráfica con puntos (4,8),(7,11),(7,5) — coordenadas solo en la figura | action: adjuntar la gráfica; clave B(=6) correcta`
_(seq1 imagen del cuadrado ABCD en ejes OK, clave C(=50) correcta; resto sin incidencias)_

### Geometry and Trigonometry - Lines, Angles, and Triangles - EASY
`cmsjro0rv02r8qmt1dhrrrgvz | Lines Angles Triangles EASY | seq2/p2 | class=broken_question | sev=Alta | current: stem "In the given triangle, and has a measure of . What is the value of x?" (perdido "AB=AC" y "67°") | expected: "…AB=AC and ∠ABC has a measure of 67°…" | action: restaurar valores; clave B(=46) correcta`
`cmsjro0ry02rdqmt1md0r8y80 | Lines Angles Triangles EASY | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null; stem "lines and m are parallel, , and . What is the value of x?" (perdido "ℓ", "y=20", "z=60") | expected: figura de 2 paralelas + transversal con x°,y°,z°; y=20,z=60 | action: adjuntar figura y restaurar valores; clave B(=100) correcta`
`cmsjro0sa02roqmt1acttd0gp | Lines Angles Triangles EASY | seq6/p6 | class=image_missing | sev=Alta | current: imageUrl null; stem cita "line ℓ intersects lines j and k" pero el ángulo 40° y las posiciones w/x/y/z solo están en la figura | expected: figura con w°,x°,40°,y°,z° | action: adjuntar figura; clave C(=y=40) correcta`
`cmsjro0se02rpqmt1p4tbrst9 | Lines Angles Triangles EASY | seq8/p8 | class=image_missing | sev=Alta | current: imageUrl null; stem "In the figure above, intersects at C. If , what is the value of y?" (perdido "AD/BE", "x=100"); ángulos 20°/40° solo en figura | expected: figura + "AD intersects BE at C. If x=100" | action: adjuntar figura y restaurar valores; clave C(=80) correcta`
`cmsjro0sm02rzqmt1l5ziigre | Lines Angles Triangles EASY | seq10/p10 | class=image_missing | sev=Alta | current: imageUrl null; stem "three lines intersect at point P. If and , what is the value of z?" (perdido "x=65","y=75") | expected: figura de 3 rectas por P con x°,y°,z°; x=65,y=75 | action: adjuntar figura y restaurar valores; clave C(=40) correcta`
`cmsjro0tj02smqmt1zsejxty0 | Lines Angles Triangles EASY | seq17/p17 | class=image_missing | sev=Alta | current: imageUrl null; stem "extends to point D. If the measure of is equal to the measure of, what is the value of x?" (perdido "AC","∠BAC","∠BCA"); 110° exterior solo en figura | expected: triángulo isósceles con 110° exterior en C | action: adjuntar figura y restaurar nombres; clave D(=40) correcta`
`cmsjro0ss02s4qmt1imesn9lx | Lines Angles Triangles EASY | seq11/p11 | class=broken_question | sev=Baja | current: stem "In the figure above, lines and k are parallel" (nombre de recta "ℓ" perdido) | expected: "lines ℓ and k are parallel" | action: restaurar "ℓ"; imagen (paralelas+64°) OK, resoluble; clave C(=116) correcta`
_(seq16 imageUrl=ANSWER_FIELD PERO el recorte SÍ contiene la figura correcta (t,j,k con x°,133°) → falso positivo, clave 47 correcta; seq1,5,9,13,15 imágenes STEM verificadas correctas; seq4,7,12,14 sin incidencias)_

### Geometry and Trigonometry - Lines, Angles, and Triangles - HARD
`cmsjrnzu102dqqmt1kmsxcyjc | Lines Angles Triangles HARD | seq7/p7 | class=answer_key_wrong | sev=Alta | current: correctAnswer="4" | expected: ANS PDF dice DC=4.5 (=9/2) por semejanza 6/8=DC/6 | action: corregir clave a "4.5|9/2"; imagen (triángulo con altura BD) es correcta (falso positivo ANSWER_FIELD)`
`cmsjrnztg02deqmt16wf22hxl | Lines Angles Triangles HARD | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null; stem "MQ y NR se cortan en P, NP=QP, MP=PR. ¿∠QMR?" | expected: los ángulos dados 70° (en Q) y 60° (en P) SOLO están en la figura | action: adjuntar figura; clave 30 correcta`
`cmsjrnzw402drqmt1aassoc9v | Lines Angles Triangles HARD | seq8/p8 | class=image_missing | sev=Alta | current: imageUrl null; stem "paralelas q,t cortadas por r,s. a=43,b=122, valor de w?" | expected: figura con posiciones de a°,b°,w° (imprescindible para ubicar los ángulos) | action: adjuntar figura; clave 101/2|50.5 correcta`
`cmsjrnzwt02dtqmt1yrh4beba | Lines Angles Triangles HARD | seq10/p10 | class=image_missing | sev=Alta | current: imageUrl null; stem "área de ABC entre 48 y 60, y entero, un valor de x?" | expected: figura de triángulo recto con base AD=5, DC=7, altura x, lado y — dimensiones solo en la figura | action: adjuntar figura; clave (rango) correcta`
`cmsjrnzt602dcqmt13e3s281r | Lines Angles Triangles HARD | seq1/p1 | class=image_missing | sev=Media | current: imageUrl null; config compleja (Q,R,S,T en PV; RU corta SX en W; X,U por debajo) | expected: figura que fija la disposición espacial de X,U,W (borderline: el texto describe casi todo, ángulos dados en texto) | action: adjuntar figura; stem completo (el corte del dump fue a 300 chars); clave 123 correcta`
_(seq2 y seq7 imágenes ANSWER_FIELD SÍ contienen la figura correcta → falsos positivos de crop; seq5,seq12 imágenes STEM correctas; seq4,6,9,11 sin incidencias; seq9 stem completo en BD)_

### Geometry and Trigonometry - Lines, Angles, and Triangles - MEDIUM
`cmsjro0cy02jzqmt1zpype2pb | Lines Angles Triangles MEDIUM | seq1/p1 | class=broken_question | sev=Alta | current: imageUrl null; stem "In the figure above, , , and are parallel. Points B and E lie on and, respectively. If , and , what is the length of, to the nearest tenth?" (perdidos nombres AF,BE,CD/AC,FD/ED y valores AB=9,BC=18.5,FE=8.5) | expected: valores y nombres completos + figura del trapecio | action: restaurar valores/nombres y adjuntar figura; clave B(=17.5) correcta`
`cmsjro0d602k5qmt1u7a75gbo | Lines Angles Triangles MEDIUM | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null; stem "Triangles ABC and DEF shown above. ratio BC/AB?" | expected: figura de 2 triángulos rectos (32° en A, 58° en D; ángulos rectos en C y F) — imprescindible para el cociente | action: adjuntar figura; clave B(=DF/DE) correcta`
`cmsjro0fj02k8qmt1eczjy0ll | Lines Angles Triangles MEDIUM | seq6/p6 | class=broken_question | sev=Alta | current: stem "In triangle , the measure of angle is and the measure of angle is . In triangle ,… similar to triangle?" (perdidos DEF/RST y valores 47°/97°) | expected: "∠D=47°,∠E=97°; ∠R=47°,∠S=97°…" | action: restaurar nombres/valores; clave D correcta`
`cmsjro0fj02k8qmt1eczjy0ll | Lines Angles Triangles MEDIUM | seq6/p6 | class=option_text_wrong | sev=Media | current: opciones A="The measure of angle", B="The measure of angle" (A≡B, etiqueta perdida), C="…and the measure of angle" | expected: A="…angle F", B="…angle T", C="…angle F and angle T" | action: restaurar etiquetas F/T en opciones A/B/C`
`cmsjro0g202kjqmt1a4az8l94 | Lines Angles Triangles MEDIUM | seq9/p9 | class=broken_question | sev=Alta | current: stem "Triangles and are congruent, where corresponds to, and and are right angles. The measure of angle is. What is the measure of angle?" (perdidos ABC/DEF, A/D, B/E, F y valor 69°) | expected: "…∠A=69°… measure of ∠F?" | action: restaurar nombres/valor; clave 21 correcta`
`cmsjro0g602kkqmt1eag573sw | Lines Angles Triangles MEDIUM | seq10/p10 | class=broken_question | sev=Media | current: stem "…relationship between side lengths is such that\n. If ∠BAC=20°, measure of ∠EDF?" (ecuación AB/DE=BC/EF=AC/DF=3 perdida) | expected: restaurar la ecuación de razones =3 | action: restaurar ecuación; sigue resoluble (∠EDF=∠BAC), clave 20 correcta`
_(seq4 stem completo (CAE~CBD, ∠CBD=57), figura no imprescindible → falso positivo figure_ref, clave C(=57) correcta; seq8 imagen (BD∥AE) correcta, clave B(=60); seq2,5,7,11 sin incidencias)_

### Geometry and Trigonometry - Right Triangles and Trigonometry - EASY
`cmsjro01e02gaqmt1cx19hzm6 | Right Triangles and Trig EASY | seq1/p1 | class=broken_question | sev=Alta | current: stem "…If cos B = 1/(2π), what is cos E?" (OCR: "22"→"2π") | expected: "cos B = 1/22" | action: corregir "2π"→22 en el stem; clave A(=1/22) correcta`
`cmsjro01e02gaqmt1cx19hzm6 | Right Triangles and Trig EASY | seq1/p1 | class=option_text_wrong | sev=Media | current: opciones A="1/(2π)", B="1/(2π)", C="2π/2π", D="2π/2π" (duplicadas/corruptas) | expected: A=1/22, B=1/23, C=21/22, D=22/23 | action: restaurar las 4 opciones reales`
`cmsjro01p02ggqmt1k54mow12 | Right Triangles and Trig EASY | seq3/p3 | class=image_missing | sev=Alta | current: imageUrl null; stem "In the right triangle shown, value of c closest?" | expected: triángulo recto con catetos 9 y 6 (c=hipotenusa) — valores solo en la figura | action: adjuntar figura; clave B(=10.8=√117) correcta`
_(seq2 imagen (sin x=63/73) correcta clave C; seq4 imagen (45-45-90, x=24) correcta clave A)_

### Geometry and Trigonometry - Right Triangles and Trigonometry - HARD
`cmsjro08y02jhqmt1chzy1btf | Right Triangles and Trig HARD | seq1/p1 | class=broken_question | sev=Alta | current: stem "…has a perimeter of . What is the length of the longest side?" (valor perdido) | expected: "…perimeter of 18 + 6√3." | action: restaurar "18+6√3"; clave 12 correcta`
`cmsjro0bw02juqmt19jbg94td | Right Triangles and Trig HARD | seq14/p14 | class=image_missing | sev=Alta | current: imageUrl null; stem "…logo shown in the figure above… combined area of the shaded regions?" | expected: figura del trapecio de 3 triángulos equiláteros con 2 sombreados (cuáles están sombreados solo se ve en la figura) | action: adjuntar figura; clave C(=8√3) correcta`
_(seq3,6,10,11,15,17: imágenes enlazadas como ANSWER_FIELD PERO todos los recortes SÍ contienen la figura geométrica correcta → FALSOS POSITIVOS de wrong-crop; claves 30/52-53/0/6/16-23/24 verificadas correctas; seq2,4,5,7,8,9,12,13,16 solo-texto sin incidencias)_

### Geometry and Trigonometry - Right Triangles and Trigonometry - MEDIUM
`cmsjro01a02g9qmt1zds7x4ms | Right Triangles and Trig MEDIUM | seq8/p8 | class=image_missing | sev=Media | current: imageUrl null; stem "Triangle XYZ shown is a right triangle. Which has same value as sin X?" | expected: figura de triángulo recto con el ángulo recto en Z (imprescindible para saber que X,Y son agudos → sin X=cos Y); borderline | action: adjuntar figura; clave D(=cos Y) correcta`
_(seq1 y seq3 imágenes ANSWER_FIELD SÍ contienen la figura correcta → falsos positivos, claves 4 y 45 correctas; seq4,5,7 imágenes STEM correctas (claves 6/A/20-21); seq2,6 solo-texto sin incidencias)_

---

## Resumen — 9 sets restantes de Geometry and Trigonometry (Area/Volume, Lines/Angles/Triangles, Right Triangles/Trig)

- **Sets revisados (9):** Area and Volume E/M/H; Lines, Angles and Triangles E/M/H; Right Triangles and Trigonometry E/M/H. (Circles E/M/H ya estaban hechos, no se tocaron.)
- **Total defectos: 32** en 30 preguntas.
- **Por clase:**
  - `image_missing` — 18 (figura/gráfica/tabla esencial ausente con imageUrl null; incluye coordenadas, ángulos dados solo en figura, tabla de perímetros, fórmula del vaso, regiones sombreadas)
  - `broken_question` — 11 (OCR dejó huecos en el stem: dimensiones/valores/fórmulas perdidos, p.ej. "45π", "18+6√3", dims 11/8/10, "AB=AC…67°", "22"→"2π")
  - `option_text_wrong` — 2 (opciones colapsadas a duplicados por OCR: Lines MED seq6 y Right Tri EASY seq1)
  - `answer_key_wrong` — 1 (Right Tri HARD seq7: clave "4" debe ser "4.5|9/2", confirmado en ANS PDF)
- **Claves verificadas:** todas las demás claves comprobadas coinciden con el ANS PDF / cálculo; único error de clave = Lines/Right-Tri HARD seq7.
- **Falsos positivos importantes (NO defecto):** TODAS las imágenes enlazadas como ANSWER_FIELD en este dominio (Lines HARD seq2/seq7; Right Tri HARD seq3/6/10/11/15/17; Right Tri MED seq1/seq3; Lines EASY seq16) resultaron ser recortes que SÍ contienen la figura geométrica correcta → no hay wrong-crop. Además, los cortes de stem a mitad de palabra vistos en el dump eran truncados a 300 chars del script, no defectos reales (verificado contra la BD: AV EASY seq12, Lines HARD seq1/seq9 tienen stem completo).
- **Nota de acción:** la mayoría de `image_missing`/`broken_question` provienen de que el OCR de promoción no capturó glifos matemáticos (fuente especial) ni adjuntó las figuras/gráficas de coordenadas; recuperables desde el PDF fuente (no requieren re-OCR de la figura salvo adjuntarla).
