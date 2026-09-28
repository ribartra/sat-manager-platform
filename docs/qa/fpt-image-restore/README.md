# FPT — coherencia enunciado ↔ imagen (restauración de figuras, 2026-09-28)

## Pregunta
Tras la auditoría visual del 2026-09-25 (commit `e7d7c1e`, 269 `imageUrl` → NULL en FPT), ¿se eliminó alguna
imagen que la pregunta necesitaba? ¿Qué preguntas FPT hablan de un gráfico/tabla/figura y no tienen imagen?

## Método
1. **Las 269 imágenes eliminadas**: URL antigua desde `backups/devdb-preapply-imgnull-20260925-092241.bak`;
   los archivos siguen en prod (HTTP 200). Descargadas e inspeccionadas **todas** en montajes rotulados.
2. **Fuente original**: los PDFs de `files_to_load/MOCK EXAMS/TEST N/MATH*/*.pdf` no tienen capa de texto; cada
   página embebe capturas completas por pregunta (panel izquierdo = enunciado + figura, derecho = respuestas).
   Extraídas con `pdfimages -png` (~44 por test) y revisadas **visualmente las 10 pruebas** (hojas de contacto),
   alineando captura ↔ pregunta (ajustes: T3 capturas 42–43 = preguntas extra de módulo alterno no presentes en
   la DB; T5 2–3 y T9 25–26 = una pregunta partida en dos capturas).
3. Cruce de cada captura con figura contra `Question.imageUrl` / `QuestionOption.imageUrl` en dev.db, más un
   barrido de palabras clave (graph, table, shown, scatterplot…) sobre las 980 preguntas FPT.

## Hallazgos
- **0 de las 269 imágenes eliminadas contenía una figura.** Todas eran el panel derecho del UI viejo (opciones,
  caja de respuesta numérica) o capturas R&W con texto ya presente. **La eliminación fue correcta.**
- El problema real es otro: **la figura (panel izquierdo) nunca se capturó en la ingesta** de esas preguntas.
- **22 preguntas FPT Math** muestran una figura en la fuente y no tenían imagen: 18 imprescindibles, 3
  referenciadas ("shown") pero resolubles con el texto, y **T6 M1 Q5** (tabla del dado — sin ella la pregunta es
  irresoluble) que el barrido de palabras clave no detectó. R&W: 0 casos.
- Tests 1, 5 y 10: sin faltantes (todas sus figuras ya tenían imagen).

## Acción aplicada (dev.db)
Recorte de la figura (solo la figura; el texto ya está en la DB) desde la captura fuente → `crops/<id>.png` →
`scripts/qa/apply-recovery-fixes.mjs` (spec `imageFile`, `specs/fpt-figures.json`), WAL-safe, con backup
`backups/devdb-preapply-fptfigures-20260928-084808.bak`. Resultado: 22/22, `integrity_check = ok`,
FPT con imagen 95 → 117. Detalle por pregunta en `applied.md`.

| Pregunta | id | captura fuente | caso | imageUrl nueva |
|---|---|---|---|---|
| T2 Math M1 Q9 | `cmsjrntdd0051qmt1fn2h436w` | i-004-008.png | imprescindible | `/uploads/questions/8c538fc07c99edd3649e54ce.png` |
| T2 Math M1 Q13 | `cmsjrnten005tqmt1ezjpso1b` | i-006-012.png | imprescindible | `/uploads/questions/11c9fc935c7491c960a96650.png` |
| T2 Math M1 Q22 | `cmsjrnth9006zqmt1bp2vnfpl` | i-010-021.png | imprescindible | `/uploads/questions/ef0e26753fca3e2fe3aa40eb.png` |
| T2 Math M2 Q5 | `cmsjrntc9004qqmt1k5l1svjy` | i-012-026.png | imprescindible | `/uploads/questions/c69f3c9434f3ebc38c4bb92d.png` |
| T2 Math M2 Q6 | `cmsjrntcl004sqmt1ohglwlql` | i-013-027.png | imprescindible | `/uploads/questions/8b4d68c13312f660519ed8f7.png` |
| T2 Math M2 Q20 | `cmsjrntgr006wqmt1u73v9xcp` | i-019-041.png | imprescindible | `/uploads/questions/c001a3801fe58aca949ec0e6.png` |
| T3 Math M1 Q14 | `cmsjrntvy00bzqmt1w6x7sigd` | i-005-013.png | imprescindible | `/uploads/questions/41bcb0687531bc162e1c0136.png` |
| T3 Math M1 Q22 | `cmsjrntxd00cgqmt1omxmx93a` | i-008-021.png | referenciada (resoluble con texto) | `/uploads/questions/bc36d905fc87ad55664f2552.png` |
| T3 Math M2 Q21 | `cmsjrnvck00soqmt1vn0qou8q` | i-016-044.png | imprescindible | `/uploads/questions/6477c045d2f7f1f26bc6d762.png` |
| T4 Math M1 Q12 | `cmsjrnv8600qwqmt13tbb16ds` | i-004-011.png | imprescindible | `/uploads/questions/eb646bc34d54b103ec958ccd.png` |
| T4 Math M1 Q16 | `cmsjrnv9i00rgqmt1fwndeqs6` | i-006-015.png | imprescindible | `/uploads/questions/e69b4b3d5429d6d3af2f3201.png` |
| T6 Math M1 Q5 | `cmsjrnvpu00xbqmt156zmd2xc` | i-002-004.png | **nueva** (no detectada por keywords) | `/uploads/questions/d68c224e32e056bc6e3d9c48.png` |
| T6 Math M1 Q13 | `cmsjrnvuh00xzqmt1pw9qt91q` | i-005-012.png | imprescindible | `/uploads/questions/68a00853f84fb34c704f2cd9.png` |
| T6 Math M1 Q21 | `cmsjrnvxg00yrqmt1xateifju` | i-008-020.png | imprescindible | `/uploads/questions/f2ffe78a9aad8fbfc70fa953.png` |
| T6 Math M2 Q2 | `cmsjrnvoe00x7qmt1c3n1ln3s` | i-010-023.png | imprescindible | `/uploads/questions/6ff1e435e8bbcb0fac03c958.png` |
| T6 Math M2 Q3 | `cmsjrnvpf00x9qmt1cl5jfhm8` | i-010-024.png | imprescindible | `/uploads/questions/54ff5103412bb0cf6744ca47.png` |
| T6 Math M2 Q8 | `cmsjrnvst00xqqmt167kc59z8` | i-012-029.png | imprescindible | `/uploads/questions/e681c6b6854a4e014161f2cb.png` |
| T7 Math M2 Q2 | `cmsjrnwuo01a8qmt11c9v1qtn` | i-010-023.png | imprescindible | `/uploads/questions/2290da2383e3152f865ac20d.png` |
| T8 Math M1 Q22 | `cmsnb3g2h00230mpdixue08j3` | i-009-021.png | imprescindible | `/uploads/questions/471b36ba09df5aae83ac6e9f.png` |
| T8 Math M2 Q7 | `cmsnb3g38002s0mpdwn9a43dy` | i-012-028.png | referenciada (resoluble con texto) | `/uploads/questions/1d939c804b2ee65e3b967574.png` |
| T8 Math M2 Q22 | `cmsnb3g4v004j0mpdk86h3pmn` | i-019-043.png | referenciada (resoluble con texto) | `/uploads/questions/eb6d93cfa99112e984e19347.png` |
| T9 Math M1 Q2 | `cmsjrnvyi00z1qmt1j1x9sal6` | i-001-001.png | imprescindible | `/uploads/questions/95cd77a8552eb10960249a07.png` |

## Sin acción (justificado)
Barrido posterior: 13 preguntas Math sin imagen siguen con alguna palabra clave, todas verificadas contra la fuente:
- **Tabla ya verbalizada en el enunciado** (datos completos, resoluble): T4 M2 Q2 `cmsjrnv3r00q5qmt1jckooeke`,
  T4 M2 Q16 `cmsjrnv9l00rhqmt1x67ft34i`, T8 M1 Q6 `cmsnb3fz8000f0mpdhil7l0kw`, T8 M2 Q18
  `cmsnb3g4e003z0mpd4udukjcd`, T10 M1 Q21 `cmsnffuzb00270mmxj89q3is6`. (Se podría añadir la tabla como imagen
  por fidelidad; no se hizo para no duplicar.)
- **Falsos positivos** ("the expression/system/list shown", "graph of line q is perpendicular to…" algebraico):
  T1 M2 Q14, T2 M2 Q21, T6 M1 Q8, T7 M1 Q21, T8 M1 Q19, T8 M2 Q10, T9 M2 Q13, T10 M1 Q9.
- T4 M2 Q9 (círculo en la fuente) no referencia la figura y se resuelve con el texto.

## Seguimiento aplicado (2026-09-28, dev.db + prod)
Specs en `followups/specs/text-fixes.json`, auditoría en `followups/applied.md`; backup local
`backups/devdb-preapply-fptfollowups-20260928-085738.bak`, backup de filas en prod
`/data/db/backups/fptfollowups-rows-backup-20260928.json`. Drift check previo 6/6; prod == local 6/6 después.
- **T3 Math M2 Q21** `cmsjrnvck00soqmt1vn0qou8q`: la **clave −21 es correcta** (clave oficial `ANS Key Test 3.docx`,
  MATH 2B "EXTRA 21. −21"; el "42" pertenece a otra pregunta). El borrador venía del propio
  `Test3 Math Answer Explan_.docx`; explicación reescrita (suma de raíces: b = −24·7/8 = −21).
- **Texto de UI colado** eliminado: T2 M2 Q3, T3 M1 Q2, T3 M1 Q11, T3 M1 Q13 (sufijo "➤/■ COME BACK LATER" en el
  enunciado) y T10 RW M1 Q15 (el pasaje empezaba con "advancements and for ➤ COME BACK LATER", cola de la respuesta
  de Q14; ahora empieza en "In 2021…"). Quedan 0 FPT con "COME BACK".
- Excel `docs/qa/preguntas-pendientes-consistencia.xlsx` (hoja Imágenes): las 22 filas marcadas "¿Necesita figura? = Sí" con la acción.

## Pendiente detectado (no tocado)
10 explicaciones más contienen borrador del autor ("Wait — …", "Hmm — key says…"; 1 falso positivo "wait for the bus"
excluido): `cmsjrntg7006kqmt10mtirx79`, `cmsjrnu8j00htqmt1iahai9w7`, `cmsjrnulh00joqmt1laiwfyta`,
`cmsjrnuve00n3qmt1y8ftlknw`, `cmsjrnv2800pdqmt16ka7tqk6`, `cmsjrnvaj00s0qmt17wksnibl`, `cmsjrnvw400y7qmt1r47em8md`,
`cmsjrnvzm00zsqmt1zrot3nj8`, `cmsjrnwpi018pqmt1yrd5m4an`, `cmsjrnwxx01bfqmt1dqsbjcuh`. Algunas cuestionan la clave
("Hmm — key says −1"), así que cada una requiere contrastar con la clave oficial antes de reescribir.

## Producción (aplicado 2026-09-28)
- **Drift check** (SSH, solo lectura, huella sha1 de stem/stimulus/clave/explicación/tipo/estado/opciones): 22/22
  idénticas a la baseline local; las 22 con `imageUrl` NULL en prod.
- **Push** (sin credenciales de admin; mismo patrón de UPDATE puntual en VM de pushes previos), replicando
  `putQuestionImage` (prod: `GCS_BUCKET=sat-sol-gsc-sat-data`, `GCS_DUAL_WRITE_DISK=true`):
  1. `gsutil cp` de las 22 PNG (mismo nombre sha256[:24] que en local) → `gs://sat-sol-gsc-sat-data/media/questions/` (613 → 635 objetos).
  2. Copia a `/app/public/uploads/questions/` del contenedor `sat-platform-web-1` (disco 613 → 635, paridad con GCS).
  3. Backup de las 22 filas → `/data/db/backups/imgpush-rows-backup-20260928.json`; UPDATE en una transacción
     (`imageUrl`, `updatedAt` ISO) con guarda `imageUrl IS NULL` → 22 filas.
- **Verificación**: `imageUrl` esperado 22/22 · resto del contenido sin cambios 22/22 · `https://satsol.org/uploads/questions/<name>`
  HTTP 200 22/22 · `quick_check = ok` · `/api/health` ok.
- **Rollback**: restaurar `imageUrl`/`updatedAt` desde el backup de filas (los archivos nuevos pueden quedarse).
