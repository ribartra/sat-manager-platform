# Reading Practice Sets — consistencia estricta (2026-09-29)

Revisión de los **18 sets y 529 preguntas** de Reading (Information and Ideas y Craft and Structure). Completa la QA del 24-09 con las comprobaciones de las auditorías de Math PS (28-09) y FPT (29-09), la taxonomía tras el cambio de hoy y la paridad con producción.

Script de solo lectura: `scripts/qa/reading-ps-consistency.mjs`, con salida en `reading-consistency.json`. Fuentes: los PDF de ejercicio y los ANS de `files_to_load/PRACTICE EXERCISES/EXERCISES READING/`, unidos por "Question ID" (hex), y el OCR del ANS (`IngestPageArtifact.extractedText`) para el texto del rationale.

## Resultado
| Comprobación | Resultado |
|---|---|
| Orden dentro del set frente al PDF (por hex) | **529/529**, sin desplazamientos (todas tienen hex) |
| Clave frente al ANS | **529/529** |
| "Choice X is the best answer" del rationale oficial frente a la clave | **529/529**, tercera confirmación de las claves |
| Opciones letra a letra | sin permutaciones. Hubo 32 avisos, todos artefactos de pdftotext (cursivas como *Gidra*, el glifo "ọ", "piñata", páginas de Words in Context con varias preguntas), comprobados visualmente o con el texto de la página: 100 % coincidente |
| Pasajes (stimulus) | sin pasajes pegados de la vecina ni truncados. Los 10 avisos son los gráficos de Command of Evidence, cuyo texto de ejes se retiró a propósito el 24-09 porque va como imagen |
| Cross-Text Connections (Text 1 + Text 2) | 36/36 |
| Taxonomía y metadatos | los `topicId` y la dificultad coinciden con los del set; 0 duplicados; 529 PUBLISHED con 4 opciones; los nombres de set son `Dominio - Skill - NIVEL` con el dominio actual (Cross-Text ya en **Craft and Structure** y "Main Ideas and Details") |
| Marcadores filtrados (`[tbl-…]`, "■", UI, etiquetas) | 0 |
| **Explicaciones** | **15 defectuosas → corregidas** (ver abajo) |
| Paridad con producción (huella por pregunta: set, orden, stem, stimulus, opciones, clave, explicación, imagen, skill, dificultad, estado) | **529/529 idénticas** tras aplicar |

## Corregido en local y producción: 15 explicaciones
- **13 de Command of Evidence con gráfico:** EASY #21; HARD #1, #7, #8, #16 y #21; MEDIUM #2, #4, #15, #21, #22, #24 y #28. La "explicación" era **el propio enunciado, con el texto espejado de los ejes** ("hsif gnuoy", "rebmuN"…), tomado de la página del ANS; el alumno nunca veía el rationale. Se sustituyó por el rationale oficial del ANS (OCR de la página siguiente, con comillas tipográficas).
- **Main Ideas and Details HARD #5:** empezaba a media frase ("for such theoretical…") y acababa cortada ("…unatt"); se sustituyó por el rationale completo.
- **Main Ideas and Details HARD #17:** estaba vacía; se completó con el rationale.

Estos casos se escaparon a la QA del 24-09 porque aquel detector solo buscaba explicaciones que fueran un *prefijo* del rationale. Aquí se comparó el contenido en ambos sentidos.

**Aplicación:** `scripts/qa/reading-ps-consistency-fixes.json` (15 ops con guardas) con `scripts/qa/apply-math-alignment-fixes.cjs`. Resultado: 15/15 en local y en producción, integridad ok.
- **Backups:** `backups/devdb-pre-reading-consistency-*.bak` y `/db/backups/devdb-pre-reading-consistency-20260929.bak`.
- **Valores previos por fila:** `/db/backups/reading-consistency-rows-20260929.json`.

## Entorno local
En `public/uploads/questions` del entorno local faltaban **313 imágenes del banco**: los 23 gráficos de Reading y otras de Math y FPT, todas referenciadas por la base. Producción sí las tiene: las sirve con 200 y las tiene en disco y en GCS. Se descargaron de producción para que el entorno local vuelva a ser consistente. No hubo cambios de datos por esto.
