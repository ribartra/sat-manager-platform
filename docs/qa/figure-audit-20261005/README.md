# Auditoría de figuras, tablas y gráficas (2026-10-05)

**Pregunta:** ¿hay preguntas que mencionan una gráfica, tabla, esquema o figura sin imagen asociada? ¿Alguna limpieza de imágenes borró una figura legítima?

**Universo:** las 2.594 preguntas en uso (exámenes completos + practice sets no archivados). Todo se hizo en solo lectura; no se tocó ninguna base.

## Conclusión
1. **No hubo borrados indebidos.**
   - Desde el 14-09, 250 preguntas de producción perdieron su `imageUrl`: la limpieza legacy del 28-09, menos las restauraciones posteriores.
   - Las 250 imágenes se revisaron a ojo (montajes en `montages/`).
   - 196 son paneles de la UI de origen, con el botón azul "NEXT QUESTION"; el resto son cuadros de respuesta vacíos, capturas completas de R&W con solo texto o un recorte suelto (`k+n`).
   - La única gráfica real (Nonlinear equations MEDIUM #21) era **la misma imagen que la opción B** de su propia pregunta. Las 4 opciones tienen su gráfica, así que quitarla de la pregunta fue correcto, porque delataba la respuesta.
2. **Hay figuras que nunca llegaron a la pregunta:** 8 preguntas.
   - Son figuras **vectoriales** de los PDFs de práctica que la ingesta no extrajo. No es un borrado.
   - Existen en el PDF de origen y se pueden recortar.
3. **Hay tablas presentes pero mal presentadas:**
   - 45 están "aplanadas" (los datos están, pero en líneas sueltas sin columnas);
   - 3 están en markdown, que `MathContent` muestra con las barras `|` crudas.
4. **Paridad dev ↔ prod:** 4 preguntas (T3 M1 #17, T7 M1 #17, T7 M1 #18, T10 M1 #19) apuntan a archivos distintos con **contenido idéntico**. Las de prod, que están en GCS, son las canónicas. Hay que alinear dev.

## Método
| Paso | Fuente | Resultado |
|---|---|---|
| Escaneo de texto (`fig-scan.cjs`): graph, table, figure, diagram, chart, map, "shown/pictured", etc. en enunciado y pasaje, sin imagen en la pregunta ni en las opciones | `dev.db` | 201 candidatas, más 2 de un escaneo ampliado ("circle shown") |
| Clasificación manual con el texto completo de cada sospechosa | `dev.db` | `audit.json` (203 filas) |
| Historial de `imageUrl` (`image-history.cjs`) | backups de prod 09-14, 09-27 y 10-05 (`gs://sat-sol-gsc-backups-offsite/db/…`) | 421 → 280 → 302 con imagen; 250 perdidas |
| Revisión visual de las 250 imágenes perdidas | `gs://sat-sol-gsc-sat-data/media/questions/` | 0 borrados indebidos |
| Staging de ingesta (`IngestCandidateImageLink` → `IngestImageArtifact`) | `dev.db` + `gs://…-offsite/files/private/uploads/ingest/` | 21 con vínculos: 19 paneles de UI y 2 tablas reales de T8 (descritas en prosa en el enunciado) |
| Página de origen de cada figura faltante | `files_to_load/PRACTICE EXERCISES/…pdf` | las 8 figuras existen |

## Clasificación (`audit.json`)
| Clase | N | Qué es | Acción propuesta |
|---|---|---|---|
| `FALTA_VISUAL_ESENCIAL` | 3 | Sin la figura **no se puede resolver** | Recortar del PDF y asignar `imageUrl` |
| `FALTA_VISUAL_NO_ESENCIAL` | 5 | Se puede resolver con el texto, pero el enunciado dice "shown" | Recortar y asignar |
| `TABLA_APLANADA` | 45 | Los datos están, pero la tabla perdió su formato | Reconstruir como `\begin{array}` |
| `TABLA_MARKDOWN_CRUDA` | 3 | Tabla markdown que se muestra con las barras | Convertir a `\begin{array}` |
| `TABLA_EN_TEXTO_OK` | 26 | Tabla en LaTeX (`array`) o descrita en prosa | Nada; opcionalmente, imagen en T8 M1 #6 y M2 #18 |
| `FALSO_POSITIVO` | 121 | "figure" como persona u obra, "graph of y=…" con datos completos, "multiplication table", etc. | Nada |

### Figuras faltantes (8)
| Pregunta | Esencial | Página de origen |
|---|---|---|
| Geometry – Area and volume – MEDIUM #7 (rectángulos ABCD/QRST) | **Sí**: 12, 5 y 10 in solo en la figura | Area and Volume MED.pdf p.7 |
| Geometry – Lines, angles, and triangles – EASY #14 (triángulos ABC/XYZ) | **Sí**: 60° solo en la figura | Lines Angles Triangles EASY.pdf p.14 |
| PSDA – Ratios, rates… – MEDIUM #9 (vaso) | **Sí**: falta además "(1 gallon = 128 fluid ounces)" | Ratios Rates Proport. Units MED.pdf p.9 |
| Algebra – Linear functions – MEDIUM #15 (gráfica del electricista) | No | Linear Funct MED.pdf p.16 |
| Geometry – Lines, angles, and triangles – MEDIUM #11 (PQR/S) | No | Lines Angles Triangles MED.pdf p.11 |
| Geometry – Lines, angles, and triangles – MEDIUM #4 (CAE/CBD) | No | Lines Angles Triangles MED.pdf p.4 |
| Geometry – Circles – MEDIUM #8 (círculo M, N, P) | No | Circles MED.pdf p.8 |
| Geometry – Circles – HARD #6 (círculo A) | No | Circles HARD.pdf p.6 |

### Otros hallazgos
- **PSDA One-variable data EASY #12:** afirmaciones numeradas "1./2.", mientras las opciones dicen "I only / II only". Es el mismo defecto que ya se corrigió en Statistical Claims MEDIUM #3.
- **Command of Evidence HARD #29:** los superíndices del isótopo (¹⁵N/¹⁴N) salen como números sueltos ("15", "15 14") dentro del pasaje.

## Archivos
- `audit.json`: una fila por pregunta (id, ubicación, término, clase y nota con la fuente).
- `fig-scan.cjs`, `image-history.cjs`: scripts de solo lectura, reutilizables tras cada promoción.
- `montages/`:
  - imágenes quitadas con mención visual (17);
  - imágenes quitadas sin botón UI (54, página 1);
  - vínculos de staging (21);
  - páginas de origen de las figuras faltantes;
  - paridad dev/prod (4).
