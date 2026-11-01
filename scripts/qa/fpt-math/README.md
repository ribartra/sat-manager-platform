# FPT Math — auditoría orden ↔ enunciado ↔ respuesta

Reproduce `docs/qa/fpt-math-order-answer-alignment.md` (solo lectura).

```bash
OUT=/tmp/fpt; mkdir -p $OUT
cd "files_to_load/MOCK EXAMS"
python3 - <<PY   # linealiza las Explanations/ANS KEY de cada test a $OUT/expl-N.txt
import sys; sys.path.insert(0, "../../scripts/qa/fpt-math"); from lin import lin
# ver rutas por test en parse.py / keys.py
PY
python3 ../../scripts/qa/fpt-math/keys.py $OUT
cd ../..
python3 scripts/qa/fpt-math/parse.py $OUT
node scripts/qa/fpt-math/export-db.cjs dev.db $OUT
python3 scripts/qa/fpt-math/compare.py $OUT   # -> $OUT/result.json
```
Fuentes: `TEST N/…Math…Answer…Explanations.docx` (Q N + "Correct Answer: letra — valor"),
ANS KEY docx (tabla por módulo; Math 2 = 2B), candidato de ingesta (`questionNumber`, `moduleLabel`, página).
