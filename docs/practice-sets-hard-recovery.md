# Practice Sets HARD — hallazgos de recuperación (Math + R&W)

> **Estado (2026-08-11).** Auditoría + **APPLY WAL-safe** de los 32 Practice Sets
> `difficulty=HARD` (20 Math · 12 R&W). Planes de agentes en `scratchpad/_tmp/ps-hard-*`;
> aplicador `scratchpad/_tmp/apply-ps-hard.ts` → `ok=201 skip=178 err=0`,
> `integrity_check: ok`. Post-apply: unwire CoE junk spillover (set → 36 Q reales).
>
> Contexto: `scratchpad/_tmp/AGENT_CONTEXT_PS_HARD.md` · método:
> [`ingest-agentic-recovery-strategies.md`](ingest-agentic-recovery-strategies.md).

## Resumen ejecutivo

| Slice | Plan | Aplicado |
|-------|------|----------|
| Math Geo + PSDA | PROMOTE+WIRE×2, SET_STEM×19, SET_OPTIONS×2, FIX_ANSWER×3 | **Sí** — Area 13/13; Dist&Meas 20/20 (junk QNone descartado) |
| Math Algebra + Advanced | SET_OPTIONS×1 crit + muchos FIX_ANSWER/SET_STEM | **Sí** — Two-Var graphs; Equiv/NLF/Systems answers/stems |
| R&W Craft + Info | 85 SET_STIMULUS + CoE SET_OPTIONS×2 | **Sí** — Text Structure / Central / Inferences / CoE; WiC embebido |
| R&W Expression + SEC | 21 SET_STIMULUS + 21 SET_STEM Rhetorical | **Sí**; Transitions/Boundaries×3/Form embebidos |

**Post-apply:** 0 PracticeSet HARD con `(partial N/M)`. Math+R&W crit contestable = 0.

## Math HARD

### Partials → cerrados
| Set | Antes | Después |
|-----|-------|---------|
| Area and Volume | 12/13 | **13** |
| One-Variable Data: Distributions and Measures | 19/21 | **20** (corpus real; stub `[tbl]` no cableado) |
| Command of Evidence (R&W) | 37/38 | **36** (2 spillovers de páginas de opciones) |

### Crit / calidad — HECHO
- Linear Equations in Two Variables ord=12 → 4 option images
- Circles / Lines / Dist: FIX_ANSWER + SET_STEM / SET_OPTIONS según plan
- EquivExpr / Nonlinear Equations / Nonlinear Functions / Systems: signos, tipos NUMERIC, stems OCR

### Pendiente menor (NEEDS_HUMAN)
- Figuras Geo/PSDA (~9) y NLF Q15 graph sin artifact
- CoE graph `imageUrl` (~7) — splits de texto OK

## R&W HARD

### Estímulo post-apply
| Set | emptyStim | Notas |
|-----|----------:|-------|
| Text Structure and Purpose | 0/14 | split |
| Words in Context | 49/54 | blank embebido |
| Central Ideas / Inferences / CoE | 0 | splits; CoE 36 tras unwire |
| Cross-Text Connections | 0/12 | ya OK |
| Rhetorical Synthesis | 0/21 | notes→stimulus |
| Transitions / Boundaries×3 / Form | 15+14+16+15+23 | blank embebido |

## Artefactos
| Archivo |
|---------|
| `scratchpad/_tmp/ps-hard-math-algadv-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-hard-math-geopsda-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-hard-rw-craftinfo-{plan.json,findings.md}` |
| `scratchpad/_tmp/ps-hard-rw-exprsec-{plan.json,findings.md}` |
| `scratchpad/_tmp/apply-ps-hard.ts` |
| `scratchpad/_tmp/AGENT_CONTEXT_PS_HARD.md` |
