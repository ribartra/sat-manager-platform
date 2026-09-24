# Informe de cobertura de promoción — universo de carga (`files_to_load/`)

- **Fecha:** 2026-09-24 · **read-only** (`dev.db` abierto `{readonly:true}`; sin cambios en DB ni producción).
- **Pregunta que responde:** ¿queda contenido en el universo de carga **sin promover**, y qué hacer con él?
- **Veredicto:** **el universo de carga está prácticamente 100% promovido; NO falta contenido real que recuperar.** Lo "no promovido" es exclusivamente ruido de staging (fragmentos y duplicados que el pipeline excluyó a propósito).
- **Alcance de acción (decisión del usuario):** **solo este informe.** No se aplicó higiene de staging, no se commiteó script de auditoría, no se tocó `dev.db` ni prod.

Complementa los índices de QA de contenido: [Math practice](README.md) · [Reading](reading-README.md) · [Writing](writing-README.md) · [Full Practice Tests](../README.md).

## Método y fuentes de verdad

- **`IngestSourceFile`** (231 filas) vs un walk de `files_to_load/` → qué se ingirió.
- **`IngestQuestionCandidate`** (`officialQuestionId`, `status`, `questionExternalId`) → qué se promovió y qué quedó suelto.
- **`Question` / `PracticeSet` / `FullPracticeTest`** → conteos oficiales.
- **PDFs `ANS`**: conteo de `Question ID: <hex>` (autoritativo del nº real de preguntas por fuente), cruzado contra `questionExternalId` para saber si un hex "faltante" en un set está en realidad promovido en otro.

Scripts read-only usados (scratchpad de sesión): `promo-gap.mjs`, `source-gap.mjs`, `coverage2.mjs`, `completeness.mjs`, `ans-complete.mjs`, `math-gap-verify.mjs`, `stragglers.mjs`, `test6-check.mjs`.

## 1. Ingesta de fuentes — 231/231

`files_to_load/` contiene exactamente **231** archivos (PDF/DOCX) e `IngestSourceFile` tiene **231** filas: **0 archivos sin ingerir**. Solo hay dos áreas de nivel superior: `PRACTICE EXERCISES/` y `MOCK EXAMS/`.

| Rol | Sección | Archivos |
|---|---|---|
| `PRACTICE_EXERCISE` (question source) | MATH / RW | 58 / 33 |
| `MOCK_EXAM` (question source) | MATH / RW | 10 / 10 |
| `ANSWER_KEY` / `ANSWER_EXPLANATION` (soporte, no generan preguntas) | MATH / RW / — | 63+10 / 33+10 / 4 |

**111 archivos-fuente de preguntas · 120 de soporte (claves/explicaciones) = 231.**

## 2. Promoción — 2597/2605 candidatos

**2605** candidatos → **2597** promovidos (= **2597 `Question`**, **91 `PracticeSet`**, **10 `FullPracticeTest`**). Solo **8 candidatos** sin promover (ver §4).

## 3. Completitud (nº real de preguntas en la fuente vs promovidas)

Usando el conteo de `Question ID` del `ANS` como verdad:

| Área | Fuente (Question-IDs) | Promovidas | ¿Completo? |
|---|---|---|---|
| **Reading practice** | 529 | 529 | ✅ |
| **Writing practice** | 259 (global por hex) | 259 | ✅ |
| **Math practice** | — | 827 | ✅ (ver nota) |
| **Full Practice Tests** | 10 × 98 | 980 (54 R&W + 44 Math por test) | ✅ |

**Nota Math:** los desajustes por-archivo (p.ej. `ANS One Var Data HARD` tiene 11 IDs pero el set HARD tiene 4; `ANS Two Var Data HARD` 8 vs 4) **no son preguntas ausentes**: los 11 y 8 hexes están **todos promovidos en algún set** del mismo topic (verificado por `questionExternalId`). Son **artefactos de scoping del `ANS`** (un archivo de respuestas que abarca varias dificultades). Del mismo modo, los ±1 por-set en Reading/Writing son mapeos imperfectos de `findAnsPdf` (Boundaries tiene 3 `ANS` HARD), no gaps — el conteo **global por hex** da 529/529 y 259/259 exactos.

## 4. Los 8 candidatos sin promover — ninguno es una pregunta real

| status | Sección / archivo | Qué es | Acción |
|---|---|---|---|
| NEEDS_REVIEW | MATH · Linear Funct MED | fragmento de explicación (`"Choice D is incorrect. Each game costs $25…"`) | ninguna (no-pregunta) |
| NEEDS_REVIEW | MATH · Linear Funct MED | fragmento de explicación (`"Choice D is incorrect and may result from conceptual errors."`) | ninguna (no-pregunta) |
| NEEDS_REVIEW | MATH · Data Distribut mean Hard | tabla suelta sin enunciado (`[tbl-0.html]`) | ninguna (no-pregunta) |
| READY | RW · Reading CE HARD | stem vacío; warning "answer key page" / "Fragmento sin…" | ninguna (fragmento; Reading ya 529/529) |
| REJECTED | MATH · Test 6 MOD 1,2B (qn4) | **duplicado** de la q8 promovida (mismo dataset "4.2, 6.3…") | ya rechazado |
| REJECTED | MATH · Test 6 MOD 1,2B (qn10) | limítrofe (media/mediana); Test 6 Math completo en 44 | ya rechazado |
| REJECTED | MATH · Non Linear Equations MED | fragmento de opción (`"C. D."`) | ya rechazado |
| REJECTED | MATH · Non Linear Functions EASY | stem vacío | ya rechazado |

Los 4 en limbo (3 `NEEDS_REVIEW` + 1 `READY`) son basura de segmentación de página. **Por decisión del usuario se dejan como están** (no se marcan `REJECTED`); no afectan al contenido publicado.

## 5. DOCX redundante

`MOCK EXAMS/TEST 1/Reading and Writing/ Test 1 Module 1, 2B R&W.docx` — status `COMPLETED`, **0 candidatos**. Es una fuente **superseded**: Test 1 R&W ya está completo (54 preguntas) desde otra fuente. Sin acción.

## Conclusión

Para el producto **no hay nada que recuperar del universo de carga**: todas las fuentes están ingeridas, todas las preguntas reales están promovidas, y los full tests están completos (980). El contenido "no promovido" se reduce a **8 fragmentos/duplicados** que el pipeline de ingesta descartó correctamente, más **1 DOCX superseded**.

**No aplicado (por alcance "solo el informe"):** higiene de staging (rechazar los 4 fragmentos en limbo), commit de un script de auditoría reutilizable, y la revisión puntual de Test 6 Math qn10. Todo ello queda disponible como trabajo opcional futuro; nada de ello corresponde a contenido faltante.
