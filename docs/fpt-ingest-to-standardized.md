# Flujo ingesta → Full Practice Test estandarizado

> **Estado (2026-08-12).** Cómo pasan los mocks de staging a un FPT SAT-shaped
> jugable (4 módulos, timers, break, pretest, score 200–800). Complementa
> [`sat-digital-estructura-vs-plataforma.md`](sat-digital-estructura-vs-plataforma.md)
> y el inventario en [`procesamientos-ingest.md`](procesamientos-ingest.md).

## Verificación de contenido (dev.db)

| Capa | Cantidad |
|------|----------|
| Conjuntos staging `FULL\|N\|RW` + `FULL\|N\|MATH` | **20** (Tests 1–10) |
| Candidatos no rechazados | **980** (54 R&W + 44 Math × 10) |
| `FullPracticeTest` Imported | **10** DRAFT, **98/98** cada uno |
| Topics skill | `M1` / `M2` (Domain `Full Practice Test`) · M1=EASY · M2=HARD |

No existe un enum `STANDARDIZED`. El FPT “estandarizado” es el resultado de ensamblar
4 módulos con la plantilla de [`lib/full-test-modules.ts`](../lib/full-test-modules.ts).

## Estados (reales)

| Capa | Campo | Valores relevantes |
|------|--------|-------------------|
| Candidato revisión | `IngestQuestionCandidate.status` | `NEEDS_REVIEW` · `READY` · `REVIEWED` · `REJECTED` |
| Candidato promoción | `promotionStatus` | `NOT_PROMOTED` · `EDITING` · `PROMOTED` · `REJECTED` |
| Trazabilidad | `IngestPromotionArtifact` | `FULL_PRACTICE_TEST` + `groupKey=full-test:{N}` |
| Producto | `FullPracticeTest.status` | `DRAFT` · `PUBLISHED` · `ARCHIVED` |

## Pipeline

```text
Archivos MOCK (2 conjuntos/test: RW + Math)
  → IngestQuestionCandidate (testNumber, section, moduleLabel)
  → Review (conjuntos FULL|N|RW|MATH)
  → promote-questions → Question (skill M1/M2, difficulty EASY/HARD)
  → promote-full-test → FullPracticeTest + 4 FullPracticeTestModule
       · order 0/1: RW M1/M2 (32 min) · order 2/3: Math M1/M2 (35 min)
       · isPretest = order < 2 en cada módulo (2 primeras; el alumno no lo ve)
       · breakMinutes default 10 entre RW M2 y Math M1
  → Player (timer/módulo, rojo ≤1 min, auto-advance, break, score operativo)
```

### Promoción de preguntas

`POST …/promote-questions` exige `READY`/`REVIEWED` + stem + respuesta. Escribe
`Question` y `promotionStatus=PROMOTED`. Para FT, difficulty/topic salen de
`moduleLabel` (M1→EASY, M2/2B→HARD), no del archivo.

### Ensamble FPT

`POST …/promote-full-test` solo usa candidatos ya `PROMOTED` del `testNumber`.
Reparte en 4 buckets (27/27/22/22), re-estampa metadata, crea/actualiza draft e
`IngestPromotionArtifact`. Staging **sigue** en 2 conjuntos; el ensamble es el
paso que materializa los 4 grupos del player.

## Comportamiento SAT en producto

| Regla | Implementación |
|-------|----------------|
| Pretest 2/módulo | `FullPracticeTestQuestion.isPretest`; excluidas del raw (RW máx 50, Math 40) |
| Score sección | `scaledScore` vía `FullPracticeTestScoreConversion` (0–50 / 0–40) |
| Break 10 min | `FullPracticeTest.breakMinutes` (default 10; 0 = off); no suma a tiempo de sección |
| Timeout | Auto-avance al siguiente módulo / break / submit (sin “extra time” jugable) |
| Timer | Rojo cuando quedan ≤ 60 s del módulo |
| Progress UI | % respondidas + posición; en FPT también por cada grupo |

Corrección de ítems: siempre `lib/answer-grading.ts` (`isAnswerCorrect`) en Practice
Sets y FPT. Escala 200–800 solo aplica a FPT.

## Referencias de código

| Archivo | Rol |
|---------|-----|
| `lib/full-test-modules.ts` | Plantilla 4 módulos + helpers M1/M2 |
| `lib/full-test-scoring.ts` | Raw → scaled |
| `lib/full-test-progress.ts` | Timers + fase BREAK |
| `lib/attempt-progress.ts` | % / posición PS y FPT |
| `app/api/.../promote-full-test` | Ensamble |
| `app/(student)/.../player-client.tsx` | Player |
| `scripts/ensure-fulltest-topics.mjs` | Topics M1/M2 |
| `scripts/backfill-fulltest-module-skills.ts` | Backfill skill/difficulty |
| `scripts/backfill-fulltest-pretest.ts` | Marca isPretest |
