# Practice Sets EASY — hallazgos de recuperación (Math + R&W)

> **Estado (2026-08-11).** Auditoría + **APPLY WAL-safe** de los 29 Practice Sets
> `difficulty=EASY` (19 Math · 10 R&W). Planes de agentes en `scratchpad/_tmp/ps-easy-*`;
> aplicador `scratchpad/_tmp/apply-ps-easy.ts` → `ok=148 skip=225 err=0`,
> `integrity_check: ok`.
>
> Contexto: `scratchpad/_tmp/AGENT_CONTEXT_PS_EASY.md` · método:
> [`ingest-agentic-recovery-strategies.md`](ingest-agentic-recovery-strategies.md).

## Resumen ejecutivo

| Slice | Plan | Aplicado |
|-------|------|----------|
| Math Geo + PSDA | 5 PROMOTE+WIRE, 1 SET_STEM | **Sí** — partials cerrados (17/17, 6/6, 12/12, 14/14) |
| Math Algebra + Advanced | SET_OPTIONS 11, PROMOTE 4, FIX_* | **Sí** — sin crit de opciones restantes; 2 NEEDS_HUMAN saltados (junk) |
| R&W Craft + Info | 73 SET_STIMULUS | **Sí** |
| R&W Expression + SEC | 18 SET_STIMULUS + 18 SET_STEM | **Sí** (Rhetorical); Transitions/SEC embebidos sin tocar |

**Post-apply:** 0 gaps de contenido contestable (excl. `sin estímulo` embebido legítimo en WiC/Transitions/SEC). Ningún PracticeSet EASY queda con `(partial N/M)` en el nombre.

## Math EASY

### Partials → promovidos (Geo/PSDA) — HECHO
| Set | Antes | Después |
|-----|-------|---------|
| Lines, Angles, and Triangles | 16/17 | **17** |
| Inference and Margin of Error | 5/6 | **6** |
| Probability | 11/12 | **12** |
| Ratios… | 12/14 | **14** |

### Crit “sin opciones” — HECHO
- Linear Equations in Two Variables: 5 tablas → SET_OPTIONS texto.
- Nonlinear Functions: Q3/Q12 → opciones con `imageUrl` materializado.
- Equivalent Expressions: 18/21 → **21**; FIX_TYPE Q3; 3 páginas recuperadas + cableadas.
- Linear Equations in One Variable: 17/18 → **18**.

### Pendiente menor (NEEDS_HUMAN, no bloquea)
- Nonlinear Functions: 1 candidato basura p4 (fragmento).
- Figuras Geo/PSDA sin `imageUrl` de enunciado (~10) — calidad visual, no contestabilidad.
- Junk ANS row Two Variables (unlink opcional).

## R&W EASY

### Estímulo post-apply
| Set | emptyStim | Notas |
|-----|----------:|-------|
| Text Structure and Purpose | 0/17 | split aplicado |
| Words in Context | 104/131 | blank embebido (correcto dejar) |
| Central Ideas / CoE / Inferences / Cross-Text | 0 | split o ya OK |
| Rhetorical Synthesis | 0/18 | notes→stimulus + stem limpio |
| Transitions / Boundaries / Form… | 20+16+17 | blank embebido (correcto dejar) |

## Artefactos
| Archivo |
|---------|
| `scratchpad/_tmp/ps-easy-math-algadv-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-easy-math-geopsda-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-easy-rw-craftinfo-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-easy-rw-exprsec-{plan.json,findings.md}` |
| `scratchpad/_tmp/apply-ps-easy.ts` |
| `scratchpad/_tmp/AGENT_CONTEXT_PS_EASY.md` |
