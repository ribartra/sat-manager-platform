# Estrategias agénticas de recuperación y completado de contenido (ingesta → oficial)

> **Estado (2026-08-10).** Documento de método, no de estado. Registra *cómo* se está completando el
> contenido de los mock tests (Test 1, 8, 10 hechos por esta vía) recuperando enunciados, estímulos,
> opciones, respuestas, explicaciones e imágenes que la OCR dejó incompletos, y promoviéndolo al
> contenido oficial. El estado por-test vive en las notas de memoria (`test8/10-completion-progress`) y
> en `docs/INGEST_PROMOCION_ESTADO.md` / `docs/rw-stimulus-recovery.md` /
> **`docs/procesamientos-ingest.md`** (inventario global de campañas aplicadas).

## Por qué hace falta una estrategia (y no un solo script)

La ingesta con Mistral OCR es fiel al texto corrido pero pierde sistemáticamente lo que no es texto
plano:

- **Las alternativas MC se renderizan como imagen** (captura por-pregunta), no como texto → la promoción
  crea 4 `QuestionOption` con `text` vacío. El alumno ve radios en blanco. Magnitud del corpus: ~397 MC
  promovidas sin opciones (169 Math / 228 R&W).
- **Los grids numéricos y las tablas** los lee como `[tbl-0.html]` (referencia a HTML, sin datos), no
  como valores → `parse-option-image` devuelve 0 opciones.
- **Los pasajes R&W** quedan mal agrupados entre bloques de página, o el test se promovió desde el docx
  de *explicaciones* (sin pasaje) → `stimulus` vacío.
- **Las respuestas y tipos** a veces son basura o el tipo está mal (NUMERIC-con-letra que en realidad es
  MC).
- **Las figuras** (gráficas, histogramas) o no se enlazan a la pregunta, o el `img-ref` del candidato
  apunta a la figura y no a las opciones.

Ningún parser único resuelve esto porque cada defecto necesita una fuente distinta y una validación
distinta. La estrategia es un **bucle agéntico por test**: diagnosticar → recuperar de la fuente correcta
→ validar → escribir WAL-safe → promover. Lo que sigue son los patrones reutilizables de ese bucle.

---

## Restricciones de operación (invariantes — nunca romper)

Estas gobiernan cada escritura; no son negociables.

1. **WAL-safe (integridad de `dev.db`).** `dev.db` está en modo WAL. Cualquier escritura o checkpoint
   externo (better-sqlite3 fuera de la app) mientras el server Next está vivo corrompe la base
   (`database disk image is malformed`). Reglas:
   - Lecturas de solo-lectura con los servicios arriba: **seguras**.
   - Escrituras vía HTTP a través de la app/servicios: **seguras**.
   - Escritura externa: `docker compose stop web` (dejar **ingest arriba** por DNS) → escribir con un
     one-off `docker compose run --rm --no-deps -T -e MODE=APPLY web node /app/scratchpad/_tmp/…` →
     `wal_checkpoint(TRUNCATE)` en una sola conexión → `integrity_check` == `ok` → `docker compose start web`.
   - Antes de commitear `dev.db`: web parado → checkpoint TRUNCATE de una conexión → `integrity_check ok`
     → commit.
2. **Gotcha de DNS de Docker.** `stop/start` de **ambos** (web+ingest) rompe el DNS embebido web→ingest.
   Por eso solo se para `web`. Verificar con `getent hosts ingest-service` tras reiniciar.
3. **Nunca escribir una clave/opción que no se pueda validar.** Se recupera de la fuente; **no se
   adivina**.
4. **Nunca dejar en blanco una respuesta/opción posiblemente válida** (guard en cada apply).
5. **FastAPI corre código *baked* en `/service`.** Editar `ingest_service/app/main.py` exige rebuild;
   un proceso uvicorn con código stale en memoria da 404/None aunque el archivo en disco esté bien.
6. **`scratchpad/` NO está en `.gitignore`.** Los scripts de trabajo van a `scratchpad/_tmp/` (que sí se
   ejecuta dentro del contenedor por la ruta `/app/scratchpad/_tmp/…`; `$CLAUDE_JOB_DIR/tmp` **no** está
   montado). Nunca `git add` de scratchpad ni del lock `.~lock…docx#`.
7. **Commit/push solo cuando el usuario lo pide.**

---

## Patrón 0 — Diagnóstico empírico antes de "arreglar"

Ante un síntoma de UI ("veo Extracted Tests verdes que también dicen needs review"), primero se **comprueba con
datos** si es bug de query o contenido real, en vez de asumir. Concretamente: contar cuántas filas están
"verde pero marcadas" (fue 0 → no había bug de query) y correr `npm run reconcile:promoted` (dio 0 → no
había ediciones sin propagar). Conclusión: las banderas eran **huecos de contenido reales**, y la causa
perceptual era una barra casi-verde que ocultaba un segmento rojo diminuto. Arreglo real: ancho mínimo por
segmento + franja de peor-estado en la barra de completitud (`sets-client.tsx`, `extracted-test-rail.tsx`).

**Regla:** cuantificar el síntoma primero; el arreglo se decide por lo que muestran los datos, no por la
primera hipótesis.

---

## Patrón 1 — Respuestas, tipos y explicaciones desde el docx de explicaciones

Fuente autoritativa: `TestN_{Math|RW}_Answer_Explanations.docx`. Se parsea con python-docx recorriendo
`d.element.body` **en orden** (párrafos y tablas intercalados):

- `MODULE n` fija el módulo; `Question N:` / `QN.` / `Q1.` abre la pregunta (el marcador varía por test —
  Test 10 usa `Q1.`, por eso el regex es `(?:Question\s+|Q)(\d+)\s*[:.]?`).
- En la celda de tabla: `✓ Correct Answer: X` + el texto de `Solution` / `Choice X is correct`.
- La respuesta es **letra → MC**, **numérica → NUMERIC**: esto **también corrige el `type`** mal
  etiquetado.

**Validación obligatoria:** contrastar las respuestas parseadas contra las ya existentes en el candidato
u oficial. Si coinciden (p.ej. Test 10 Math 42/42, R&W 50/50) → limpio, no hay corrupción tipo Test 6
(donde el key traía un off-by-one y hubo que reconstruir). Si divergen → gana el docx, se sobrescribe.

**Gotcha de mapeo de módulo:** las etiquetas de módulo del candidato no siempre igualan al docx. Test 8
Math necesitaba remap `2B→2`; Test 10 Math usa `2B` tal cual (sin remap). Siempre revalidar el conteo de
matches tras fijar el mapa.

Script reutilizable: `scratchpad/_tmp/parse_expl.py` (throwaway).

---

## Patrón 2 — Opciones MC desde imagen: OCR primero, transcripción visual + validación después

1. **Localizar** la imagen de opciones: parsear `![img-N.jpeg]` del `rawJson.text` del candidato; casar
   `IngestImageArtifact` por `(sourceFileId, pageNumber, imageId)` con `base64Data`. Ojo: una imagen puede
   apilar **dos bloques** de opciones (tall ~245×430) → la pregunta vecina *sin* img-ref toma el bloque de
   abajo.
2. **Intentar OCR automático** (`/candidates/{id}/parse-option-image`, ingest-service directo, Bearer
   `INTERNAL_INGEST_TOKEN`, puerto 8000 solo dentro del contenedor). Escribe `type=MC`+`optionsJson` **solo
   si** parsea 4 filas A–D. Rendimiento real: ~2–4 de cada 23 (falla en grids numéricos → tabla).
3. **Transcripción visual** para el resto: ver la imagen de opciones / renderizar la página del PDF y
   transcribir A–D a mano.
4. **Validar cada set** contra la respuesta ya recuperada (letra correcta) y contra la matemática cuando
   se puede (p.ej. 1:1 C=$15/h ✓; 2B:7 C=240 ✓). Convenciones: matemática como `$…$` KaTeX; números/%
   /texto tal cual; `$` literal sin escapar para coincidir con el enunciado.

Cuando el `img-ref` apunta a una **figura** (gráfica) y no a las opciones, se renderiza la página para leer
las opciones y la figura se enlaza aparte (Patrón 3).

Ver [`docs/rw-stimulus-recovery.md`](rw-stimulus-recovery.md) para la variante R&W y la nota de memoria
`mc-option-image-recovery`.

---

## Patrón 3 — Figuras: enlazar o materializar

- **Enlazar** (`IngestCandidateImageLink` STEM / oficial `Question.imageUrl`) cuando la figura ya está como
  `IngestImageArtifact`.
- **Materializar** cuando la figura solo vive como base64/fileUrl: copiar a
  `public/uploads/questions/{sha256[:24]}.jpg` y fijar `Question.imageUrl` (mismo path que
  `materializeOfficialImageUrl` de la promoción). Ej.: histograma de Test 10 2B:11.
- **Tablas** que la OCR dejó como `[tbl-0.html]` sin datos → transcribir desde la página renderizada e
  **incrustarlas inline en el enunciado** (ej. Test 10 1:21, Test 8 1:6 y 2:18).

---

## Patrón 4 — Estímulo (pasaje) R&W por transcripción visual

Los pasajes están en el texto OCR pero mal agrupados; la heurística de "carry" (arrastrar el pasaje al
vecino) demostró ser **poco fiable** (mis-asignó preguntas en Test 8). Método elegido por el usuario:
**transcribir visualmente** desde el PDF de preguntas R&W (`INNOVATORS TEST 10 RW 1, 2B.pdf`, etc.),
escribiendo candidato `stimulus`=pasaje y `stem`=prompt por separado.

**Regla crítica:** no fijar `stem`=prompt hasta capturar el `stimulus`, o se pierde el pasaje (el candidato
guarda pasaje+prompt mezclados en `stem`). Casos borde detectados: candidatos que nunca se ingirieron
(el docx tiene 54, la DB 52 → crear M2B#1/#2 desde el PDF) y candidatos sin `stem` (M2B#12 → recuperar
prompt del PDF).

---

## Patrón 5 — Herramienta de recorte de página (crop-region) y su bug de fallback

Para asignar/OCR-ear una región de página está `POST /candidates/{id}/crop-region` (Next proxya a
ingest-service, que renderiza con `render_pdf_page_jpeg` = pdfplumber `to_image`). Modos: `ASSIGN` (crea
link imagen→STEM/OPTION/…) u `OCR` (devuelve texto). Todo queda en `AuditLog`
(`AI_IMPORT_CROP_ASSIGN`/`_OCR`).

**Bug root-caused:** "hay imágenes extraídas que no aparecen al recortar región". Causa: el endpoint de
render devolvía 404 por un **proceso uvicorn con código stale en memoria** (el `render_pdf_page_jpeg` en
disco funcionaba). El route cae entonces a `extractedPageFallback()` (primer `IngestImageArtifact` de la
página) → solo se veía una imagen por página. Arreglo: `docker compose restart ingest-service` (ver
invariante #5). Verificado 200 en Math+R&W, DNS intacto.

---

## Patrón 6 — Escritura por fases (WAL-safe) y promoción que replica el route

La escritura se hace por **fases idempotentes** con un JSON de plan por fase (throwaway en
`scratchpad/_tmp/`), corridas WAL-safe (invariante #1). Guardas de cada apply:

- `correctAnswer`/`optionsJson`/`explanation` con `COALESCE` (nunca pisar un valor bueno con vacío).
- Opciones oficiales: solo si el oficial tiene <4 opciones con texto **y** no tiene opciones-imagen **y**
  yo tengo 4 validadas.
- Sincronizar candidato **y** oficial cuando la pregunta ya está promovida (los alumnos leen el oficial).

**Promoción sin usar el endpoint HTTP** (para lote controlado): un script tsx replica el route
`promote-questions` — `buildQuestionDraft` (con `stripMarkdownImageRefs`) + `validateQuestionPayload` +
`materializeOfficialImageUrl` + crear `Question`+`QuestionOption` + candidato `PROMOTED` + upsert
`IngestPromotionArtifact` — con `promotedById` = admin `cmqv7mobl0000pnt1xlrh7mqv`, filtrando por
`(testNumber, section, promotionStatus != PROMOTED)`. Corre WAL-safe.

---

## El bucle por test (playbook completo)

Para cada test / sección, en orden de mayor a menor automatizabilidad:

1. **Diagnóstico** (Patrón 0): qué está promovido, qué falta por campo. Validar que las respuestas
   promovidas coinciden con el docx (detectar corrupción temprano).
2. **Respuestas + tipos + explicaciones** desde el docx (Patrón 1) → candidato (y oficial si promovido).
3. **Opciones MC**: OCR automático → transcripción visual validada (Patrón 2).
4. **Figuras/tablas**: enlazar / materializar / incrustar (Patrón 3).
5. **Estímulos R&W**: transcripción visual (Patrón 4); crear candidatos faltantes; recuperar stems
   ausentes.
6. **Promoción** del remanente (Patrón 6).
7. **Verificación**: recuento final por sección (MC con 4 opc, NUMERIC, sin-explicación=0, con-imagen) +
   `integrity_check ok`; actualizar la nota de memoria de progreso del test.

Cada escritura es WAL-safe y auditada. El contenido oficial es lo que ven el `/sets` (vista de Extracted Tests)
y los alumnos, así que escribir directo al oficial promovido es suficiente; el candidato se sincroniza para
trazabilidad.

---

## Herramientas throwaway (`scratchpad/_tmp/`, no versionar)

| Script | Rol |
|--------|-----|
| `parse_expl.py` | Parser docx de explicaciones → respuestas/tipos/explicaciones (Patrón 1). |
| `parse-rw10.ts` | Opciones R&W desde texto + carry de estímulo (carry poco fiable — solo opciones). |
| `promote-mathN.ts` | Promoción replicando el route (Patrón 6). |
| `apply-tN*.mjs` | Appliers por fases: candidato + oficial, con guardas COALESCE (Patrón 6). |
| `tN-*-options.json`, `tN_*_expl.json` | Planes de datos validados (throwaway). |

## Notas de memoria relacionadas

`taxonomy-source-of-truth`, `devdb-wal-checkpoint-corruption`, `ingest-practice-candidate-repair`,
`answer-key-recovery`, `rw-stimulus-wrong-source`, `extracted-test-model`, `mc-option-image-recovery`,
`test6-math-refine-and-rw-typefix`, `test8-completion-progress`, `test10-completion-progress`.
