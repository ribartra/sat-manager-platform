# Practice Sets MEDIUM — hallazgos de recuperación (Math + R&W)

> **Estado (2026-08-11).** Auditoría + **APPLY WAL-safe** de los 30 Practice Sets
> `difficulty=MEDIUM` (19 Math · 11 R&W). Planes de agentes en `scratchpad/_tmp/ps-medium-*`;
> aplicador `scratchpad/_tmp/apply-ps-medium.ts` → `ok=170 skip=150 err=0`,
> `integrity_check: ok`. Post-apply: rename LinFunc false-partial + unwire CoE junk ord=0.
>
> Contexto: `scratchpad/_tmp/AGENT_CONTEXT_PS_MEDIUM.md` · método:
> [`ingest-agentic-recovery-strategies.md`](ingest-agentic-recovery-strategies.md).

## Resumen ejecutivo

| Slice | Plan | Aplicado |
|-------|------|----------|
| Math Geo + PSDA | SET_STEM×4, SET_OPTIONS×2, PROMOTE+WIRE×2, FIX_ANSWER×1 | **Sí** — Percentages 9/9, Two-Var 11/11; Area/Circles stems; Two-Var tablas |
| Math Algebra + Advanced | Equiv×4 PROMOTE+WIRE, OneVar Q15, SET_OPTIONS×3 crits, FIX_* | **Sí** — Equiv 23/23; 0 crit noOpts Math |
| R&W Craft + Info | 67 SET_STIMULUS + CoE SET_OPTIONS | **Sí** — Text Structure / Central / Inferences / CoE splits; WiC embebido |
| R&W Expression + SEC | 30 SET_STIMULUS + 30 SET_STEM Rhetorical | **Sí**; Transitions/SEC embebidos sin tocar |

**Post-apply:** 0 PracticeSet MEDIUM con `(partial N/M)` en el nombre. Math crit contestable = 0.
R&W: WiC/Transitions/Boundaries/Form con `emptyStim` legítimo (blank en stem).

## Math MEDIUM

### Partials → cerrados
| Set | Antes | Después |
|-----|-------|---------|
| Equivalent Expressions | 19/23 | **23** (4 páginas `[tbl]` recuperadas) |
| Linear Equations in One Variable | 17/18 | **18** |
| Linear Functions | 22/24 | **22/22** (false partial; 2 junk rationale → rename) |
| Percentages | 8/9 | **9** |
| Two-Variable Data | 10/11 | **11** |

### Crit “sin opciones” — HECHO
- Nonlinear Functions ord=30 → 4 option images
- Linear Inequalities ord=6 → tablas KaTeX
- Systems of Two Linear Equations ord=12 → graphs + SET_STEM
- Area and Volume ord=12 → opciones A–D + SET_STEM
- Two-Variable Data ord=2 → tablas con `imageArtifactId`

### Pendiente menor (NEEDS_HUMAN, no bloquea)
- Figuras Geo/PSDA (Area Q13 crop, Lines×3, Two-Var scatter×4)
- CoE graphs: splits aplicados; `imageUrl` de figura pendiente (~15)

## R&W MEDIUM

### Estímulo post-apply
| Set | emptyStim | Notas |
|-----|----------:|-------|
| Text Structure and Purpose | 0/17 | split aplicado |
| Words in Context | 50/56 | blank embebido (correcto dejar) |
| Central Ideas / Inferences / CoE | 0 (CoE 32 tras unwire junk) | splits |
| Cross-Text Connections | 0/9 | ya OK |
| Rhetorical Synthesis | 0/30 | notes→stimulus |
| Transitions / Boundaries / Form… | 14+10+11+19 | blank embebido |

### CoE junk
- ord=0 `cmsjro28q03grqmt1hztl80p3` — spillover de opciones de Q2, no era pregunta → **unwired** del set.

## Artefactos
| Archivo |
|---------|
| `scratchpad/_tmp/ps-medium-math-algadv-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-medium-math-geopsda-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-medium-rw-craftinfo-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-medium-rw-exprsec-{plan.json,findings.md}` |
| `scratchpad/_tmp/apply-ps-medium.ts` |
| `scratchpad/_tmp/AGENT_CONTEXT_PS_MEDIUM.md` |
