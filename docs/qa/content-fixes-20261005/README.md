# Content fixes 2026-10-05 (question vs. artifacts)

Read-only scan of the 2,594 in-use questions (`scan-bank.cjs`, `scan2-bank.cjs`) after a tester found
"COMB BACK LATER" in a Test 1 option. 19 questions had real defects; 28 guarded ops in `spec.json`
(each applies only when the field still equals `before`). Applied to dev.db and prod (2026-10-05):
dry-run 28/28 PENDING in both, apply → integrity ok, re-run → 28/28 ALREADY.
Prod backup: `/db/backups/dev.db.pre-content-fixes-20261005`.

Defect classes:
- OCR margin notes "COMB/COMI/CUME BACK LATER", exam-UI text "MOST QUESTION".
- Options pasted into the stem (T3 R&W M1 #8/#12, T5 Math M1 #21, T7 Math M1 #18); T3 #12 also carried
  another question's passage.
- Stem = table title only (T10 R&W M2 #14); stem repeating the passage + PDF number (T8 R&W M2 #3, M1 #7);
  "# Test 10 Innovator / Math Module 1 / 1." header (T10 Math M1 #1).
- Quotation options truncated with "..." because they came from the explanation table (T3 R&W M1 #10, #12);
  full text recovered from IngestOcrCache.
- Statements numbered 1/2/3 while options cite I/II/III (PSDA Statistical Claims MEDIUM #3).
- Markdown "#"/"###" chart/table titles (image already shows them) and explanations ending in "##".

Earlier the same day: 4 option-D fixes (T1 Math M1 #7/#22, T1 R&W M1 #9, T5 Math M1 #22).
Known false positives left in the scan output: 5 "2/4 options in stem" (options legitimately echo stem wording).
Attempts already started keep their immutable snapshot.

## Images (images-spec.json, same day)
UI-screenshot detector (blue "NEXT QUESTION" button / gray right panel) over the 343 in-use question and option images:
- T1 R&W M2 #12: image was the full source-UI screenshot (chart + passage + options) → cropped to the chart only
  (`/uploads/questions/04032063635065f5317be8b1-chart.png`; original kept).
- T9 Math M2 #4: question image was a UI screenshot of options A/B; the four options already have their own graph
  images → question `imageUrl` set to null.

## Renderer
`$$…$$` used mid-sentence (53 questions, e.g. T1 Math M2 #13/#14) rendered as centered blocks. `tokenizeMathContent`
(`lib/math-text.ts`) now keeps display mode only for a formula alone on its line; otherwise inline with `\displaystyle`.
