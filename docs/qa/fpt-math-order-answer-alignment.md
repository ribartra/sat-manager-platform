# FPT Math — alineación orden ↔ enunciado ↔ respuesta (2026-09-29)

Auditoría **solo lectura** de las **440 preguntas publicadas** de Math de los 10 Full Practice Tests
(10 tests × Módulo 1 + Módulo 2B × 22). Para cada posición *N* del módulo se comprobó, contra **tres
fuentes independientes**:

| Fuente | Qué aporta | Cobertura |
|---|---|---|
| Candidato de ingesta (`IngestQuestionCandidate`) | `questionNumber`, módulo y página del PDF de preguntas | 440/440 |
| ANS KEY (`TEST N/…ANS KEY.docx`, tabla por módulo) | clave por número | 352 (T2 y T8 no tienen ANS KEY) |
| Answer Explanations (`TestN_Math_Answer_Explanations.docx`) | "Question N: resumen" + "Correct Answer: **letra — valor**" + valores de las opciones incorrectas | 394 (T1 no tiene; T5 M2B #14 y T7 M2B #21 traen la ecuación como imagen) |

Cada pregunta tiene al menos una fuente de clave. En T1 las dos versiones del ANS KEY son idénticas, y en T4 las dos Explanations también.

## Resultado

| Comprobación | Resultado |
|---|---|
| **Orden:** número del candidato = posición en el módulo | **440/440 OK**, sin desplazamientos |
| **Módulo:** candidato 1 / 2B = módulo publicado | **440/440 OK** |
| **Clave vs ANS KEY** | 351/352 coinciden; la restante es un error de la fuente (ver abajo) |
| **Clave vs Explanations** | 391/394 coinciden; las 3 restantes son errores de la fuente (ver abajo) |
| **Opciones:** el valor de la Explanation para cada letra = el texto de esa opción | sin permutaciones; 3 preguntas con texto de opción defectuoso |
| **Enunciado:** coincidencia con el resumen de la Explanation | 2 enunciados con la variable mal leída por el OCR |

Hay **cero preguntas con la respuesta correcta mal asignada**. La clave guardada es la correcta en las 440 preguntas. En los 4 casos donde una fuente discrepaba, la verificación visual del PDF de preguntas dio la razón a la clave guardada.

## Discrepancias entre fuentes (clave guardada = correcta, verificado visualmente)

| Pregunta | Guardada | ANS KEY | Explanations | Verificación en el PDF |
|---|---|---|---|---|
| T3 M2B #19 `cmsjrnvc9` | A | A | B ✗ | f: vértice (3,8) → g: (5,5); derecha 2 y abajo 3 = **A** |
| T3 M2B #21 `cmsjrnvck` | −21 | A ✗ (EXTRA "21. −21" ✓) | 42 ✗ | b = −24·(−15/8 + 11/4) = **−21** |
| T9 M1 #21 `cmsjrnw88` | C | C | D ✗ | la gráfica corta en x = −5 y x = −1 → factor **(x+1)** |
| T4 M1 #7 `cmsjrnv4w` (opción D) | — | — | "−5x²y" ✗ | la fuente dice **−5x²y²**, igual que la base |

## Defectos de contenido encontrados (7 preguntas; claves correctas)

| Pregunta | Defecto | Corrección propuesta |
|---|---|---|
| T3 M2B #17 `cmsjrnvbl00sgqmt11s19j3if` | el OCR leyó la variable **g** como "9": `(3+√9)/3, what is g?` | `\sqrt{9}` → `\sqrt{g}` (clave 42 correcta) |
| T9 M2B #10 `cmsjrnw32010iqmt16sn1nt02` | la misma pregunta, con g leída como "2" | `\sqrt{2}` → `\sqrt{g}` (clave 42) |
| T3 M2B #19 `cmsjrnvc900siqmt1cesowz8n` | las opciones se copiaron de la Explanation: A y B describen ambas la respuesta correcta, y A dice "— same as B, but stated differently" | reescribir A–D según la fuente (A derecha/abajo, B izquierda/abajo, C derecha/arriba, D izquierda/arriba) |
| T7 M2B #7 `cmsjrnwvq01auqmt131k6z3ug` | la opción C perdió la `t` del exponente: `200(3)¹/⁷` | `y = 200(3)^{t/7}` |
| T3 M1 #1 `cmsjrntq2009hqmt1gwy03kdk` | artefacto "■" en la opción D, que es **la correcta** y queda delatada | `(4, 7)` |
| T10 M1 #8 `cmsnffux1000q0mmxic96gfpq` | artefacto "■" en la opción D | `116` |

En todo el banco solo hay estos 2 "■"; la fuente no los tiene.

**APLICADO 2026-09-29 en local y producción**: 9/9 ops de `scripts/qa/fpt-math-alignment-fixes.json` con `scripts/qa/apply-math-alignment-fixes.cjs`, ampliado con `stem` y `opt`. Integridad ok. Backups: `backups/devdb-pre-fptmath-align-*.bak` (local) y `/db/backups/devdb-pre-fptmath-align-20260929.bak` (producción), con los valores previos por fila en `/db/backups/fptmath-align-rows-20260929.json`.

## Falsos positivos descartados
- **Opciones (≈150 avisos iniciales):** diferencias de formato, como LaTeX `\frac`/`\leq`/`^{}` frente a unicode, grados o paráfrasis en prosa. Se normalizaron y quedaron en 0 salvo los casos de arriba.
- **Enunciado (19 avisos):** en T9 el "resumen" de la Explanation es solo una etiqueta de tema, como `[Percentages]`, y en T8 #3 es genérico. No son desplazamientos: la clave coincide en todos ellos.

## Reproducir
Ver `scripts/qa/fpt-math/README.md`. El resultado por pregunta está en `docs/qa/fpt-math-alignment.json`.
