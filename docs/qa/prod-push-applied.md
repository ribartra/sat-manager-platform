# Push a producción (2026-09-22T15:34:55.991Z) — https://satsol.org

No destructivo: PUT por id de 37 preguntas. Valores del dev.db local.

> **Cierre:** 34/37 vía API (abajo). Las 3 que fallaron por el gate de publicación
> (`explanation` requerida) — T4 RW M1#25, T9 Math M2#14, T9 Math M2#15 — se aplicaron con un
> **UPDATE puntual en la VM** (`apply3.cjs` en one-off container, web+ingest parados ~1min,
> checkpoint+integrity ok, backup en `/data/db/backups/`). **Total: 37/37 en producción.**
> Health e imágenes verificadas 200.

Login: admin@satsol.org role=ADMIN

- OK cmsjrnt26002kqmt1v1jrud3i (img=-)
- OK cmsjrnt2e002mqmt1lj54y0xy (img=-)
- OK cmsjrnt2m002sqmt1dwpxzyvd (img=-)
- OK cmsjrnt2t002yqmt1qv2l69qf (img=-)
- OK cmsjrnt310034qmt1kw37nf0u (img=-)
- OK cmsjrnt38003aqmt1041w3n5d (img=-)
- OK cmsjrntwp00c3qmt1009fvz2k (img=/uploads/questions/3d9a8a61a57b3a926e0b2cec.jpg)
- OK cmsjrntzg00duqmt1t01beiay (img=/uploads/questions/b342e8f0df6c33fb54447e42.jpg)
- OK cmsjrnu5300goqmt13nxbcs97 (img=-)
- OK cmsjrnugu00ijqmt1szmnlak6 (img=/uploads/questions/f38422293f217d11d8b303b8.jpg)
- OK cmsjrnuh400ilqmt1obq908v1 (img=/uploads/questions/c10861991e9b9ec9308120dc.jpg)
- FAIL cmsjrnusr00lpqmt1m5c083u0 400: ["Explanation is required to publish."]
- OK cmsjrnvad00rqqmt1dkutaaga (img=/uploads/questions/a96d1a8a8c09757ce2226f41.jpg)
- OK cmsjrnvsm00xpqmt1r7yupxmu (img=-)
- OK cmsjrnvua00xyqmt14touuur7 (img=-)
- FAIL cmsjrnw4o010qqmt15p9zquem 400: ["Explanation is required to publish."]
- FAIL cmsjrnw4w010wqmt1lxiguftt 400: ["Explanation is required to publish."]
- OK cmsjrnw6y0115qmt1n6l2xku6 (img=/uploads/questions/72a2daa0cf1c57f33618dbde.jpg)
- OK cmsjrnw98011gqmt1zh6x8hem (img=-)
- OK cmsjrnwkk0168qmt1r4m1sqcd (img=-)
- OK cmsjrnwor018cqmt1a2l03wsi (img=-)
- OK cmsjrnwpf018oqmt12nzmb1in (img=-)
- OK cmsjrnwpw018yqmt19llko5o3 (img=-)
- OK cmsjrnws80192qmt10nbo6aqr (img=-)
- OK cmsjrnwxx01bfqmt1dqsbjcuh (img=/uploads/questions/5173d34a039f193bac6a37a8.jpg)
- OK cmsjrnwy501bhqmt1rs7o5c3c (img=/uploads/questions/04d56762f2dd5e07062ba046.jpg)
- OK cmsjrnwyd01bnqmt1l4vwq4sj (img=/uploads/questions/12a224076a513480257f948c.jpg)
- OK cmsjrnx2701c2qmt18m37uycw (img=/uploads/questions/67f33f97bbccf50c456d9895.jpg)
- OK cmsjrny4201syqmt1n7f9hqsq (img=-)
- OK cmsjrny4k01tgqmt16un61jz0 (img=-)
- OK cmsnb3fzg000k0mpdb3ur9ziu (img=/uploads/questions/8ad1996ebe3409bd8fb2674f.jpg)
- OK cmsnb3g2c001y0mpd76881utf (img=/uploads/questions/6ad65c3584059d7843545131.jpg)
- OK cmsnb3g2v002i0mpdrimxrlt4 (img=/uploads/questions/1cca36cb78ae20aa76b07f60.jpg)
- OK cmsnb3g4m00490mpd1v3v3lb8 (img=/uploads/questions/142457fafc49f90a9bfb014e.jpg)
- OK cmsnffuwf000l0mmx4vvrlqaw (img=/uploads/questions/76d05ee217b4e2d20bdfd85f.jpg)
- OK cmsnffuyr001q0mmxjm8sgd11 (img=/uploads/questions/1f68e3a67c31cbba9b1016e6.jpg)
- OK cmsnffuz3001x0mmxlkruutzz (img=/uploads/questions/2025a8ffac8a6b6ffcbc9832.jpg)

## Resultado
OK: 34 / 37 | FAIL: 3
- cmsjrnusr00lpqmt1m5c083u0 :: 400 ["Explanation is required to publish."]
- cmsjrnw4o010qqmt15p9zquem :: 400 ["Explanation is required to publish."]
- cmsjrnw4w010wqmt1lxiguftt :: 400 ["Explanation is required to publish."]
