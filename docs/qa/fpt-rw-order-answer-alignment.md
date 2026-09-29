# FPT R&W — alineación orden ↔ enunciado ↔ respuesta (2026-09-29)

Auditoría de las **540 preguntas publicadas** de Reading & Writing de los 10 Full Practice Tests
(Módulo 1 + Módulo 2 × 27), con el mismo método que [FPT Math](./fpt-math-order-answer-alignment.md).
Cada posición *N* se contrastó con tres fuentes:

| Fuente | Cobertura |
|---|---|
| Candidato de ingesta (número, módulo, página) | 540/540 |
| ANS KEY (columna RW 1 / RW 2 difícil) | 432 (T2 y T8 no tienen ANS KEY; en T1 las 2 versiones son idénticas) |
| Answer Explanations RW | 486 (T4 no tiene) |

## Resultado
| Comprobación | Resultado |
|---|---|
| Número del candidato = posición; módulo correcto | **540/540** |
| Módulo 2 publicado = versión difícil (2B) | sí, en todos los tests (la clave coincide con la columna "hard") |
| Clave guardada vs fuentes | **539/540 correctas**; **1 clave errónea corregida** (T6 M2 #20) |
| Opciones | sin permutaciones; 4 con marcador `[tbl-0.html]` filtrado |
| Pasajes (stimulus) | 11 con el pasaje de la pregunta siguiente pegado; 5 sin su frase inicial; 1 sin su gráfica |

## Clave corregida
| Pregunta | Antes | Ahora | Evidencia |
|---|---|---|---|
| T6 M2 #20 `cmsjrnwhl015hqmt1rrn10fxa` | D ("sits") | **C ("sit")** | sujeto compuesto invertido ("array, system, **and** network") → plural. Coincide con el ANS KEY; la Explanation (origen de la D) razonaba mal y se reescribió |

Discrepancia de fuente sin cambio: en T6 M2 #18 el ANS KEY dice D, pero la clave guardada C es la correcta (aposición con coma), igual que la Explanation.

## Contenido corregido (22 ops, además de la clave)
- **Pasaje de la pregunta siguiente pegado al stimulus (11):** T2 M1 #3; T3 M1 #3, #6 y #8; T6 M1 #22; T6 M2 #16, #18, #20 y #24; T7 M2 #14; T10 M2 #8. Se recortó el texto a partir del pasaje vecino. En los 10 primeros la cola coincidía literalmente con el stimulus de N+1, y en T10 con su "Text 1/Text 2".
- **Frase inicial perdida (5)**, recuperada del OCR de la página fuente (`IngestPageArtifact.extractedText`):
  - T2 M1 #6, T3 M1 #2 y T3 M2 #8: línea "The following text is from…".
  - **T3 M2 #2:** faltaba la frase con el hueco (Min Jin Lee), así que la pregunta no se podía responder.
  - T5 M2 #23: frase inicial sobre la Comuna de París.
- **T5 M2 #14:** faltaba la **gráfica** ("uses data from the graph"). Se recortó de la página 30 de la fuente → `/uploads/questions/d98a7e4d6dc62cdc1367be8d.png` (GCS + disco; recorte en `fpt-image-restore/crops/T5-RW-M2-Q14-graph.png`).
- **T1 (4 preguntas):** la opción D terminaba con el marcador `[tbl-0.html](tbl-0.html)`; se quitó.

## Aplicación
**APLICADO 2026-09-29 en local y producción** con `scripts/qa/apply-math-alignment-fixes.cjs` (ahora admite también `stimulus` e `imageUrl`) y `scripts/qa/fpt-rw-alignment-fixes.json` (23 ops con guardas). Resultado: 23/23, integridad ok.
- **Backups:** `backups/devdb-pre-fptrw-align-*.bak` y `/db/backups/devdb-pre-fptrw-align-20260929.bak`.
- **Valores previos por fila:** `/db/backups/fptrw-align-rows-20260929.json`.

## Falsos positivos descartados
- **Avisos de opciones:** en T10 la Explanation da prosa en lugar del texto de la opción, y en otros tests cambia el estilo de las comillas.
- **Avisos de enunciado en T9:** el resumen es solo la etiqueta de dominio.

Scripts: `scripts/qa/fpt-rw/` (usa `lin.py` y `keys` como en `scripts/qa/fpt-math/`). Resultado por pregunta: `docs/qa/fpt-rw-alignment.json`.
