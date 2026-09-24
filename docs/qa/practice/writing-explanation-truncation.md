# WRITING — `explanation_truncated` (detección determinista)

- **Fecha:** 2026-09-24 · read-only (`dev.db` abierto `{readonly:true}`).
- **Regla:** `alnum(Question.explanation)` es un **prefijo exacto** del `alnum(Rationale del ANS)` (footer `Question Difficulty:`/tabla `Assessment…` strippeado) **Y** (corte a mitad de oración con ≥8 chars alnum faltantes **O** ≥40 faltantes).
- **Total: 4** — todas en **Boundaries HARD** (sets H2/H3). Recuperables por **append-tail** desde el `ANS`.
- Regla, join por `Question ID` hex e índice ANS: `scratchpad/detect-writing-suspects.mjs`. Specs de recuperación: `scratchpad/writing-fixes/01-explanations.json`.

| qid | Topic / Dif | seq | extId | pub_len | alnum faltante | corte a mitad de oración | cola restaurada (inicio) |
|---|---|---|---|---|---|---|---|
| `cmsjro569052iqmt160utjb2h` | Boundaries / HARD | 3 | a05cc490 | 1211 | 436 | sí | …lead to an increase in resource consumption) is contrary to the information in the previous clause… |
| `cmsjro4ec04p1qmt1bbx04pmr` | Boundaries / HARD | 4 | 6e071432 | 1299 | 543 | sí | …dash between them would make this relationship less clear, suggesting that the supplement "both…described"… |
| `cmsjro58s053mqmt16m7a7m1e` | Boundaries / HARD | 11 | 21e58a83 | 1341 | 468 | sí | …separate a main clause from a dependent clause. Further, it illogically indicates that the following information… |
| `cmsjro4p904qaqmt1c9od80uf` | Boundaries / HARD | 13 | c06af4d8 | 1207 | 137 | sí | …phrase between two main clauses. Choice D is incorrect because it results in a run-on sentence… |

Todas cortan la explicación de las opciones C/D a mitad de oración. La cola completa está en el `Rationale` del `ANS` correspondiente (Boundaries Hard H2/H3); el fix conserva el prefijo ya guardado (comillas tipográficas intactas) y agrega solo la cola faltante.
